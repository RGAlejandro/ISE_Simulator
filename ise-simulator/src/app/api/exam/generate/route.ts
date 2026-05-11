import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/gemini";
import { getWrittenExamPrompt } from "@/lib/prompts/written-exam";
import { getCurrentUser, getDailyUsage, incrementUsage } from "@/lib/user";
import type { ExamLevel } from "@/types";

const VALID_LEVELS: ExamLevel[] = ["ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"];

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { level } = body;

    if (!level || !VALID_LEVELS.includes(level)) {
      return NextResponse.json({ error: "Invalid exam level" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check daily usage limits
    const usage = await getDailyUsage(user.id);
    if (!usage.canTakeWritten) {
      return NextResponse.json(
        { error: "Daily limit reached. Upgrade to Pro for unlimited exams." },
        { status: 429 }
      );
    }

    // Generate exam with Gemini (free tier)
    const prompt = getWrittenExamPrompt(level as ExamLevel);
    let examContent;
    try {
      console.log("Generating exam with Gemini for level:", level);
      examContent = await generateJSON(prompt, { temperature: 0.8 });
      console.log("Exam generated successfully, keys:", Object.keys(examContent));
    } catch (aiError: unknown) {
      console.error("Gemini API full error:", aiError);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error("Gemini API error message:", errMsg);
      if (errMsg.includes("API_KEY")) {
        return NextResponse.json(
          { error: "Invalid Gemini API key. Please check your configuration." },
          { status: 503 }
        );
      }
      if (errMsg.includes("RATE_LIMIT") || errMsg.includes("429") || errMsg.includes("quota")) {
        return NextResponse.json(
          { error: "AI rate limit reached. Please wait a moment and try again." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: `AI error: ${errMsg}` },
        { status: 503 }
      );
    }

    // Save exam to database
    const exam = await prisma.writtenExam.create({
      data: {
        userId: user.id,
        level: level as ExamLevel,
        content: examContent,
        status: "IN_PROGRESS",
      },
    });

    // Increment daily usage
    await incrementUsage(user.id, "written");

    return NextResponse.json({ examId: exam.id, content: examContent });
  } catch (error) {
    console.error("Error generating exam:", error);
    return NextResponse.json({ error: "Failed to generate exam. Please try again." }, { status: 500 });
  }
}
