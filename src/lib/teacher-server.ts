import { prisma } from "@/lib/prisma";
import { getLevelSpec } from "@/lib/prompts/written-exam";
import { FREE_LESSONS_PER_DAY, LESSON_TYPE, type MarkedDraft } from "@/lib/teacher";
import type { ExamLevel, WritingEvaluation } from "@/types";

/** The learner's marked first drafts (Writing practice and official papers). */
export async function loadMarkedDrafts(userId: string): Promise<MarkedDraft[]> {
  const drafts = await prisma.writingDraft.findMany({
    // Same writings as the Writing notebook: hidden (deleted) practices don't count.
    where: { version: 1, practice: { userId, hiddenAt: null } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { text: true, feedback: true, createdAt: true },
  });
  return drafts
    .map((d) => ({ text: d.text, feedback: d.feedback as unknown as WritingEvaluation, createdAt: d.createdAt }))
    .filter((d) => Array.isArray(d.feedback?.issues));
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Free plan: one lesson a day. */
export async function canStartLesson(userId: string, isPro: boolean): Promise<boolean> {
  if (isPro) return true;
  const today = await prisma.grammarSession.count({
    where: { userId, exerciseType: LESSON_TYPE, createdAt: { gte: startOfToday() } },
  });
  return today < FREE_LESSONS_PER_DAY;
}

/** CEFR for the learner's exam level (B2 if they haven't set one). */
export function cefrFor(level: string | null | undefined): string {
  return level ? getLevelSpec(level as ExamLevel).cefr : "B2";
}
