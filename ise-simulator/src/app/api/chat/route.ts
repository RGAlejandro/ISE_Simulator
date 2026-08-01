import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateChat } from "@/lib/ai-provider";
import { isProUser, incrementUsage } from "@/lib/user";
import { FREE_CHAT_DAILY_LIMIT } from "@/lib/constants";

// Defensive caps on the prompt we build from client-provided history
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;

const SYSTEM_PROMPT = `You are "ISE Assistant", a friendly AI English tutor embedded in ISE Simulator — a web app that helps students learn English and prepare for the Trinity College London ISE (Integrated Skills in English) exams.

YOUR SCOPE — you help with ANYTHING related to learning English, including:
- General English questions: grammar, vocabulary, phrasal verbs, idioms, collocations, pronunciation, spelling, punctuation, register/formality
- Word meanings, differences between similar words, synonyms/antonyms, example sentences
- Translations between English and the user's language, and explaining why
- Correcting and improving sentences or short texts (mind the plan limits below)
- Writing help: structure, connectors, paraphrasing, style
- The Trinity ISE exam: structure, levels, tasks and scoring (ISE Foundation/A2, ISE I/B1, ISE II/B2, ISE III/C1, ISE IV/C2), written and oral tasks, assessment criteria
- How to use ISE Simulator (features, plans, how to practise)
- Study tips and strategies to improve English and pass the exam

RESTRICTIONS:
- Stay on topic: you only help with English language learning and the ISE exam. If asked about something clearly unrelated (politics, coding, recipes, medical/legal advice, etc.), politely redirect to what you can help with.
- Do NOT make up exam content, scores, or official Trinity policies you are not sure about. Say "I'm not sure — please check the official Trinity website."

PLAN-BASED RESTRICTIONS (critical — always follow these):
- FREE users: give general exam advice, study tips, and feature explanations. Do NOT provide detailed personalised essay feedback, do NOT offer to correct their writing at length, do NOT simulate a full exam session through chat. For those features, tell them to use the app's exam modules (which handle gating properly).
- PRO users: you can give richer, more detailed guidance. You can give more thorough feedback on short writing samples they paste (up to ~100 words). Still don't perform full exam simulations through chat.
- If a free user asks for something that requires Pro, tell them politely: "That level of detail is available to Pro users — you can upgrade at /pricing."

TONE: Friendly, encouraging, clear. You can respond in English or Spanish depending on what language the user writes in.

USER CONTEXT (if provided below): Use it to personalise your answers.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages }: { messages: ChatMessage[] } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: true },
  }).catch(() => null);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isPro = isProUser(user);

  // Rate-limit free users server-side: persistent daily counter, not client-sent history
  if (!isPro) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const usage = await prisma.dailyUsage.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });
    if ((usage?.chatCount ?? 0) >= FREE_CHAT_DAILY_LIMIT) {
      return NextResponse.json({
        message: `Has alcanzado el límite de ${FREE_CHAT_DAILY_LIMIT} mensajes al día para usuarios gratuitos. Actualiza a Pro en /pricing para conversaciones ilimitadas.`,
      });
    }
  }

  const userContextBlock = `\n\nUSER CONTEXT:\n- Name: ${user.name ?? "unknown"}\n- Plan: ${isPro ? "Pro (full access)" : `Free (limited daily exams; chat limited to ${FREE_CHAT_DAILY_LIMIT} messages per day)`}\n- Exam level preference: not stored (ask them if relevant)`;

  const fullPrompt = `${SYSTEM_PROMPT}${userContextBlock}`;

  const conversationText = messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${String(m.content).slice(0, MAX_MESSAGE_CHARS)}`)
    .join("\n\n");

  try {
    const text = await generateChat(fullPrompt, conversationText, {
      temperature: 0.7,
      maxTokens: isPro ? 1024 : 512,
    });

    if (!isPro) {
      await incrementUsage(user.id, "chat");
    }

    return NextResponse.json({ message: text });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
