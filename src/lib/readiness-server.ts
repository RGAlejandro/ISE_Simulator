import { prisma } from "@/lib/prisma";
import { EXAM_LEVELS } from "@/lib/constants";
import {
  computeReadiness,
  oralListeningToBand,
  percentToBand,
  spokenToBand,
  writingMeanToBand,
  type CriterionObservation,
  type Observation,
  type ReadinessReport,
} from "@/lib/readiness";
import type { ExamLevel } from "@/types";

/** Practice formats that aren't the exam itself count for less. */
const READING_EXPLORER_WEIGHT = 0.35;
const SPOKEN_TASKS = new Set(["TOPIC", "COLLABORATIVE", "CONVERSATION"]);
const SPOKEN_CRITERIA = ["communicativeEffectiveness", "interactiveListening", "languageControl", "delivery"] as const;
/** Mock-exam writing feedback uses slightly different key names than the Writing Lab. */
const WRITING_KEY_ALIASES: Record<string, string> = { organisationAndStructure: "organisation", readingAndWriting: "readingForWriting" };
const WRITING_CRITERIA = new Set(["readingForWriting", "taskFulfilment", "organisation", "languageControl"]);

type Json = Record<string, unknown>;

function asObject(v: unknown): Json | null {
  if (!v) return null;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" ? (parsed as Json) : null;
    } catch {
      return null;
    }
  }
  return typeof v === "object" ? (v as Json) : null;
}

