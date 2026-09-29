import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { weekStart } from "@/lib/gamification";

/** First name only, to limit how much identity is exposed on the leaderboard. */
function displayName(name: string | null, email: string): string {
  const n = (name ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  return email.split("@")[0];
}

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ws = weekStart();
  const rows = await prisma.weeklyXp.findMany({
    where: { weekStart: ws, xp: { gt: 0 } },
    orderBy: { xp: "desc" },
    take: 20,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const entries = rows.map((r, i) => ({
    rank: i + 1,
    name: displayName(r.user.name, r.user.email),
    xp: r.xp,
    isCurrentUser: r.user.id === user.id,
  }));

  // If the current user isn't in the top 20, append their own standing.
  let me = entries.find((e) => e.isCurrentUser) ?? null;
  if (!me) {
    const mine = await prisma.weeklyXp.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart: ws } },
    });
    if (mine && mine.xp > 0) {
      const rank = (await prisma.weeklyXp.count({
        where: { weekStart: ws, xp: { gt: mine.xp } },
      })) + 1;
      me = { rank, name: displayName(user.name, user.email), xp: mine.xp, isCurrentUser: true };
    }
  }

  return NextResponse.json({ weekStart: ws.toISOString().slice(0, 10), entries, me });
}
