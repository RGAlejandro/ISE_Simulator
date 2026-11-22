import { prisma } from "@/lib/prisma";
import { getReadiness, loadReadinessEvidence } from "@/lib/readiness-server";
import { aggregateErrorTags } from "@/lib/writing";
import { LEARNED_BOX } from "@/lib/srs";
import { daysUntil, phaseFor, type PlanPhase } from "@/lib/study-plan";
import type { ExamLevel, WritingEvaluation } from "@/types";

/**
 * Compact, model-friendly summary of one learner's own data, injected into the
 * personal tutor's prompt. Numbers are rounded and lists capped so the whole
 * snapshot stays around 2k tokens.
 */
export interface TutorSnapshot {
  today: string;
  firstName: string | null;
  goal: { level: ExamLevel | null; examDate: string | null; daysLeft: number | null; phase: PlanPhase | null };
  readiness: null | {
    level: ExamLevel;
    passChancePercent: number;
    band: string;
    confidence: string;
    limitingSkill: string | null;
    markedAttempts: number;
    skills: { skill: string; score: number; band: string; passChancePercent: number; attempts: number; confidence: string; lastAt: string | null }[];
    weakestCriteria: { skill: string; criterion: string; percentOfMax: number; samples: number }[];
    projection: { readyNow: boolean; readyBy: string | null; trendPerWeekPoints: number | null; marginDays: number | null };
    activity: { lastAt: string | null; attemptsLast7Days: number };
  };
  recentAttempts: { date: string; skill: string; source: string; score: number }[];
  writingErrors: { textsAnalysed: number; top: { tag: string; count: number; examples: { wrote: string; better: string }[] }[] };
  vocabulary: {
    lists: { name: string; words: number }[];
    saved: number;
    dueForReviewToday: number;
    notStartedYet: number;
    learned: number;
    struggling: string[];
    alreadySaved: string[];
  };
}

const NOTEBOOK_TEXTS = 15;
const KNOWN_WORDS_CAP = 200;

const isoDay = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function buildTutorSnapshot(userId: string, now = new Date()): Promise<TutorSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, examLevel: true, examDate: true },
  });

  const [{ level, report }, drafts, lists, saved, due, notStarted, learned, struggling, known] = await Promise.all([
    getReadiness(userId, { now }),
    prisma.writingDraft.findMany({
      where: { version: 1, practice: { userId, hiddenAt: null } },
      orderBy: { createdAt: "desc" },
      take: NOTEBOOK_TEXTS,
      select: { feedback: true },
    }),
    prisma.vocabularyList.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { name: true, _count: { select: { words: true } } },
    }),
    prisma.savedWord.count({ where: { userId } }),
    prisma.savedWord.count({ where: { userId, srsBox: { gt: 0 }, dueAt: { lte: now } } }),
    prisma.savedWord.count({ where: { userId, srsBox: 0 } }),
    prisma.savedWord.count({ where: { userId, srsBox: { gte: LEARNED_BOX } } }),
    prisma.savedWord.findMany({
      where: { userId, reviewCount: { gte: 3 }, srsBox: { lte: 1 } },
      orderBy: { reviewCount: "desc" },
      take: 10,
      select: { english: true },
    }),
    prisma.savedWord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: KNOWN_WORDS_CAP,
      select: { english: true },
    }),
  ]);

  const recentAttempts = level
    ? (await loadReadinessEvidence(userId, level)).observations
        .slice()
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, 12)
        .map((o) => ({ date: isoDay(o.at)!, skill: o.skill, source: o.source, score: Math.round(o.value) }))
    : [];

  const days = user?.examDate ? daysUntil(user.examDate, now) : null;

  const tags = aggregateErrorTags(
    drafts.map((d) => d.feedback as unknown as WritingEvaluation).filter((f) => f && Array.isArray(f.issues)),
    2,
  ).slice(0, 5);

  return {
    today: isoDay(now)!,
    firstName: user?.name?.split(/\s+/)[0] ?? null,
    goal: {
      level: user?.examLevel ?? null,
      examDate: isoDay(user?.examDate),
      daysLeft: days,
      phase: days === null ? null : phaseFor(days),
    },
    readiness: report && level
      ? {
          level,
          passChancePercent: Math.round(report.overall.pPass * 100),
          band: report.overall.band,
          confidence: report.overall.confidence,
          limitingSkill: report.overall.limitingSkill,
          markedAttempts: report.overall.observations,
          skills: report.skills.map((s) => ({
            skill: s.skill,
            score: Math.round(s.mean),
            band: s.band,
            passChancePercent: Math.round(s.pPass * 100),
            attempts: s.count,
            confidence: s.confidence,
            lastAt: isoDay(s.lastAt),
          })),
          weakestCriteria: report.weakestCriteria.slice(0, 5).map((c) => ({
            skill: c.skill,
            criterion: c.key,
            percentOfMax: Math.round(c.value * 100),
            samples: c.count,
          })),
          projection: {
            readyNow: report.projection.readyNow,
            readyBy: isoDay(report.projection.readyBy),
            trendPerWeekPoints: report.projection.trendPerWeek === null ? null : Math.round(report.projection.trendPerWeek * 100),
            marginDays: report.projection.marginDays,
          },
          activity: { lastAt: isoDay(report.activity.lastAt), attemptsLast7Days: report.activity.attempts7d },
        }
      : null,
    recentAttempts,
    writingErrors: {
      textsAnalysed: drafts.length,
      top: tags.map((t) => ({
        tag: t.tag,
        count: t.count,
        examples: t.examples.map((e) => ({ wrote: clip(e.quote, 120), better: clip(e.correction, 120) })),
      })),
    },
    vocabulary: {
      lists: lists.map((l) => ({ name: clip(l.name, 40), words: l._count.words })),
      saved,
      dueForReviewToday: due,
      notStartedYet: notStarted,
      learned,
      struggling: struggling.map((w) => w.english),
      alreadySaved: known.map((w) => w.english),
    },
  };
}
