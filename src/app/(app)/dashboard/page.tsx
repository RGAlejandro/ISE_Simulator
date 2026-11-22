import { redirect } from "next/navigation";
import { getCurrentUser, getDailyUsage } from "@/lib/user";
import { EXAM_LEVELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getLevelSpec } from "@/lib/prompts/written-exam";
import { SESSION_MAX_NEW } from "@/lib/srs";
import { daysUntil, leastPractisedGenre, phaseFor, startOfWeek, weeklyTargets } from "@/lib/study-plan";
import type { ExamPlanData } from "@/components/dashboard/exam-plan-card";
import type { ExamLevel, WritingTaskType } from "@/types";
import { DashboardClient } from "./dashboard-client";
import { getReadiness } from "@/lib/readiness-server";
import { getStudentAssignments } from "@/lib/teams-server";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUTC(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Countdown + weekly plan data; only queried once the learner has set an exam date. */
async function getExamPlan(user: { id: string; examDate: Date | null; examLevel: ExamLevel | null }): Promise<ExamPlanData> {
  const levels = EXAM_LEVELS.map((l) => ({ value: l.value as ExamLevel, label: `${l.label} (${l.cefr})` }));
  if (!user.examDate || !user.examLevel) return { goal: null, levels, plan: null };

  const now = new Date();
  const weekStart = startOfWeek(now);
  const level = user.examLevel;
  const spec = getLevelSpec(level);

  const [writingWeek, reviewLogs, readingWeek, oralWeek, mockWeek, dueReviews, newWords, firstDrafts, practised] = await Promise.all([
    prisma.writingDraft.count({ where: { version: 1, createdAt: { gte: weekStart }, practice: { userId: user.id } } }),
    prisma.reviewLog.findMany({ where: { userId: user.id, createdAt: { gte: weekStart } }, select: { createdAt: true } }),
    prisma.readingSession.count({ where: { userId: user.id, createdAt: { gte: weekStart } } }),
    prisma.oralExam.count({ where: { userId: user.id, createdAt: { gte: weekStart } } }),
    prisma.writtenExam.count({ where: { userId: user.id, createdAt: { gte: weekStart } } }),
    prisma.savedWord.count({ where: { userId: user.id, srsBox: { gt: 0 }, dueAt: { lte: now } } }),
    prisma.savedWord.count({ where: { userId: user.id, srsBox: 0 } }),
    prisma.writingDraft.findMany({
      where: { version: 1, practice: { userId: user.id, level } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { score: true },
    }),
    prisma.writingPractice.findMany({
      where: { userId: user.id, level, hiddenAt: null, drafts: { some: {} } },
      select: { genre: true, taskType: true },
    }),
  ]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const reviewDays = new Set(reviewLogs.map((l) => dayKey(l.createdAt)));

  const genreCounts: Record<string, number> = {};
  for (const p of practised) genreCounts[p.genre] = (genreCounts[p.genre] ?? 0) + 1;
  const task3Count = practised.filter((p) => p.taskType === "READING_INTO_WRITING").length;
  // Alternate task types: whichever has been practised less comes next.
  const suggestedType: WritingTaskType = task3Count < practised.length - task3Count ? "READING_INTO_WRITING" : "EXTENDED_WRITING";
  const genres = suggestedType === "READING_INTO_WRITING" ? spec.writingTypes.riw : spec.writingTypes.ew;
  const allGenres = new Set([...spec.writingTypes.riw, ...spec.writingTypes.ew]);

  const daysLeft = daysUntil(user.examDate, now);
  const phase = phaseFor(daysLeft);

  return {
    goal: { examDate: user.examDate.toISOString().slice(0, 10), examLevel: level },
    levels,
    plan: {
      daysLeft,
      phase,
      targets: weeklyTargets(phase, {
        writing: writingWeek,
        reviewDays: reviewDays.size,
        reading: readingWeek,
        oral: oralWeek,
        mock: mockWeek,
      }),
      dueToday: dueReviews + Math.min(newWords, SESSION_MAX_NEW),
      reviewedToday: reviewDays.has(dayKey(now)),
      suggestion: { taskType: suggestedType, genre: leastPractisedGenre(genres, genreCounts) },
      writingScores: firstDrafts.map((d) => d.score).reverse(),
      genresCovered: [...allGenres].filter((g) => genreCounts[g]).length,
      genresTotal: allGenres.size,
    },
  };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [usage, examPlan, readiness, assignments] = await Promise.all([
    getDailyUsage(user.id),
    getExamPlan(user),
    getReadiness(user.id),
    getStudentAssignments(user.id),
  ]);
  const readinessLevel = EXAM_LEVELS.find((l) => l.value === readiness.level);
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
      examPlan={examPlan}
      assignments={assignments}
      readiness={readiness.report && readinessLevel ? { report: readiness.report, levelLabel: `${readinessLevel.label} (${readinessLevel.cefr})` } : null}
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
