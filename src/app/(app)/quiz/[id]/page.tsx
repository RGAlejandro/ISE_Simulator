import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isProUser } from "@/lib/user";
import { QUIZ_TYPE, isMastered, reveal, toClientQuestion, type QuizQuestion, type QuizReveal } from "@/lib/quiz";
import { canStartQuiz, loadMastery } from "@/lib/quiz-server";
import { QuizClient } from "./quiz-client";

export const metadata = { title: "Quiz — ISE Simulator" };

export default async function QuizSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const session = await prisma.grammarSession.findUnique({ where: { id } });
  if (!session || session.userId !== user.id || session.exerciseType !== QUIZ_TYPE) notFound();

  const questions = session.questions as unknown as QuizQuestion[];
  const responses = (session.responses ?? {}) as Record<string, number>;
  const reveals: Record<string, QuizReveal> = {};
  for (const q of questions) if (typeof responses[q.id] === "number") reveals[q.id] = reveal(q, responses[q.id]);

  let mastered: number | null = null;
  if (session.completedAt) {
    const mastery = await loadMastery(user.id);
    mastered = questions.filter((q) => isMastered(mastery.get(q.key))).length;
  }

  return (
    <QuizClient
      id={session.id}
      questions={questions.map(toClientQuestion)}
      initialReveals={reveals}
      initialMastered={mastered}
      canStartAnother={await canStartQuiz(user.id, isProUser(user))}
    />
  );
}
