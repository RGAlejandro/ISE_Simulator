import { prisma } from "@/lib/prisma";
import {
  XP_PER_CORRECT, QUEST_COMPLETE_BONUS, MAX_QUEST_XP,
  levelFromXp, dayStart, daysBetween, weekStart,
  unlockedAchievementIds, ACHIEVEMENTS,
} from "@/lib/gamification";

export interface AwardResult {
  xpGained: number;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
  leveledUp: boolean;
  currentStreak: number;
  longestStreak: number;
  todayXp: number;
  dailyGoal: number;
  newAchievements: typeof ACHIEVEMENTS;
}

/**
 * Award XP for a finished activity and roll the streak / daily goal / weekly
 * leaderboard forward. `countsAsQuest: false` lets other activities (e.g.
 * Reading Explorer, Writing Lab, SRS reviews) feed XP and streaks without
 * counting as a Quest.
 */
export async function awardXp(
  userId: string,
  { correct, total, countsAsQuest = true, xp }: { correct: number; total: number; countsAsQuest?: boolean; xp?: number },
): Promise<AwardResult> {
  // `xp` lets non-quiz activities (e.g. a Writing Lab text) award a flat amount.
  const xpGained = Math.min(MAX_QUEST_XP, xp ?? correct * XP_PER_CORRECT + QUEST_COMPLETE_BONUS);

  const prev =
    (await prisma.gamificationStats.findUnique({ where: { userId } })) ??
    (await prisma.gamificationStats.create({ data: { userId } }));

  const today = dayStart();
  const gap = prev.lastActiveDate ? daysBetween(prev.lastActiveDate, today) : null;

  // Streak + daily XP roll-over
  let currentStreak: number;
  let todayXp: number;
  if (gap === 0) {
    currentStreak = prev.currentStreak;
    todayXp = prev.todayXp + xpGained;
  } else if (gap === 1) {
    currentStreak = prev.currentStreak + 1;
    todayXp = xpGained;
  } else {
    currentStreak = 1; // first day, or streak broken
    todayXp = xpGained;
  }

  const newXp = prev.xp + xpGained;
  const longestStreak = Math.max(prev.longestStreak, currentStreak);
  const totalCorrect = prev.totalCorrect + correct;
  const questsDone = prev.questsDone + (countsAsQuest ? 1 : 0);

  const unlocked = unlockedAchievementIds({ xp: newXp, longestStreak, totalCorrect, questsDone });
  const merged = Array.from(new Set([...prev.achievements, ...unlocked]));
  const newlyUnlocked = unlocked.filter((id) => !prev.achievements.includes(id));

  const ws = weekStart();

  await prisma.$transaction([
    prisma.gamificationStats.update({
      where: { userId },
      data: {
        xp: newXp,
        currentStreak,
        longestStreak,
        lastActiveDate: today,
        todayXp,
        totalAnswered: prev.totalAnswered + total,
        totalCorrect,
        questsDone,
        achievements: merged,
      },
    }),
    prisma.weeklyXp.upsert({
      where: { userId_weekStart: { userId, weekStart: ws } },
      create: { userId, weekStart: ws, xp: xpGained },
      update: { xp: { increment: xpGained } },
    }),
  ]);

  return {
    xpGained,
    xp: newXp,
    ...levelFromXp(newXp),
    leveledUp: levelFromXp(newXp).level > levelFromXp(prev.xp).level,
    currentStreak,
    longestStreak,
    todayXp,
    dailyGoal: prev.dailyGoal,
    newAchievements: ACHIEVEMENTS.filter((a) => newlyUnlocked.includes(a.id)),
  };
}
