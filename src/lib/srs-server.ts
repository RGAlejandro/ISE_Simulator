import { prisma } from "@/lib/prisma";
import { SESSION_MAX_NEW } from "@/lib/srs";

/**
 * Today's spaced-repetition workload for one learner: words due for review plus
 * the new words still left in today's allowance (SESSION_MAX_NEW per day).
 * Words studied for the first time today use up that allowance, so finishing
 * today's session empties the queue even when many unstudied words remain.
 */
export async function getReviewQueue(userId: string, now = new Date()) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [due, unstudied, todayLogs] = await Promise.all([
    prisma.savedWord.count({ where: { userId, srsBox: { gt: 0 }, dueAt: { lte: now } } }),
    prisma.savedWord.count({ where: { userId, srsBox: 0 } }),
    prisma.reviewLog.findMany({ where: { userId, createdAt: { gte: startOfDay } }, distinct: ["wordId"], select: { wordId: true } }),
  ]);

  // Words reviewed today that had never been reviewed before today = new words introduced today.
  const todayIds = todayLogs.map((l) => l.wordId);
  const seenBefore = todayIds.length
    ? await prisma.reviewLog.findMany({ where: { userId, wordId: { in: todayIds }, createdAt: { lt: startOfDay } }, distinct: ["wordId"], select: { wordId: true } })
    : [];
  const newToday = todayIds.length - seenBefore.length;
  const newLeft = Math.min(unstudied, Math.max(0, SESSION_MAX_NEW - newToday));

  return { due, newLeft, total: due + newLeft, reviewedToday: todayIds.length > 0 };
}
