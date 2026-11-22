import { redirect } from "next/navigation";
import { getCurrentUser, getDailyUsage, isProUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { FREE_DAILY_LIMIT } from "@/lib/constants";
import { ReadingSetupClient } from "./reading-setup-client";
import type { CefrBand } from "@/lib/prompts/vocabulary";

const HISTORY_SIZE = 12;

export default async function ReadingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [usage, lists, sessions] = await Promise.all([
    getDailyUsage(user.id),
    prisma.vocabularyList.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { words: true } } },
    }),
    prisma.readingSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_SIZE,
      include: {
        reading: { select: { title: true, level: true, topic: true } },
        _count: { select: { lookups: true } },
      },
    }),
  ]);

  return (
    <ReadingSetupClient
      isPro={isProUser(user)}
      readingsToday={usage.readingCount}
      canStart={usage.canTakeReading}
      freeLimit={FREE_DAILY_LIMIT.reading}
      lists={lists.map((l) => ({ id: l.id, name: l.name, emoji: l.emoji, color: l.color, wordCount: l._count.words }))}
      history={sessions.map((s) => ({
        id: s.id,
        title: s.reading.title,
        level: s.reading.level as CefrBand,
        topic: s.reading.topic,
        score: s.score,
        total: s.total,
        completed: s.completedAt !== null,
        lookups: s._count.lookups,
        createdAt: s.createdAt.toISOString(),
      }))}
    />
  );
}
