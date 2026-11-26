import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import type { OfficialAnswers, OfficialPaperContent, OfficialReadingResult } from "@/lib/official";
import type { WritingEvaluation } from "@/types";
import { OfficialPaperClient, type MarkedWriting } from "./official-paper-client";

export const metadata = { title: "Official paper — ISE Simulator" };

export default async function OfficialPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const paper = await prisma.officialPaper.findUnique({ where: { id } });
  if (!paper || paper.userId !== user.id) redirect("/official");
  const content = paper.content as unknown as OfficialPaperContent;

  // Marked writings live as Writing practices: show their first marked version here.
  const practiceIds = [paper.task3PracticeId, paper.task4PracticeId].filter((x): x is string => !!x);
  const practices = practiceIds.length
    ? await prisma.writingPractice.findMany({
        where: { id: { in: practiceIds }, userId: user.id },
        select: { id: true, taskType: true, genre: true, drafts: { where: { version: 1 }, select: { score: true, feedback: true, wordCount: true } } },
      })
    : [];
  const writings: MarkedWriting[] = practices
    .map((p) => ({
      practiceId: p.id,
      task: p.taskType === "READING_INTO_WRITING" ? (3 as const) : (4 as const),
      genre: p.genre,
      score: p.drafts[0]?.score ?? null,
      wordCount: p.drafts[0]?.wordCount ?? 0,
      evaluation: (p.drafts[0]?.feedback ?? null) as unknown as WritingEvaluation | null,
    }))
    .sort((a, b) => a.task - b.task);

  return (
    <OfficialPaperClient
      id={paper.id}
      title={paper.title}
      level={paper.level}
      status={paper.status}
      content={content}
      answers={(paper.answers ?? null) as unknown as OfficialAnswers | null}
      readingResult={(paper.readingResult ?? null) as unknown as OfficialReadingResult | null}
      score={paper.score}
      writings={writings}
    />
  );
}
