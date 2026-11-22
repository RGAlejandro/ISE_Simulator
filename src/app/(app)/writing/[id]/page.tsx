import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { getLevelSpec } from "@/lib/prompts/written-exam";
import { WritingWorkspaceClient } from "./writing-workspace-client";
import type { ExamLevel, WritingDraftData, WritingEvaluation, WritingTaskContent, WritingTaskType } from "@/types";

export default async function WritingPracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const practice = await prisma.writingPractice.findUnique({
    where: { id },
    include: { drafts: { orderBy: { version: "asc" } } },
  });
  if (!practice || practice.userId !== user.id || practice.hiddenAt) notFound();

  const drafts: WritingDraftData[] = practice.drafts.map((d) => ({
    id: d.id,
    version: d.version,
    text: d.text,
    wordCount: d.wordCount,
    source: d.source === "photo" ? "photo" : "typed",
    secondsUsed: d.secondsUsed,
    score: d.score,
    feedback: d.feedback as unknown as WritingEvaluation,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <WritingWorkspaceClient
      practiceId={practice.id}
      levelLabel={practice.level.replace("ISE_", "ISE ").replace("FOUNDATION", "Foundation")}
      cefr={getLevelSpec(practice.level as ExamLevel).cefr}
      taskType={practice.taskType as WritingTaskType}
      genre={practice.genre}
      topic={practice.topic}
      task={practice.task as unknown as WritingTaskContent}
      initialDrafts={drafts}
      initialMode={mode === "learn" ? "learn" : "exam"}
    />
  );
}
