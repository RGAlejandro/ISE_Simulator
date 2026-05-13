import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateChat } from "@/lib/ai-provider";

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

TONE: Friendly, encouraging, clear. You can respond in English or Spanish depending on what language the user writes in.

USER CONTEXT (if provided below): Use it to personalise your answers — e.g. mention their current exam level, whether they have full access, etc. Do not reveal raw technical details like database IDs.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const { messages }: { messages: ChatMessage[] } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Build optional user context string
  let userContextBlock = "";
  const { userId } = await auth();
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { subscription: true },
    }).catch(() => null);

    if (user) {
      const isPro =
        user.plan === "ADMIN" ||
        (user.plan === "PRO" && user.subscription?.status === "ACTIVE");
      userContextBlock = `\n\nUSER CONTEXT:\n- Name: ${user.name ?? "unknown"}\n- Plan: ${isPro ? "Pro (full access)" : "Free (limited daily uses)"}\n- Exam level preference: not stored (ask them if relevant)`;
    }
  }

  const fullPrompt = `${SYSTEM_PROMPT}${userContextBlock}`;

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  try {
    const text = await generateChat(fullPrompt, conversationText, {
      temperature: 0.7,
      maxTokens: 1024,
    });

    return NextResponse.json({ message: text });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
