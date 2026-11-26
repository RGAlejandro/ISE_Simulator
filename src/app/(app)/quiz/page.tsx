import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isProUser } from "@/lib/user";
import { QUIZ_SOURCES, QUIZ_TYPE, isMastered, type QuizSource } from "@/lib/quiz";
import { canStartQuiz, loadMastery, loadQuizSeeds } from "@/lib/quiz-server";
import { QuizHomeClient } from "./quiz-home-client";

export const metadata = { title: "Quiz — ISE Simulator" };

export default async function QuizPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const isPro = isProUser(user);

  const [seeds, mastery, canStart, quizzes] = await Promise.all([
    loadQuizSeeds(user.id),
    loadMastery(user.id),
    canStartQuiz(user.id, isPro),
    prisma.grammarSession.findMany({
      where: { userId: user.id, exerciseType: QUIZ_TYPE },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, questions: true, responses: true, score: true, completedAt: true, createdAt: true },
    }),
  ]);

  const pending = Object.fromEntries(QUIZ_SOURCES.map((s) => [s, 0])) as Record<QuizSource, number>;
  let mastered = 0;
  for (const s of seeds) {
    if (isMastered(mastery.get(s.key))) mastered++;
    else pending[s.source]++;
  }

  return (
    <QuizHomeClient
      pending={pending}
      mastered={mastered}
      canStart={canStart}
      isPro={isPro}
      history={quizzes.map((q) => ({
        id: q.id,
        total: Array.isArray(q.questions) ? q.questions.length : 0,
        answered: Object.keys((q.responses ?? {}) as Record<string, number>).length,
        score: q.score,
        completed: !!q.completedAt,
        createdAt: q.createdAt.toISOString(),
      }))}
    />
  );
}
