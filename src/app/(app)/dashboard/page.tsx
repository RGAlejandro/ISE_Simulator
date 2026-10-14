import { redirect } from "next/navigation";
import { getCurrentUser, getDailyUsage } from "@/lib/user";
import { EXAM_LEVELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUTC(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const usage = await getDailyUsage(user.id);
  const now = new Date();
  const since14 = new Date(now.getTime() - 14 * DAY_MS);

  const [recentWritten, recentOral, totalWritten, totalOral, scoredWritten, scoredOral, activity14] = await Promise.all([
    prisma.writtenExam.findMany({
      where: { userId: user.id, hiddenAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.oralExam.findMany({
      where: { userId: user.id, hiddenAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.writtenExam.count({ where: { userId: user.id, hiddenAt: null } }),
    prisma.oralExam.count({ where: { userId: user.id, hiddenAt: null } }),
    prisma.writtenExam.findMany({
      where: { userId: user.id, hiddenAt: null, score: { not: null } },
      select: { score: true },
    }),
    prisma.oralExam.findMany({
      where: { userId: user.id, hiddenAt: null, overallScore: { not: null } },
      select: { overallScore: true },
    }),
    prisma.writtenExam.findMany({
      where: { userId: user.id, hiddenAt: null, createdAt: { gte: since14 } },
      select: { createdAt: true },
    }).then(async writtens => {
      const orals = await prisma.oralExam.findMany({
        where: { userId: user.id, hiddenAt: null, createdAt: { gte: since14 } },
        select: { createdAt: true },
      });
      return [...writtens, ...orals];
    }),
  ]);

  // 14-day activity buckets
  const buckets: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    buckets.push({ date: startOfDayUTC(new Date(now.getTime() - i * DAY_MS)).toISOString().slice(0, 10), count: 0 });
  }
  for (const e of activity14) {
    const k = startOfDayUTC(e.createdAt).toISOString().slice(0, 10);
    const b = buckets.find(x => x.date === k);
    if (b) b.count++;
  }

  // Streak: consecutive days w/ activity, from today backwards
  let streak = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i].count > 0) streak++;
    else break;
  }

  const allScores = [
    ...scoredWritten.map(w => w.score!),
    ...scoredOral.map(o => o.overallScore!),
  ];
  const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : null;

  const recentExams = [
    ...recentWritten.map(e => ({
      id: e.id, type: "written" as const, level: e.level, status: e.status,
      score: e.score, createdAt: e.createdAt.toISOString(),
    })),
    ...recentOral.map(e => ({
      id: e.id, type: "oral" as const, level: e.level, status: e.status,
      score: e.overallScore, createdAt: e.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <DashboardClient
      user={{ name: user.name, email: user.email, plan: user.plan }}
      usage={usage}
      recentExams={recentExams}
      totalExams={totalWritten + totalOral}
      levels={EXAM_LEVELS as unknown as Array<{ value: string; label: string; cefr: string; color: string }>}
      isPro={user.plan === "PRO" || user.plan === "ADMIN"}
      stats={{
        avgScore,
        bestScore,
        streak,
        activity14: buckets,
        last7Count: buckets.slice(-7).reduce((a, b) => a + b.count, 0),
        evaluatedCount: allScores.length,
      }}
    />
  );
}
