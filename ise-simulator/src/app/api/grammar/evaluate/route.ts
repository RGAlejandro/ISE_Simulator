import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateJSON } from "@/lib/gemini";
import { evaluateGrammarPrompt } from "@/lib/prompts/grammar";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import type { CefrLevel, GrammarExerciseType, GrammarQuestion, GrammarQuestionResult } from "@/types";

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/['']/g, "'");
}

function checkAnswer(question: GrammarQuestion, userAnswer: string): boolean {
  if (question.type === "mcq") {
    return parseInt(userAnswer, 10) === question.correctAnswer;
  }
  return normalize(userAnswer) === normalize(question.correctAnswer);
}

export async function POST(req: Request) {
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
    const { sessionId, answers } = body as { sessionId: string; answers: Record<string, string> };

    if (!sessionId || typeof answers !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const session = await prisma.grammarSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.completedAt) {
      return NextResponse.json({ feedback: session.feedback, score: session.score });
    }

    const questions = session.questions as unknown as GrammarQuestion[];

    const partialResults = questions.map((q) => {
      const userAnswer = answers[q.id] ?? "";
      const isCorrect = checkAnswer(q, userAnswer);
      const correctAnswer = q.type === "mcq"
        ? q.options[q.correctAnswer]
        : q.correctAnswer;
      return { questionId: q.id, isCorrect, userAnswer, correctAnswer };
    });

    const score = partialResults.filter((r) => r.isCorrect).length;

    const explanationPrompt = evaluateGrammarPrompt(
      session.cefrLevel as CefrLevel,
      session.exerciseType as GrammarExerciseType,
      questions,
      partialResults
    );
    const explanationData = await generateJSON(explanationPrompt, { temperature: 0.4 });

    const explanationMap: Record<string, string> = {};
    if (Array.isArray(explanationData?.explanations)) {
      for (const e of explanationData.explanations) {
        if (typeof e?.questionId === "string" && typeof e?.explanation === "string") {
          explanationMap[e.questionId] = e.explanation;
        }
      }
    }

    const feedback: GrammarQuestionResult[] = partialResults.map((r) => ({
      ...r,
      explanation: explanationMap[r.questionId] ?? (r.isCorrect ? "Correct!" : "Incorrect — review this grammar point."),
    }));

    await prisma.grammarSession.update({
      where: { id: sessionId },
      data: {
        responses: answers,
        feedback: JSON.parse(JSON.stringify(feedback)),
        score,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ feedback, score });
  } catch (err) {
    console.error("Grammar evaluate error:", err);
    return NextResponse.json({ error: "Failed to evaluate answers" }, { status: 500 });
  }
}
