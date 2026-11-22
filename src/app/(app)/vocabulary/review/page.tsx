import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { LEARNED_BOX, SESSION_MAX_REVIEWS } from "@/lib/srs";
import { getReviewQueue } from "@/lib/srs-server";
import { ReviewClient, type ReviewCard } from "./review-client";

export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const now = new Date();
  const where = { userId: user.id };
  // New words follow the same daily allowance as the dashboard's "Today" list.
  const { newLeft } = await getReviewQueue(user.id, now);

  const [due, fresh, total, learned, newCount, dueCount, next] = await Promise.all([
    prisma.savedWord.findMany({
      where: { ...where, srsBox: { gt: 0 }, dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
      take: SESSION_MAX_REVIEWS,
    }),
    // Newest first: freshly saved words (e.g. Writing Lab upgrades) are the most relevant.
    prisma.savedWord.findMany({
      where: { ...where, srsBox: 0 },
      orderBy: { createdAt: "desc" },
      take: newLeft,
    }),
    prisma.savedWord.count({ where }),
    prisma.savedWord.count({ where: { ...where, srsBox: { gte: LEARNED_BOX } } }),
    prisma.savedWord.count({ where: { ...where, srsBox: 0 } }),
    prisma.savedWord.count({ where: { ...where, srsBox: { gt: 0 }, dueAt: { lte: now } } }),
    prisma.savedWord.findFirst({
      where: { ...where, srsBox: { gt: 0 }, dueAt: { gt: now } },
      orderBy: { dueAt: "asc" },
      select: { dueAt: true },
    }),
  ]);

  const toCard = (w: (typeof due)[number]): ReviewCard => ({
    id: w.id,
    english: w.english,
    translation: w.spanish,
    example: w.example,
    partOfSpeech: w.partOfSpeech ?? "",
    level: w.level,
    notes: w.notes,
    box: w.srsBox,
  });

  return (
    <ReviewClient
      cards={[...due.map(toCard), ...fresh.map(toCard)]}
      stats={{
        total,
        learned,
        newWords: newCount,
        learning: total - learned - newCount,
        dueReviews: dueCount,
      }}
      nextDueAt={next?.dueAt.toISOString() ?? null}
    />
  );
}
