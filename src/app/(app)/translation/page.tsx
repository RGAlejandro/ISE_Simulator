import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getDailyUsage, isProUser } from "@/lib/user";
import type { TranslationResult } from "@/lib/translation";
import { TranslationHomeClient } from "./translation-home-client";

export const metadata = { title: "Translation — ISE Simulator" };

export default async function TranslationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [usage, sessions] = await Promise.all([
    getDailyUsage(user.id),
    prisma.translationSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, level: true, items: true, answers: true, score: true, completedAt: true, createdAt: true },
    }),
  ]);

  return (
    <TranslationHomeClient
      isPro={isProUser(user)}
      canStart={usage.canTakeTranslation}
      defaultLevel={user.examLevel}
      rounds={sessions.map((s) => ({
        id: s.id,
        level: s.level,
        total: Array.isArray(s.items) ? s.items.length : 0,
        done: Object.keys((s.answers ?? {}) as unknown as Record<string, TranslationResult>).length,
        score: s.score,
        completed: !!s.completedAt,
        createdAt: s.createdAt.toISOString(),
      }))}
    />
  );
}
