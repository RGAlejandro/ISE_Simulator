import { redirect } from "next/navigation";
import { getCurrentUser, getDailyUsage, isProUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { EXAM_LEVELS, FREE_DAILY_LIMIT } from "@/lib/constants";
import { getLevelSpec } from "@/lib/prompts/written-exam";
import { aggregateErrorTags, WRITING_TASK_TYPES } from "@/lib/writing";
import { WritingHubClient, type LevelOption, type PracticeSummary } from "./writing-hub-client";
import type { ExamLevel, WritingEvaluation, WritingTaskContent, WritingTaskType } from "@/types";

const HISTORY_SIZE = 30;
/** First drafts analysed for the error notebook. */
const NOTEBOOK_TEXTS = 15;

export default async function WritingPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; type?: string; level?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const query = await searchParams;

  const [usage, practices, firstDrafts] = await Promise.all([
    getDailyUsage(user.id),
    prisma.writingPractice.findMany({
      where: { userId: user.id, hiddenAt: null },
      orderBy: { updatedAt: "desc" },
      take: HISTORY_SIZE,
      include: { drafts: { select: { version: true, score: true }, orderBy: { version: "asc" } } },
    }),
    prisma.writingDraft.findMany({
      where: { version: 1, practice: { userId: user.id, hiddenAt: null } },
      orderBy: { createdAt: "desc" },
      take: NOTEBOOK_TEXTS,
      select: { feedback: true },
    }),
  ]);

  const levels: LevelOption[] = EXAM_LEVELS.map((l) => {
    const spec = getLevelSpec(l.value as ExamLevel);
    return {
      value: l.value as ExamLevel,
      label: l.label,
      cefr: l.cefr,
      genres: { READING_INTO_WRITING: [...spec.writingTypes.riw], EXTENDED_WRITING: [...spec.writingTypes.ew] },
      topics: [...spec.topics],
    };
  });

  const summaries: PracticeSummary[] = practices.map((p) => {
    const scores = p.drafts.map((d) => d.score);
    return {
      id: p.id,
      level: p.level as ExamLevel,
      taskType: p.taskType as WritingTaskType,
      genre: p.genre,
      topic: p.topic,
      title: (p.task as unknown as WritingTaskContent).title,
      versions: p.drafts.length,
      firstScore: scores[0] ?? null,
      lastScore: scores.length > 0 ? scores[scores.length - 1] : null,
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  const defaultLevel = (levels.some((l) => l.value === query.level) ? query.level : user.examLevel ?? "ISE_III") as ExamLevel;
  const initialType = WRITING_TASK_TYPES.includes(query.type as WritingTaskType) ? (query.type as WritingTaskType) : null;

  return (
    <WritingHubClient
      isPro={isProUser(user)}
      writingToday={usage.writingCount}
      canStart={usage.canTakeWriting}
      freeLimit={FREE_DAILY_LIMIT.writing}
      levels={levels}
      defaultLevel={defaultLevel}
      initialType={initialType}
      initialGenre={query.genre ?? null}
      practices={summaries}
      notebook={{
        texts: firstDrafts.length,
        tags: aggregateErrorTags(firstDrafts.map((d) => d.feedback as unknown as WritingEvaluation)).slice(0, 6),
      }}
    />
  );
}
