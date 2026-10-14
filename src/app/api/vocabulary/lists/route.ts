import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const lists = await prisma.vocabularyList.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { words: true } } },
  });

  return NextResponse.json({
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      emoji: l.emoji,
      color: l.color,
      wordCount: l._count.words,
    })),
  });
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const { name, emoji, color } = body as { name?: string; emoji?: string; color?: string };

  if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 60) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const list = await prisma.vocabularyList.create({
    data: {
      userId: user.id,
      name: name.trim(),
      emoji: emoji && emoji.length <= 4 ? emoji : "📚",
      color: color ?? "blue",
    },
  });

  return NextResponse.json({
    list: { id: list.id, name: list.name, emoji: list.emoji, color: list.color, wordCount: 0 },
  });
}
