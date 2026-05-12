import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { FREE_DAILY_LIMIT } from "@/lib/constants";
import type { UserUsage } from "@/types";

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { subscription: true },
  });

  // Auto-create user if not in DB (webhook may not be configured)
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return null;

    user = await prisma.user.upsert({
      where: { clerkId: userId },
      create: {
        clerkId: userId,
        email,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
      },
      update: {},
      include: { subscription: true },
    });
  }

  return user;
}

export async function getDailyUsage(userId: string): Promise<UserUsage> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  const usage = await prisma.dailyUsage.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  const isPro = user?.plan === "ADMIN" || (user?.plan === "PRO" && user?.subscription?.status === "ACTIVE");
  const writtenCount = usage?.writtenCount ?? 0;
  const oralCount = usage?.oralCount ?? 0;
  const listeningCount = usage?.listeningCount ?? 0;

  return {
    writtenCount,
    oralCount,
    listeningCount,
    canTakeWritten: isPro || writtenCount < FREE_DAILY_LIMIT.written,
    canTakeOral: isPro || oralCount < FREE_DAILY_LIMIT.oral,
    canTakeListening: isPro || listeningCount < FREE_DAILY_LIMIT.listening,
  };
}

export async function incrementUsage(userId: string, type: "written" | "oral" | "listening") {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const field = type === "written" ? "writtenCount" : type === "oral" ? "oralCount" : "listeningCount";

  await prisma.dailyUsage.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}
