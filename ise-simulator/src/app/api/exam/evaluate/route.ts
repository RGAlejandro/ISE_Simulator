import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/ai-provider";
import { getEvaluateWritingPrompt } from "@/lib/prompts/written-exam";
import { getCurrentUser } from "@/lib/user";
import type { ExamLevel, WrittenExamContent } from "@/types";

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
    const { examId, responses, readingAnswers } = body;

    if (!examId) {
      return NextResponse.json({ error: "Exam ID required" }, { status: 400 });
    }

    const exam = await prisma.writtenExam.findUnique({
      where: { id: examId, userId: user.id },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const examContent = exam.content as unknown as WrittenExamContent;
    const results: Record<string, unknown> = {};

    // ═══════════════════════════════════════════
    // SCORE READING 1 (15 questions)
    // ═══════════════════════════════════════════
    let readingScore = 0;
    const totalReadingQuestions = 30; // 15 per reading

    // Q1-5: Paragraph Matching
    const pmCorrect = examContent.reading1.paragraphMatching.correctAnswers;
    for (let i = 0; i < 5; i++) {
      const userAnswer = readingAnswers?.[`pm_${i + 1}`];
      if (userAnswer && userAnswer.toUpperCase() === pmCorrect[i].toUpperCase()) {
        readingScore++;
      }
    }

    // Q6-10: Statement Selection (array of selected letters)
    const r1SsCorrect = examContent.reading1.statementSelection.correctAnswers;
    const r1SsUser = (readingAnswers?.["r1_ss"] || []) as string[];
    for (const letter of r1SsCorrect) {
      if (r1SsUser.includes(letter)) readingScore++;
    }

    // Q11-15: Gap Fill
    for (const q of examContent.reading1.gapFill.questions) {
      const userAnswer = (readingAnswers?.[q.id] as string || "").toLowerCase().trim();
      if (userAnswer && userAnswer === q.correctAnswer.toLowerCase().trim()) {
        readingScore++;
      }
    }

    // ═══════════════════════════════════════════
    // SCORE READING 2 (15 questions)
    // ═══════════════════════════════════════════

    // Q16-20: Text Matching
    const tmCorrect = examContent.reading2.textMatching.correctAnswers;
    const tmQuestions = examContent.reading2.textMatching.questions;
    for (let i = 0; i < tmQuestions.length; i++) {
      const userAnswer = readingAnswers?.[tmQuestions[i].id] as string;
      if (userAnswer && userAnswer.toUpperCase() === tmCorrect[i].toUpperCase()) {
        readingScore++;
      }
    }

    // Q21-25: Statement Selection
    const r2SsCorrect = examContent.reading2.statementSelection.correctAnswers;
    const r2SsUser = (readingAnswers?.["r2_ss"] || []) as string[];
    for (const letter of r2SsCorrect) {
      if (r2SsUser.includes(letter)) readingScore++;
    }

    // Q26-30: Gap Fill
    for (const q of examContent.reading2.gapFill.questions) {
      const userAnswer = (readingAnswers?.[q.id] as string || "").toLowerCase().trim();
      if (userAnswer && userAnswer === q.correctAnswer.toLowerCase().trim()) {
        readingScore++;
      }
    }

    // Split reading score per task for display purposes
    let reading1Score = 0;
    // Recount R1 so we can store separately
    for (let i = 0; i < 5; i++) {
      const userAnswer = readingAnswers?.[`pm_${i + 1}`];
      if (userAnswer && userAnswer.toUpperCase() === examContent.reading1.paragraphMatching.correctAnswers[i].toUpperCase()) {
        reading1Score++;
      }
    }
    for (const letter of examContent.reading1.statementSelection.correctAnswers) {
      if (((readingAnswers?.["r1_ss"] || []) as string[]).includes(letter)) reading1Score++;
    }
    for (const q of examContent.reading1.gapFill.questions) {
      const ua = (readingAnswers?.[q.id] as string || "").toLowerCase().trim();
      if (ua && ua === q.correctAnswer.toLowerCase().trim()) reading1Score++;
    }
    const reading2Score = readingScore - reading1Score;

    results.reading = {
      score: readingScore,
      total: totalReadingQuestions,
      percentage: Math.round((readingScore / totalReadingQuestions) * 100),
      reading1Score,
      reading2Score,
    };

    // Persist reading scores as WrittenResponse records
    await prisma.writtenResponse.createMany({
      data: [
        {
          examId,
          taskType: "READING_1",
          taskNumber: 1,
          response: JSON.stringify(readingAnswers),
          aiFeedback: JSON.stringify({ score: reading1Score, total: 15, percentage: Math.round((reading1Score / 15) * 100) }),
          score: reading1Score,
        },
        {
          examId,
          taskType: "READING_2",
          taskNumber: 2,
          response: JSON.stringify(readingAnswers),
          aiFeedback: JSON.stringify({ score: reading2Score, total: 15, percentage: Math.round((reading2Score / 15) * 100) }),
          score: reading2Score,
        },
      ],
    });

    // ═══════════════════════════════════════════
    // EVALUATE WRITINGS WITH AI
    // ═══════════════════════════════════════════

    const writingTasks = [
      { key: "READING_INTO_WRITING", taskNum: 3, prompt: examContent.readingIntoWriting.prompt },
      { key: "EXTENDED_WRITING", taskNum: 4, prompt: examContent.extendedWriting.prompt },
    ];

    for (const task of writingTasks) {
      const userResponse = responses?.[task.key];
      if (userResponse && userResponse.trim().length > 0) {
        const evaluationPrompt = getEvaluateWritingPrompt(
          exam.level as ExamLevel,
          task.key,
          task.prompt,
          userResponse
        );

        const feedback = await generateJSON(evaluationPrompt, { temperature: 0.3 });

        await prisma.writtenResponse.create({
          data: {
            examId,
            taskType: task.key as "READING_INTO_WRITING" | "EXTENDED_WRITING",
            taskNumber: task.taskNum,
            response: userResponse,
            aiFeedback: user.plan === "PRO" ? JSON.stringify(feedback) : null,
            score: feedback.score,
          },
        });

        results[task.key] = user.plan === "PRO" ? feedback : { score: feedback.score, band: feedback.band };
      }
    }

    // Calculate overall score
    const writingScores = writingTasks
      .map((t) => {
        const r = results[t.key] as { score?: number } | undefined;
        return r?.score ?? 0;
      });
    const avgWritingScore = writingScores.reduce((a, b) => a + b, 0) / writingScores.length;
    const overallScore = Math.round(
      ((results.reading as { percentage: number }).percentage * 0.5 + avgWritingScore * 2.5)
    );

    await prisma.writtenExam.update({
      where: { id: examId },
      data: {
        status: "EVALUATED",
        score: overallScore,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ examId, results, overallScore });
  } catch (error) {
    console.error("Error evaluating exam:", error);
    return NextResponse.json({ error: "Failed to evaluate exam" }, { status: 500 });
  }
}
