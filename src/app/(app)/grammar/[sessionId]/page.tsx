import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { GrammarSessionClient } from "./grammar-session-client";
import type { GrammarQuestion, GrammarQuestionResult, CefrLevel, GrammarExerciseType } from "@/types";

type ClientQuestion = {
  id: string;
  type: string;
  sentence?: string;
  question?: string;
  options?: string[];
  hint?: string;
};

function toClientQuestion(q: GrammarQuestion): ClientQuestion {
  const base = { id: q.id, type: q.type };
  if (q.type === "gap_fill") return { ...base, sentence: q.sentence, hint: q.hint };
  if (q.type === "mcq") return { ...base, question: q.question, options: q.options };
  return { ...base, sentence: q.sentence };
}

export default async function GrammarSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const session = await prisma.grammarSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id) notFound();

  const questions = (session.questions as unknown as GrammarQuestion[]).map(toClientQuestion);
  const feedback = session.feedback ? (session.feedback as unknown as GrammarQuestionResult[]) : null;

  return (
    <GrammarSessionClient
      sessionId={session.id}
      cefrLevel={session.cefrLevel as CefrLevel}
      exerciseType={session.exerciseType as GrammarExerciseType}
      questions={questions}
      initialFeedback={feedback}
      initialScore={session.score}
    />
  );
}
