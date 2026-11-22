import { prisma } from "@/lib/prisma";
import type { TutorWord } from "@/lib/tutor";

/**
 * Create a list with already-complete words in one transaction. Words the
 * learner has already saved (case-insensitive) are skipped, not moved out of
 * the list they already belong to.
 */
export async function createListWithWords(userId: string, name: string, emoji: string, words: TutorWord[]) {
  const existing = await prisma.savedWord.findMany({ where: { userId }, select: { english: true } });
  const known = new Set(existing.map((w) => w.english.toLowerCase()));
  const toAdd = words.filter((w) => !known.has(w.english.toLowerCase()));
  const skipped = words.filter((w) => known.has(w.english.toLowerCase())).map((w) => w.english);

  const { list, added } = await prisma.$transaction(async (tx) => {
    const list = await tx.vocabularyList.create({ data: { userId, name, emoji, color: "blue" } });
    const res = await tx.savedWord.createMany({
      data: toAdd.map((w) => ({
        userId,
        listId: list.id,
        english: w.english,
        spanish: w.spanish,
        example: w.example,
        partOfSpeech: w.partOfSpeech,
        level: w.level,
      })),
      skipDuplicates: true,
    });
    return { list, added: res.count };
  });

  return { list, added, skipped };
}
