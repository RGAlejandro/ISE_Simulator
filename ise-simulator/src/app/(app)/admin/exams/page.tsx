import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ExamsClient } from "./exams-client";

const LEVELS = ["ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"] as const;

export default async function AdminExamsPage() {
  await getAdminUser();

  const [
    writtenByLevel,
    oralByLevel,
    listeningByLevel,
    writtenStatus,
    oralStatus,
    listeningStatus,
    writtenAvg,
    oralAvg,
    listeningAvg,
    recentWritten,
    recentOral,
    recentListening,
  ] = await Promise.all([
    prisma.writtenExam.groupBy({ by: ["level"], _count: { _all: true }, _avg: { score: true } }),
    prisma.oralExam.groupBy({ by: ["level"], _count: { _all: true }, _avg: { overallScore: true } }),
    prisma.listeningSession.groupBy({ by: ["level"], _count: { _all: true }, _avg: { overallScore: true } }),
    prisma.writtenExam.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.oralExam.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.listeningSession.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.writtenExam.aggregate({ _avg: { score: true } }),
    prisma.oralExam.aggregate({ _avg: { overallScore: true } }),
    prisma.listeningSession.aggregate({ _avg: { overallScore: true } }),
    prisma.writtenExam.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, level: true, status: true, score: true, createdAt: true, user: { select: { email: true, name: true } } },
    }),
    prisma.oralExam.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, level: true, status: true, overallScore: true, createdAt: true, user: { select: { email: true, name: true } } },
    }),
    prisma.listeningSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, level: true, status: true, overallScore: true, createdAt: true, user: { select: { email: true, name: true } } },
    }),
  ]);

  const byLevel = LEVELS.map(lvl => ({
    level: lvl,
    written:   writtenByLevel.find(r => r.level === lvl)?._count._all   ?? 0,
    oral:      oralByLevel.find(r => r.level === lvl)?._count._all      ?? 0,
    listening: listeningByLevel.find(r => r.level === lvl)?._count._all ?? 0,
    avgWritten:   writtenByLevel.find(r => r.level === lvl)?._avg.score        ?? null,
    avgOral:      oralByLevel.find(r => r.level === lvl)?._avg.overallScore    ?? null,
    avgListening: listeningByLevel.find(r => r.level === lvl)?._avg.overallScore ?? null,
  }));

  const statusFor = (groups: { status: string; _count: { _all: number } }[]) => ({
    IN_PROGRESS: groups.find(g => g.status === "IN_PROGRESS")?._count._all ?? 0,
    COMPLETED:   groups.find(g => g.status === "COMPLETED")?._count._all   ?? 0,
    EVALUATED:   groups.find(g => g.status === "EVALUATED")?._count._all   ?? 0,
  });

  const recent = [
    ...recentWritten.map(r => ({ id: r.id, kind: "written" as const, level: r.level, status: r.status, score: r.score, createdAt: r.createdAt.toISOString(), userEmail: r.user.email, userName: r.user.name })),
    ...recentOral.map(r => ({ id: r.id, kind: "oral" as const, level: r.level, status: r.status, score: r.overallScore, createdAt: r.createdAt.toISOString(), userEmail: r.user.email, userName: r.user.name })),
    ...recentListening.map(r => ({ id: r.id, kind: "listening" as const, level: r.level, status: r.status, score: r.overallScore, createdAt: r.createdAt.toISOString(), userEmail: r.user.email, userName: r.user.name })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 15);

  return (
    <ExamsClient
      byLevel={byLevel}
      status={{
        written:   statusFor(writtenStatus),
        oral:      statusFor(oralStatus),
        listening: statusFor(listeningStatus),
      }}
      averages={{
        written:   writtenAvg._avg.score          ?? null,
        oral:      oralAvg._avg.overallScore      ?? null,
        listening: listeningAvg._avg.overallScore ?? null,
      }}
      recent={recent}
    />
  );
}