function criterionScore(v: unknown): number | null {
  const n = (v as { score?: unknown } | null)?.score;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function writingCriteria(feedback: Json | null, criteriaField: boolean, at: Date): CriterionObservation[] {
  if (!feedback) return [];
  const source = (criteriaField ? asObject(feedback.criteria) : feedback) ?? {};
  const out: CriterionObservation[] = [];
  for (const [rawKey, val] of Object.entries(source)) {
    const key = WRITING_KEY_ALIASES[rawKey] ?? rawKey;
    const s = criterionScore(val);
    if (WRITING_CRITERIA.has(key) && s !== null) out.push({ skill: "writing", key, value: Math.min(1, Math.max(0, s / 4)), at });
  }
  return out;
}

export interface ReadinessResult {
  level: ExamLevel | null;
  report: ReadinessReport | null;
}

/** The level a learner is preparing for: their goal, else the level they practise most. */
async function resolveLevel(userId: string, goal: ExamLevel | null): Promise<ExamLevel | null> {
  if (goal) return goal;
  const [oral, written] = await Promise.all([
    prisma.oralExam.groupBy({ by: ["level"], where: { userId, status: "EVALUATED" }, _count: true }),
    prisma.writtenExam.groupBy({ by: ["level"], where: { userId, status: "EVALUATED" }, _count: true }),
  ]);
  const counts = new Map<ExamLevel, number>();
  for (const r of [...oral, ...written]) counts.set(r.level, (counts.get(r.level) ?? 0) + r._count);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Gather every marked attempt at `level` as band-scale observations. */
export async function loadReadinessEvidence(userId: string, level: ExamLevel) {
  const cefr = EXAM_LEVELS.find((l) => l.value === level)?.cefr;
  const [written, drafts, orals, listening, reading] = await Promise.all([
    prisma.writtenExam.findMany({
      where: { userId, level, status: "EVALUATED", hiddenAt: null },
      select: { completedAt: true, createdAt: true, responses: { select: { taskType: true, score: true, aiFeedback: true } } },
    }),
    prisma.writingDraft.findMany({
      where: { version: 1, practice: { userId, level, hiddenAt: null } },
      select: { score: true, feedback: true, createdAt: true },
    }),
    prisma.oralExam.findMany({
      where: { userId, level, status: "EVALUATED", hiddenAt: null },
      select: { completedAt: true, createdAt: true, feedback: { select: { taskType: true, score: true, feedback: true } } },
    }),
    prisma.listeningSession.findMany({
      where: { userId, level, status: "COMPLETED", overallScore: { not: null } },
      select: { overallScore: true, round1Response: true, completedAt: true, createdAt: true },
    }),
    cefr
      ? prisma.readingSession.findMany({
          where: { userId, completedAt: { not: null }, total: { gt: 0 }, reading: { level: cefr } },
          select: { score: true, total: true, completedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const observations: Observation[] = [];
  const criteria: CriterionObservation[] = [];

  for (const exam of written) {
    const at = exam.completedAt ?? exam.createdAt;
    const r1 = exam.responses.find((r) => r.taskType === "READING_1")?.score;
    const r2 = exam.responses.find((r) => r.taskType === "READING_2")?.score;
    if (typeof r1 === "number" && typeof r2 === "number") {
      observations.push({ skill: "reading", value: percentToBand(((r1 + r2) / 30) * 100), weight: 1, at, source: "mockReading" });
    }
    for (const r of exam.responses) {
      if ((r.taskType === "READING_INTO_WRITING" || r.taskType === "EXTENDED_WRITING") && typeof r.score === "number") {
        // Mock-exam writing is marked 0-20 = criteria average (0-4) × 5.
        observations.push({ skill: "writing", value: writingMeanToBand(r.score / 5), weight: 1, at, source: "mockWriting" });
        criteria.push(...writingCriteria(asObject(r.aiFeedback), false, at));
      }
    }
  }

  for (const d of drafts) {
    observations.push({ skill: "writing", value: writingMeanToBand(d.score), weight: 1, at: d.createdAt, source: "writingLab" });
    criteria.push(...writingCriteria(asObject(d.feedback), true, d.createdAt));
  }

  for (const exam of orals) {
    const at = exam.completedAt ?? exam.createdAt;
    const spoken = exam.feedback.filter((f) => SPOKEN_TASKS.has(f.taskType) && typeof f.score === "number");
    if (spoken.length) {
      // One observation per exam: the mean of its spoken tasks (a 3-task exam isn't 3× the evidence).
      const mean = spoken.reduce((s, f) => s + (f.score as number), 0) / spoken.length;
      observations.push({ skill: "speaking", value: spokenToBand(mean), weight: 1, at, source: "oralExam" });
      for (const f of spoken) {
        const fb = asObject(f.feedback);
        for (const key of SPOKEN_CRITERIA) {
          const s = criterionScore(fb?.[key]);
          if (s !== null) criteria.push({ skill: "speaking", key, value: Math.min(1, Math.max(0, s / 5)), at });
        }
      }
    }
    const lis = exam.feedback.find((f) => f.taskType === "LISTENING" && typeof f.score === "number");
    if (lis) observations.push({ skill: "listening", value: oralListeningToBand(lis.score as number), weight: 1, at, source: "oralListening" });
  }

  for (const s of listening) {
    // Skipped sessions (admin "jump to transcript") and keyboard-mash answers aren't evidence.
    if ((s.round1Response?.trim().split(/\s+/).filter((w) => /[aeiou]/i.test(w)).length ?? 0) < 3) continue;
    observations.push({ skill: "listening", value: percentToBand(s.overallScore as number), weight: 1, at: s.completedAt ?? s.createdAt, source: "listening" });
  }

  for (const r of reading) {
    observations.push({
      skill: "reading",
      value: percentToBand(((r.score ?? 0) / (r.total as number)) * 100),
      weight: READING_EXPLORER_WEIGHT,
      at: r.completedAt as Date,
      source: "readingExplorer",
    });
  }

  return { observations, criteria };
}

export async function getReadiness(userId: string, opts: { level?: ExamLevel; now?: Date } = {}): Promise<ReadinessResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { examLevel: true, examDate: true } });
  if (!user) return { level: null, report: null };
  const level = opts.level ?? (await resolveLevel(userId, user.examLevel));
  if (!level) return { level: null, report: null };
  const { observations, criteria } = await loadReadinessEvidence(userId, level);
  // Only use the exam date when it belongs to the level being measured.
  const examDate = user.examLevel === level ? user.examDate : null;
  return { level, report: computeReadiness(observations, criteria, { now: opts.now, examDate }) };
}
