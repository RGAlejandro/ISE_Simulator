import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/ai-provider";
import { getReadingTextsPrompt, getQuestionsPrompt } from "@/lib/prompts/written-exam";
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

    // Step 1: Generate reading texts (kept short to avoid 413 token limits)
    const textsPrompt = getReadingTextsPrompt(level as ExamLevel);
    let textsResult: { reading1: { title: string; paragraphs: Array<{ number: number; text: string }> }; reading2: { title: string; topic: string; texts: Array<{ letter: string; title?: string; author?: string; source: string; content: string; isGraph: boolean }> } };
    try {
      console.log("[Exam] Step 1: generating reading texts for level:", level);
      textsResult = await generateJSON(textsPrompt, { temperature: 0.8, maxTokens: 6000 });
      console.log("[Exam] Step 1 done. reading1 paragraphs:", textsResult?.reading1?.paragraphs?.length, "reading2 texts:", textsResult?.reading2?.texts?.length);
    } catch (aiError: unknown) {
      console.error("[Exam] Step 1 failed:", aiError);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      return NextResponse.json({ error: `AI error generating reading texts: ${errMsg}` }, { status: 503 });
    }

    if (!textsResult?.reading1?.paragraphs || textsResult.reading1.paragraphs.length < 5) {
      return NextResponse.json({ error: "AI returned incomplete reading texts (Task 1). Please try again." }, { status: 503 });
    }
    if (!textsResult?.reading2?.texts || textsResult.reading2.texts.length < 4) {
      return NextResponse.json({ error: "AI returned incomplete reading texts (Task 2). Please try again." }, { status: 503 });
    }

    // Step 2: Generate questions based on the actual texts (higher quality — model sees real content)
    const questionsPrompt = getQuestionsPrompt(level as ExamLevel, textsResult.reading1, textsResult.reading2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let questionsResult: any;
    try {
      console.log("[Exam] Step 2: generating questions...");
      questionsResult = await generateJSON(questionsPrompt, { temperature: 0.7, maxTokens: 4000 });
      console.log("[Exam] Step 2 done. keys:", Object.keys(questionsResult ?? {}));
    } catch (aiError: unknown) {
      console.error("[Exam] Step 2 failed:", aiError);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      return NextResponse.json({ error: `AI error generating questions: ${errMsg}` }, { status: 503 });
    }

    // Merge into final exam content
    const examContent = {
      level,
      reading1: {
        ...textsResult.reading1,
        paragraphMatching: questionsResult?.reading1Questions?.paragraphMatching,
        statementSelection: questionsResult?.reading1Questions?.statementSelection,
        gapFill: questionsResult?.reading1Questions?.gapFill,
      },
      reading2: {
        ...textsResult.reading2,
        textMatching: questionsResult?.reading2Questions?.textMatching,
        statementSelection: questionsResult?.reading2Questions?.statementSelection,
        gapFill: questionsResult?.reading2Questions?.gapFill,
      },
      readingIntoWriting: questionsResult?.readingIntoWriting,
      extendedWriting: questionsResult?.extendedWriting,
    };

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
