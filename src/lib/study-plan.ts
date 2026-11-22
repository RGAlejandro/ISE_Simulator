/**
 * Exam countdown + weekly study plan — pure helpers. The plan is rule-based
 * (no AI): the closer the exam, the more exam-like the practice.
 */

export type PlanPhase = "build" | "intensify" | "simulate" | "taper" | "examDay" | "past";

export type PlanTargetKey = "writing" | "review" | "reading" | "oral" | "mock";

export interface PlanTarget {
  key: PlanTargetKey;
  done: number;
  target: number;
  href: string;
}

export interface WeekStats {
  /** First drafts submitted in the Writing Lab this week. */
  writing: number;
  /** Distinct days this week with at least one vocabulary review. */
  reviewDays: number;
  /** Reading Explorer sessions started this week. */
  reading: number;
  /** Oral exams started this week. */
  oral: number;
  /** Full written mock exams started this week. */
  mock: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `today` to `examDate`, both taken as calendar dates (UTC). */
export function daysUntil(examDate: Date, today = new Date()): number {
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(examDate.getUTCFullYear(), examDate.getUTCMonth(), examDate.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

export function phaseFor(daysLeft: number): PlanPhase {
  if (daysLeft < 0) return "past";
  if (daysLeft === 0) return "examDay";
  if (daysLeft <= 3) return "taper";
  if (daysLeft <= 14) return "simulate";
  if (daysLeft <= 28) return "intensify";
  return "build";
}

const TARGETS: Record<PlanPhase, Record<PlanTargetKey, number>> = {
  build:     { writing: 3, review: 5, reading: 2, oral: 1, mock: 0 },
  intensify: { writing: 3, review: 6, reading: 1, oral: 1, mock: 1 },
  simulate:  { writing: 2, review: 6, reading: 0, oral: 2, mock: 1 },
  taper:     { writing: 1, review: 3, reading: 0, oral: 0, mock: 0 },
  examDay:   { writing: 0, review: 0, reading: 0, oral: 0, mock: 0 },
  past:      { writing: 0, review: 0, reading: 0, oral: 0, mock: 0 },
};

const HREFS: Record<PlanTargetKey, string> = {
  writing: "/writing",
  review: "/vocabulary/review",
  reading: "/vocabulary/reading",
  oral: "/practice",
  mock: "/practice",
};

export function weeklyTargets(phase: PlanPhase, stats: WeekStats): PlanTarget[] {
  const t = TARGETS[phase];
  const done: Record<PlanTargetKey, number> = {
    writing: stats.writing,
    review: stats.reviewDays,
    reading: stats.reading,
    oral: stats.oral,
    mock: stats.mock,
  };
  return (Object.keys(t) as PlanTargetKey[])
    .filter((k) => t[k] > 0)
    .map((k) => ({ key: k, done: done[k], target: t[k], href: HREFS[k] }));
}

/** Monday 00:00 (local) of the week containing `d`. */
export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - dow);
  return x;
}

/** Genre the learner has practised least (ties → first in the official order). */
export function leastPractisedGenre(genres: readonly string[], practised: Record<string, number>): string {
  let best = genres[0];
  for (const g of genres) if ((practised[g] ?? 0) < (practised[best] ?? 0)) best = g;
  return best;
}
