import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { OverviewClient } from "./overview-client";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUTC(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export default async function AdminOverviewPage() {
  await getAdminUser();

  const now = new Date();
  const since7  = new Date(now.getTime() - 7  * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);

  const [
    totalUsers,
    proUsers,
    adminUsers,
    totalWritten,
    totalOral,
    totalListening,
    totalGrammar,
    totalSavedWords,
    totalVocabLists,
    written7,
    oral7,
    listening7,
    grammar7,
    signups30,
    distinctActive7,
    planGroups,
    writtenByLevel,
    oralByLevel,
    listeningByLevel,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: "PRO", subscription: { status: "ACTIVE" } } }),
    prisma.user.count({ where: { plan: "ADMIN" } }),
    prisma.writtenExam.count(),
    prisma.oralExam.count(),
    prisma.listeningSession.count(),
    prisma.grammarSession.count(),
    prisma.savedWord.count(),
    prisma.vocabularyList.count(),
    prisma.writtenExam.count({ where: { createdAt: { gte: since7 } } }),
    prisma.oralExam.count({ where: { createdAt: { gte: since7 } } }),
    prisma.listeningSession.count({ where: { createdAt: { gte: since7 } } }),
    prisma.grammarSession.count({ where: { createdAt: { gte: since7 } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: since30 } },
      select: { createdAt: true },
    }),
    prisma.dailyUsage.findMany({
      where: { date: { gte: since7 } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.writtenExam.groupBy({ by: ["level"], _count: { _all: true } }),
    prisma.oralExam.groupBy({ by: ["level"], _count: { _all: true } }),
    prisma.listeningSession.groupBy({ by: ["level"], _count: { _all: true } }),
  ]);

  // Signups bucketed by day (last 30 days)
  const buckets: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = startOfDayUTC(new Date(now.getTime() - i * DAY_MS));
    buckets.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  for (const s of signups30) {
    const key = startOfDayUTC(s.createdAt).toISOString().slice(0, 10);
    const b = buckets.find(x => x.date === key);
    if (b) b.count++;
  }

  // Plan distribution
  const planDist = {
    FREE:  planGroups.find(p => p.plan === "FREE")?._count._all  ?? 0,
    PRO:   planGroups.find(p => p.plan === "PRO")?._count._all   ?? 0,
    ADMIN: planGroups.find(p => p.plan === "ADMIN")?._count._all ?? 0,
  };

  // Exams by level (combined)
  const LEVELS = ["ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"] as const;
  const examsByLevel = LEVELS.map(lvl => ({
    level: lvl,
    written:   writtenByLevel.find(r => r.level === lvl)?._count._all   ?? 0,
    oral:      oralByLevel.find(r => r.level === lvl)?._count._all      ?? 0,
    listening: listeningByLevel.find(r => r.level === lvl)?._count._all ?? 0,
  }));

  return (
    <OverviewClient
      kpis={{
        totalUsers,
        proUsers,
        adminUsers,
        active7: distinctActive7.length,
        totalWritten,
        totalOral,
        totalListening,
        totalGrammar,
        totalSavedWords,
        totalVocabLists,
        activity7: written7 + oral7 + listening7 + grammar7,
      }}
      signups={buckets}
      planDist={planDist}
      examsByLevel={examsByLevel}
    />
  );
}
