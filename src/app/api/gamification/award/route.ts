import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/user";
import { awardXp } from "@/lib/gamification-server";

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

  return NextResponse.json(await awardXp(user.id, { correct, total }));
}
