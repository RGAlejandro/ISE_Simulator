import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { nextReview } from "@/lib/srs";

const SESSION_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Record one spaced-repetition answer. Only the first answer for a word in a
 * session moves it between boxes — retries of missed words within the same
 * session are practice and don't count (nor earn XP).
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { wordId, correct, sessionKey } = (await req.json()) as {
      wordId?: string; correct?: boolean; sessionKey?: string;
    };
    if (!wordId || typeof correct !== "boolean" || !sessionKey || !SESSION_KEY_RE.test(sessionKey)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const word = await prisma.savedWord.findUnique({ where: { id: wordId } });
    if (!word || word.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const already = await prisma.reviewLog.findFirst({
      where: { userId: user.id, wordId, sessionKey },
      select: { id: true },
    });
    if (already) {
      return NextResponse.json({ box: word.srsBox, dueAt: word.dueAt.toISOString(), counted: false });
    }

    const { box, dueAt } = nextReview(word.srsBox, correct);
    await prisma.$transaction([
      prisma.savedWord.update({
        where: { id: word.id },
        data: {
          srsBox: box,
          dueAt,
          lastReviewedAt: new Date(),
          reviewCount: { increment: 1 },
          ...(correct ? {} : { lapses: { increment: word.srsBox > 0 ? 1 : 0 } }),
        },
      }),
      prisma.reviewLog.create({ data: { userId: user.id, wordId: word.id, sessionKey, correct, box } }),
    ]);

    return NextResponse.json({ box, dueAt: dueAt.toISOString(), counted: true });
  } catch (err) {
    console.error("Review answer error:", err);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}
