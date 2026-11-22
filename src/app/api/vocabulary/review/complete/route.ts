import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { awardXp, type AwardResult } from "@/lib/gamification-server";

/**
 * Finish a review session: XP is computed server-side from the session's
 * logged first answers, and each log is only ever rewarded once.
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { sessionKey } = (await req.json()) as { sessionKey?: string };
    if (!sessionKey) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const logs = await prisma.reviewLog.findMany({
      where: { userId: user.id, sessionKey, xpAwarded: false },
      select: { id: true, correct: true },
    });
    if (logs.length === 0) return NextResponse.json({ correct: 0, total: 0, award: null });

    // Claim the logs first so a concurrent call can't reward them twice.
    const { count } = await prisma.reviewLog.updateMany({
      where: { id: { in: logs.map((l) => l.id) }, xpAwarded: false },
      data: { xpAwarded: true },
    });
    if (count !== logs.length) return NextResponse.json({ correct: 0, total: 0, award: null });

    const correct = logs.filter((l) => l.correct).length;
    let award: AwardResult | null = null;
    try {
      award = await awardXp(user.id, { correct, total: logs.length, countsAsQuest: false });
    } catch (err) {
      console.error("[review] XP award failed:", err);
    }
    return NextResponse.json({ correct, total: logs.length, award });
  } catch (err) {
    console.error("Review complete error:", err);
    return NextResponse.json({ error: "Failed to finish the review" }, { status: 500 });
  }
}
