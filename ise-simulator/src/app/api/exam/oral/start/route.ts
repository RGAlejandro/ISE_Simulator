import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateChat } from "@/lib/gemini";
import { getCurrentUser, getDailyUsage, incrementUsage } from "@/lib/user";
import {
  getOralExaminerSystemPrompt,
  getTopicTaskPrompt,
} from "@/lib/prompts/oral-exam";
import type { ExamLevel } from "@/types";

const VALID_LEVELS: ExamLevel[] = ["ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"];

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { level, topic } = body;

    if (!level || !VALID_LEVELS.includes(level)) {
      return NextResponse.json({ error: "Invalid exam level" }, { status: 400 });
    }

    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      return NextResponse.json({ error: "Please provide a topic for the exam" }, { status: 400 });
    }

    // Check daily usage limits
    const usage = await getDailyUsage(user.id);
    if (!usage.canTakeOral) {
      return NextResponse.json(
        { error: "Daily limit reached. Upgrade to Pro for unlimited exams." },
        { status: 429 }
      );
    }

    // Generate examiner's opening for Topic Task
    const systemPrompt = getOralExaminerSystemPrompt(level as ExamLevel);
    const topicPrompt = getTopicTaskPrompt(level as ExamLevel, topic.trim());

    const examinerOpening = await generateChat(systemPrompt, topicPrompt, {
      temperature: 0.7,
      maxTokens: 200,
    });

    // Create oral exam in DB
    const exam = await prisma.oralExam.create({
      data: {
        userId: user.id,
        level: level as ExamLevel,
        status: "IN_PROGRESS",
      },
    });

    // Save the examiner's opening exchange
    await prisma.oralExchange.create({
      data: {
        examId: exam.id,
        taskType: "TOPIC",
        role: "EXAMINER",
        content: examinerOpening,
        order: 0,
      },
    });

    // Increment daily usage
    await incrementUsage(user.id, "oral");

    return NextResponse.json({
      examId: exam.id,
      examinerMessage: examinerOpening,
    });
  } catch (error) {
    console.error("Error starting oral exam:", error);
    return NextResponse.json({ error: "Failed to start oral exam" }, { status: 500 });
  }
}
