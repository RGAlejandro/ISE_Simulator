import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/ai-provider";
import { getEvaluateWritingPrompt, getReadingExplanationsPrompt } from "@/lib/prompts/written-exam";
import { getCurrentUser } from "@/lib/user";
import type { ExamLevel, WrittenExamContent, ReadingQuestionResult } from "@/types";

const isPro = (plan: string) => plan === "PRO" || plan === "ADMIN";

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const userIsPro = isPro(user.plan);

    const body = await req.json();
    const { examId, responses, readingAnswers } = body;

    if (!examId) return NextResponse.json({ error: "Exam ID required" }, { status: 400 });

    const exam = await prisma.writtenExam.findUnique({
      where: { id: examId, userId: user.id },
    });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const examContent = exam.content as unknown as WrittenExamContent;
    const results: Record<string, unknown> = {};

    // ═══════════════════════════════════════════════════════════════
    // SCORE READING — build per-question breakdown
    // ═══════════════════════════════════════════════════════════════
    const r1Questions: ReadingQuestionResult[] = [];
    const r2Questions: ReadingQuestionResult[] = [];

    // ── R1 Q1-5: Paragraph Matching ──
    const pmCorrect = examContent.reading1.paragraphMatching.correctAnswers;
    for (let i = 0; i < 5; i++) {
      const ua = (readingAnswers?.[`pm_${i + 1}`] || "").toString().toUpperCase().trim();
      const ca = (pmCorrect[i] || "").toUpperCase();
      r1Questions.push({
        num: i + 1,
        type: "paragraph_matching",
        userAnswer: ua,
        correctAnswer: ca,
        isCorrect: !!ua && ua === ca,
        context: `Paragraph ${examContent.reading1.paragraphs[i]?.number ?? i + 1} → which summary (A–F)?`,
      });
    }

    // ── R1 Q6-10: Statement Selection (5 from A-H true) ──
    const r1SsCorrect = examContent.reading1.statementSelection.correctAnswers;
    const r1SsUser = ((readingAnswers?.["r1_ss"] || []) as string[]).map(s => s.toUpperCase());
    const r1SsCorrectUp = r1SsCorrect.map(s => s.toUpperCase());
    for (let i = 0; i < r1SsCorrectUp.length; i++) {
      const letter = r1SsCorrectUp[i];
      const got = r1SsUser.includes(letter);
      const stmt = examContent.reading1.statementSelection.statements.find(s => s.letter.toUpperCase() === letter);
      r1Questions.push({
        num: 6 + i,
        type: "statement_selection",
        userAnswer: r1SsUser.join(", ") || "(none)",
        correctAnswer: letter,
        isCorrect: got,
        context: stmt ? `TRUE statement: ${stmt.text}` : `Statement ${letter}`,
      });
    }

    // ── R1 Q11-15: Gap Fill ──
    for (let i = 0; i < examContent.reading1.gapFill.questions.length; i++) {
      const q = examContent.reading1.gapFill.questions[i];
      const ua = ((readingAnswers?.[q.id] as string) || "").toLowerCase().trim();
      const ca = q.correctAnswer.toLowerCase().trim();
      r1Questions.push({
        num: 11 + i,
        type: "gap_fill",
        userAnswer: ua,
        correctAnswer: q.correctAnswer,
        isCorrect: !!ua && ua === ca,
        context: q.sentence,
      });
    }

    // ── R2 Q16-20: Text Matching ──
    const tmCorrect = examContent.reading2.textMatching.correctAnswers;
    const tmQs = examContent.reading2.textMatching.questions;
    for (let i = 0; i < tmQs.length; i++) {
      const ua = ((readingAnswers?.[tmQs[i].id] as string) || "").toUpperCase().trim();
      const ca = (tmCorrect[i] || "").toUpperCase();
      r2Questions.push({
        num: 16 + i,
        type: "text_matching",
        userAnswer: ua,
        correctAnswer: ca,
        isCorrect: !!ua && ua === ca,
        context: tmQs[i].statement,
      });
    }

    // ── R2 Q21-25: Statement Selection ──
    const r2SsCorrect = examContent.reading2.statementSelection.correctAnswers;
    const r2SsUser = ((readingAnswers?.["r2_ss"] || []) as string[]).map(s => s.toUpperCase());
    const r2SsCorrectUp = r2SsCorrect.map(s => s.toUpperCase());
    for (let i = 0; i < r2SsCorrectUp.length; i++) {
      const letter = r2SsCorrectUp[i];
      const got = r2SsUser.includes(letter);
      const stmt = examContent.reading2.statementSelection.statements.find(s => s.letter.toUpperCase() === letter);
      r2Questions.push({
        num: 21 + i,
        type: "statement_selection",
        userAnswer: r2SsUser.join(", ") || "(none)",
        correctAnswer: letter,
        isCorrect: got,
        context: stmt ? `TRUE statement: ${stmt.text}` : `Statement ${letter}`,
      });
    }

    // ── R2 Q26-30: Gap Fill ──
    for (let i = 0; i < examContent.reading2.gapFill.questions.length; i++) {
      const q = examContent.reading2.gapFill.questions[i];
      const ua = ((readingAnswers?.[q.id] as string) || "").toLowerCase().trim();
      const ca = q.correctAnswer.toLowerCase().trim();
      r2Questions.push({
        num: 26 + i,
        type: "gap_fill",
        userAnswer: ua,
        correctAnswer: q.correctAnswer,
        isCorrect: !!ua && ua === ca,
        context: q.sentence,
      });
    }

    // ── Generate AI explanations for wrong answers (Pro/Admin only) ──
    if (userIsPro) {
      const wrong = [...r1Questions, ...r2Questions].filter(q => !q.isCorrect);
      if (wrong.length > 0) {
        try {
          const explainPrompt = getReadingExplanationsPrompt(
            exam.level as ExamLevel,
            wrong.map(q => ({
              num: q.num,
              type: q.type,
              context: q.context ?? "",
              userAnswer: q.userAnswer,
              correctAnswer: q.correctAnswer,
            })),
          );
          const aiOut = await generateJSON(explainPrompt, { temperature: 0.3 }) as { explanations?: { num: number; explanation: string }[] };
          const explainMap = new Map<number, string>();
          for (const e of aiOut.explanations ?? []) explainMap.set(e.num, e.explanation);
          for (const arr of [r1Questions, r2Questions]) {
            for (const q of arr) {
              if (!q.isCorrect) q.explanation = explainMap.get(q.num) ?? null;
            }
          }
        } catch (err) {
          console.error("[reading-explanations]", err);
        }
      }
    }

    const r1Score = r1Questions.filter(q => q.isCorrect).length;
    const r2Score = r2Questions.filter(q => q.isCorrect).length;
    const readingScore = r1Score + r2Score;
    const totalReadingQuestions = 30;

    results.reading = {
      score: readingScore,
      total: totalReadingQuestions,
      percentage: Math.round((readingScore / totalReadingQuestions) * 100),
      reading1Score: r1Score,
      reading2Score: r2Score,
    };

    // Persist reading feedback with per-question breakdown
    await prisma.writtenResponse.createMany({
      data: [
        {
          examId,
          taskType: "READING_1",
          taskNumber: 1,
          response: JSON.stringify(readingAnswers),
          aiFeedback: JSON.stringify({
            score: r1Score,
            total: 15,
            percentage: Math.round((r1Score / 15) * 100),
            questions: r1Questions,
          }),
          score: r1Score,
        },
        {
          examId,
          taskType: "READING_2",
          taskNumber: 2,
          response: JSON.stringify(readingAnswers),
          aiFeedback: JSON.stringify({
            score: r2Score,
            total: 15,
            percentage: Math.round((r2Score / 15) * 100),
            questions: r2Questions,
          }),
          score: r2Score,
        },
      ],
    });

    // ═══════════════════════════════════════════════════════════════
    // EVALUATE WRITINGS WITH AI
    // ═══════════════════════════════════════════════════════════════
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
          userResponse,
        );
        const feedback = await generateJSON(evaluationPrompt, { temperature: 0.3 });

        await prisma.writtenResponse.create({
          data: {
            examId,
            taskType: task.key as "READING_INTO_WRITING" | "EXTENDED_WRITING",
            taskNumber: task.taskNum,
            response: userResponse,
            aiFeedback: userIsPro ? JSON.stringify(feedback) : null,
            score: feedback.score,
          },
        });

        results[task.key] = userIsPro ? feedback : { score: feedback.score, band: feedback.band };
      }
    }

    // Overall score = avg(reading%, writing%)
    const writingScores = writingTasks
      .map((t) => {
        const r = results[t.key] as { score?: number } | undefined;
        return r?.score ?? 0;
      });
    const avgWritingScore = writingScores.reduce((a, b) => a + b, 0) / writingScores.length;
    const readingPct = (results.reading as { percentage: number }).percentage;
    const overallScore = Math.round((readingPct * 0.5) + (avgWritingScore * 2.5));

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
