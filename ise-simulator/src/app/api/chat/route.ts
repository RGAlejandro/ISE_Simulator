import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getGenAI } from "@/lib/gemini";

const FREE_CHAT_DAILY_LIMIT = 20;

const SYSTEM_PROMPT = `You are "ISE Assistant", a helpful AI tutor embedded in ISE Simulator — a web app that helps students prepare for the Trinity College London ISE (Integrated Skills in English) exams.

YOUR SCOPE — you ONLY answer questions about:
- The Trinity ISE exam structure, levels, tasks, and scoring (ISE Foundation/A2, ISE I/B1, ISE II/B2, ISE III/C1, ISE IV/C2)
- Written paper tasks: Reading Task 1, Reading Task 2, Reading into Writing, Extended Writing
- Oral exam tasks: Topic Task, Collaborative Task, Conversation Task, Listening Task
- Grammar and vocabulary relevant to ISE exam preparation
- How to use ISE Simulator (features, plans, how to practise)
- General English learning tips and strategies for exam success
- Trinity assessment criteria and what examiners look for

STRICT RESTRICTIONS:
- Do NOT answer questions unrelated to English learning or the ISE exam (e.g. politics, coding, recipes, general chat, etc.)
- If asked something outside your scope, politely redirect: explain you can only help with ISE exam preparation and English learning.
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

  const isPro =
    user.plan === "ADMIN" ||
    (user.plan === "PRO" && user.subscription?.status === "ACTIVE");

  // Rate-limit free users: count user messages sent in this session (client sends full history each request)
  if (!isPro) {
    const userMsgCount = messages.filter((m) => m.role === "user").length;
    if (userMsgCount > FREE_CHAT_DAILY_LIMIT) {
      return NextResponse.json({
        message: `Has alcanzado el límite de ${FREE_CHAT_DAILY_LIMIT} mensajes por sesión para usuarios gratuitos. Actualiza a Pro en /pricing para conversaciones ilimitadas.`,
      });
    }
  }

  const userContextBlock = `\n\nUSER CONTEXT:\n- Name: ${user.name ?? "unknown"}\n- Plan: ${isPro ? "Pro (full access)" : `Free (limited daily exams; chat limited to ${FREE_CHAT_DAILY_LIMIT} messages per session)`}\n- Exam level preference: not stored (ask them if relevant)`;

  const conversationHistory = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const fullPrompt = `${SYSTEM_PROMPT}${userContextBlock}\n\n---\n\n${conversationHistory}\n\nAssistant:`;

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0.7, maxOutputTokens: isPro ? 1024 : 512 },
    });

    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    return NextResponse.json({ message: text });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
