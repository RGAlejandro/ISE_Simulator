import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { levelFromXp, dayStart, daysBetween } from "@/lib/gamification";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const stats =
    (await prisma.gamificationStats.findUnique({ where: { userId: user.id } })) ??
    (await prisma.gamificationStats.create({ data: { userId: user.id } }));

  // Streak/today are only "live" if the last active day is today or yesterday.
  const today = dayStart();
  const gap = stats.lastActiveDate ? daysBetween(stats.lastActiveDate, today) : null;
  const streakLive = gap !== null && gap <= 1;
  const isToday = gap === 0;

  return NextResponse.json({
    xp: stats.xp,
    ...levelFromXp(stats.xp),
    currentStreak: streakLive ? stats.currentStreak : 0,
    longestStreak: stats.longestStreak,
    todayXp: isToday ? stats.todayXp : 0,
    dailyGoal: stats.dailyGoal,
    totalCorrect: stats.totalCorrect,
    questsDone: stats.questsDone,
    achievements: stats.achievements,
  });
}
