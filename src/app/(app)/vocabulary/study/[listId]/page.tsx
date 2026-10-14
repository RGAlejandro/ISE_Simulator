import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { StudyClient } from "./study-client";
import type { CefrBand } from "@/lib/prompts/vocabulary";
import type { VocabCard } from "@/types";

export default async function StudyListPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const list = await prisma.vocabularyList.findUnique({
    where: { id: listId },
    include: { words: { orderBy: { createdAt: "asc" } } },
  });

  if (!list || list.userId !== user.id) notFound();
  if (list.words.length === 0) redirect("/vocabulary/saved");

  const cards: (VocabCard & { id: string; level: CefrBand })[] = list.words.map((w) => ({
    id: w.id,
    english: w.english,
    translation: w.spanish,
    example: w.example,
    partOfSpeech: w.partOfSpeech ?? "word",
    level: (w.level as CefrBand) ?? "B1",
  }));

  return (
    <StudyClient
      listName={list.name}
      listEmoji={list.emoji}
      cards={cards}
    />
  );
}
