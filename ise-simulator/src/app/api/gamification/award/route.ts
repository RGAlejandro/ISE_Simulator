import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import {
  XP_PER_CORRECT, QUEST_COMPLETE_BONUS, MAX_QUEST_XP,
  levelFromXp, dayStart, daysBetween, weekStart,
  unlockedAchievementIds, ACHIEVEMENTS,
} from "@/lib/gamification";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  let { correct, total } = body as { correct?: number; total?: number };
  correct = Math.max(0, Math.floor(Number(correct) || 0));
  total = Math.max(correct, Math.floor(Number(total) || 0));
  if (total === 0) return NextResponse.json({ error: "Empty quest" }, { status: 400 });

  const xpGained = Math.min(MAX_QUEST_XP, correct * XP_PER_CORRECT + QUEST_COMPLETE_BONUS);

  const prev =
    (await prisma.gamificationStats.findUnique({ where: { userId: user.id } })) ??
    (await prisma.gamificationStats.create({ data: { userId: user.id } }));

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
  const questsDone = prev.questsDone + 1;

  const unlocked = unlockedAchievementIds({ xp: newXp, longestStreak, totalCorrect, questsDone });
  const merged = Array.from(new Set([...prev.achievements, ...unlocked]));
  const newlyUnlocked = unlocked.filter((id) => !prev.achievements.includes(id));

  const ws = weekStart();

  await prisma.$transaction([
    prisma.gamificationStats.update({
      where: { userId: user.id },
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
      where: { userId_weekStart: { userId: user.id, weekStart: ws } },
      create: { userId: user.id, weekStart: ws, xp: xpGained },
      update: { xp: { increment: xpGained } },
    }),
  ]);

  return NextResponse.json({
    xpGained,
    xp: newXp,
    ...levelFromXp(newXp),
    leveledUp: levelFromXp(newXp).level > levelFromXp(prev.xp).level,
    currentStreak,
    longestStreak,
    todayXp,
    dailyGoal: prev.dailyGoal,
    newAchievements: ACHIEVEMENTS.filter((a) => newlyUnlocked.includes(a.id)),
  });
}
