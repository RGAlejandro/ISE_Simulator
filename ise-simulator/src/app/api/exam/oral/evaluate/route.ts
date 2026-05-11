import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/gemini";
import { getCurrentUser } from "@/lib/user";
import { getOralEvaluationPrompt } from "@/lib/prompts/oral-exam";
import type { ExamLevel, OralTaskType } from "@/types";

const TASK_TYPES: OralTaskType[] = ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"];

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
    const { examId } = body;

    if (!examId) {
      return NextResponse.json({ error: "Exam ID required" }, { status: 400 });
    }

    const exam = await prisma.oralExam.findUnique({
      where: { id: examId, userId: user.id },
      include: {
        exchanges: { orderBy: { order: "asc" } },
        feedback: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const model = "gemini-2.0-flash";
    const feedbackResults: Record<string, unknown> = {};
    let totalScore = 0;

    // Evaluate each task type
    for (const taskType of TASK_TYPES) {
      const taskExchanges = exam.exchanges.filter((e) => e.taskType === taskType);
      if (taskExchanges.length === 0) continue;

      const transcript = taskExchanges
        .map((e) => {
          if (e.taskType === "LISTENING" && e.role === "EXAMINER") {
            try {
              const data = JSON.parse(e.content);
              if (data.listeningText) {
                return `Examiner: [Listening passage played: ${data.listeningText}]`;
              }
            } catch {
              // Not JSON, use as-is
            }
          }
          return `${e.role === "EXAMINER" ? "Examiner" : "Candidate"}: ${e.content}`;
        })
        .join("\n");

      const evaluationPrompt = getOralEvaluationPrompt(
        exam.level as ExamLevel,
        taskType,
        transcript
      );

      const feedback = await generateJSON(evaluationPrompt, { temperature: 0.3 });

      // Save feedback to DB
      await prisma.oralFeedback.create({
        data: {
          examId,
          taskType,
          feedback,
          score: feedback.score ?? 0,
        },
      });

      totalScore += feedback.score ?? 0;

      // Only return detailed feedback for Pro users
      feedbackResults[taskType] =
        user.plan === "PRO"
          ? feedback
          : { score: feedback.score };
    }

    // Calculate overall score (average across tasks, normalized to 100)
    const taskCount = Object.keys(feedbackResults).length;
    const maxPerTask = 25;
    const overallScore = taskCount > 0
      ? Math.round((totalScore / (taskCount * maxPerTask)) * 100)
      : 0;

    // Update exam status
    await prisma.oralExam.update({
      where: { id: examId },
      data: {
        status: "EVALUATED",
        overallScore,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      examId,
      overallScore,
      feedback: feedbackResults,
    });
  } catch (error) {
    console.error("Error evaluating oral exam:", error);
    return NextResponse.json({ error: "Failed to evaluate exam" }, { status: 500 });
  }
}
