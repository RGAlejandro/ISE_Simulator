import { redirect } from "next/navigation";
import { getCurrentUser, getDailyUsage } from "@/lib/user";
import { EXAM_LEVELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const usage = await getDailyUsage(user.id);

  const [recentWritten, recentOral, totalWritten, totalOral] = await Promise.all([
    prisma.writtenExam.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.oralExam.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.writtenExam.count({ where: { userId: user.id } }),
    prisma.oralExam.count({ where: { userId: user.id } }),
  ]);

  const recentExams = [
    ...recentWritten.map((e: typeof recentWritten[number]) => ({
      id: e.id,
      type: "written" as const,
      level: e.level,
      status: e.status,
      score: e.score,
      createdAt: e.createdAt.toISOString(),
    })),
    ...recentOral.map((e: typeof recentOral[number]) => ({
      id: e.id,
      type: "oral" as const,
      level: e.level,
      status: e.status,
      score: e.overallScore,
      createdAt: e.createdAt.toISOString(),
    })),
  ]
    .sort((a: { createdAt: string }, b: { createdAt: string }) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <DashboardClient
      user={{ name: user.name, email: user.email, plan: user.plan }}
      usage={usage}
      recentExams={recentExams}
      totalExams={totalWritten + totalOral}
      levels={EXAM_LEVELS as unknown as Array<{ value: string; label: string; cefr: string; color: string }>}
    />
  );
}
