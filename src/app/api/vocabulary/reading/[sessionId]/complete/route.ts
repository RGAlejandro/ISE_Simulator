import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { awardXp, type AwardResult } from "@/lib/gamification-server";
import { gradeAnswers } from "@/lib/reading";
import type { ReadingAnswer, ReadingContent } from "@/types";

/**
 * Grade the quiz server-side and store the result. Only the first completion
 * counts (and awards XP); later calls return the stored result.
 */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { sessionId } = await params;
    const session = await prisma.readingSession.findUnique({
      where: { id: sessionId },
      include: { reading: { select: { content: true } } },
    });
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (session.completedAt) {
      return NextResponse.json({ score: session.score, total: session.total, award: null, alreadyCompleted: true });
    }

    const { questions } = session.reading.content as unknown as ReadingContent;
    const body = await req.json();
    const raw = (body as { answers?: unknown }).answers;
    if (!Array.isArray(raw) || raw.length !== questions.length) {
      return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
    }
    const answers: ReadingAnswer[] = raw.map((a) =>
      typeof a === "number" && Number.isInteger(a) ? a : typeof a === "string" ? a.slice(0, 80) : null,
    );

    const score = gradeAnswers(questions, answers);
    const total = questions.length;

    // completedAt: null in the filter makes completion (and the XP award) happen once.
    const { count } = await prisma.readingSession.updateMany({
      where: { id: sessionId, completedAt: null },
      data: { answers, score, total, completedAt: new Date() },
    });
    if (count === 0) {
      const done = await prisma.readingSession.findUnique({ where: { id: sessionId } });
      return NextResponse.json({ score: done?.score ?? score, total: done?.total ?? total, award: null, alreadyCompleted: true });
    }

    let award: AwardResult | null = null;
    try {
      award = await awardXp(user.id, { correct: score, total, countsAsQuest: false });
    } catch (err) {
      console.error("Reading XP award error:", err);
    }

    return NextResponse.json({ score, total, award });
  } catch (err) {
    console.error("Reading complete error:", err);
    return NextResponse.json({ error: "Failed to save results" }, { status: 500 });
  }
}
