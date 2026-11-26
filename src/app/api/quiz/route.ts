import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeAiAssist, getCurrentUser, isProUser } from "@/lib/user";
import { cefrFor } from "@/lib/teacher-server";
import { QUIZ_MIN, QUIZ_SIZE, QUIZ_SPARES, QUIZ_TYPE, pickSeeds, type QuizQuestion, type QuizSeed } from "@/lib/quiz";
import { canStartQuiz, loadMastery, loadQuizSeeds, loadWordPool, vocabQuestion, writeQuestions } from "@/lib/quiz-server";

/** Create a quiz from the learner's own mistakes. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isPro = isProUser(user);
    const body = (await req.json().catch(() => ({}))) as { locale?: unknown };
    const locale = typeof body.locale === "string" ? body.locale : "es";

    if (!(await canStartQuiz(user.id, isPro))) {
      return NextResponse.json({ error: "limit", code: "DAILY_LIMIT" }, { status: 429 });
    }

    const [seeds, mastery, pool] = await Promise.all([loadQuizSeeds(user.id), loadMastery(user.id), loadWordPool(user.id)]);
    const picked = pickSeeds(seeds, mastery, QUIZ_SIZE + QUIZ_SPARES);
    if (picked.length === 0) return NextResponse.json({ error: "No mistakes yet", code: "NO_MISTAKES" }, { status: 409 });

    // Vocabulary questions are built here; the rest are written by the model in one call.
    const made = new Map<string, Omit<QuizQuestion, "id">>();
    for (const s of picked) {
      if (s.source !== "vocab") continue;
      const q = vocabQuestion(s, pool, locale);
      if (q) made.set(s.key, q);
    }
    const forAi = picked.filter((s): s is Exclude<QuizSeed, { source: "vocab" }> => s.source !== "vocab");
    if (forAi.length > 0) {
      if (!(await consumeAiAssist(user.id, isPro))) {
        return NextResponse.json({ error: "limit", code: "AI_LIMIT" }, { status: 429 });
      }
      for (const q of await writeQuestions(forAi, cefrFor(user.examLevel), locale)) made.set(q.key, q);
    }

    // Keep the mixed order the picker chose; spares only fill the gaps.
    const questions: QuizQuestion[] = picked
      .map((s) => made.get(s.key))
      .filter((q): q is Omit<QuizQuestion, "id"> => !!q)
      .slice(0, QUIZ_SIZE)
      .map((q, i) => ({ id: `q${i + 1}`, ...q }));
    if (questions.length < Math.min(QUIZ_MIN, picked.length)) {
      return NextResponse.json({ error: "Couldn't prepare the quiz", code: "generate" }, { status: 503 });
    }

    const session = await prisma.grammarSession.create({
      data: {
        userId: user.id,
        cefrLevel: cefrFor(user.examLevel),
        exerciseType: QUIZ_TYPE,
        questions: JSON.parse(JSON.stringify(questions)),
        responses: {},
      },
    });
    return NextResponse.json({ id: session.id });
  } catch (err) {
    console.error("[quiz] create error:", err);
    return NextResponse.json({ error: "Couldn't prepare the quiz", code: "generate" }, { status: 500 });
  }
}
