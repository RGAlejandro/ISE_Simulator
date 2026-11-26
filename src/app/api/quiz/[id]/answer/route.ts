import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { QUIZ_TYPE, isMastered, reveal, type QuizQuestion } from "@/lib/quiz";
import { loadMastery } from "@/lib/quiz-server";

/** Answer one question: stores the choice and returns the correction. Answers are final. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const session = await prisma.grammarSession.findUnique({ where: { id } });
    if (!session || session.userId !== user.id || session.exerciseType !== QUIZ_TYPE) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { qid?: unknown; choice?: unknown };
    const questions = session.questions as unknown as QuizQuestion[];
    const q = questions.find((x) => x.id === body.qid);
    const choice = typeof body.choice === "number" ? body.choice : NaN;
    if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.options.length) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const responses = (session.responses ?? {}) as Record<string, number>;
    // Already answered: the first answer stands.
    const chosen = typeof responses[q.id] === "number" ? responses[q.id] : choice;
    const next = { ...responses, [q.id]: chosen };
    const done = questions.every((x) => typeof next[x.id] === "number");
    const score = done ? questions.filter((x) => next[x.id] === x.answer).length : null;

    if (typeof responses[q.id] !== "number") {
      await prisma.grammarSession.update({
        where: { id },
        data: { responses: next, ...(done ? { score, completedAt: new Date() } : {}) },
      });
    }

    let mastered: number | null = null;
    if (done) {
      const mastery = await loadMastery(user.id);
      mastered = questions.filter((x) => isMastered(mastery.get(x.key))).length;
    }
    return NextResponse.json({ reveal: reveal(q, chosen), done, score, mastered });
  } catch (err) {
    console.error("[quiz] answer error:", err);
    return NextResponse.json({ error: "Failed to check the answer" }, { status: 500 });
  }
}
