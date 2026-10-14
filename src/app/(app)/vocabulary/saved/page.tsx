import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { SavedClient } from "./saved-client";
import type { SavedWordData, VocabularyListData } from "@/types";

export default async function SavedVocabPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [lists, words] = await Promise.all([
    prisma.vocabularyList.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { words: true } } },
    }),
    prisma.savedWord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const listsData: VocabularyListData[] = lists.map((l) => ({
    id: l.id,
    name: l.name,
    emoji: l.emoji,
    color: l.color,
    wordCount: l._count.words,
  }));

  const wordsData: SavedWordData[] = words.map((w) => ({
    id: w.id,
    english: w.english,
    spanish: w.spanish,
    example: w.example,
    partOfSpeech: w.partOfSpeech,
    level: w.level,
    notes: w.notes,
    listId: w.listId,
    createdAt: w.createdAt.toISOString(),
  }));

  return <SavedClient initialLists={listsData} initialWords={wordsData} />;
}
