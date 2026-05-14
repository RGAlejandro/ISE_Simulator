import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const url = new URL(req.url);
  const listId = url.searchParams.get("listId");
  const onlyEnglish = url.searchParams.get("onlyEnglish") === "1";

  const words = await prisma.savedWord.findMany({
    where: {
      userId: user.id,
      ...(listId === "_unfiled" ? { listId: null } : listId ? { listId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (onlyEnglish) {
    return NextResponse.json({ english: words.map((w) => w.english) });
  }

  return NextResponse.json({
    words: words.map((w) => ({
      id: w.id,
      english: w.english,
      spanish: w.spanish,
      example: w.example,
      partOfSpeech: w.partOfSpeech,
      level: w.level,
      notes: w.notes,
      listId: w.listId,
      createdAt: w.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const { english, spanish, example, partOfSpeech, level, listId } = body as {
    english?: string;
    spanish?: string;
    example?: string;
    partOfSpeech?: string;
    level?: string;
    listId?: string | null;
  };

  if (!english || !spanish || !example || !level) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (listId) {
    const list = await prisma.vocabularyList.findUnique({ where: { id: listId } });
    if (!list || list.userId !== user.id) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
  }

  const word = await prisma.savedWord.upsert({
    where: { userId_english: { userId: user.id, english: english.trim() } },
    create: {
      userId: user.id,
      english: english.trim(),
      spanish: spanish.trim(),
      example,
      partOfSpeech: partOfSpeech ?? null,
      level,
      listId: listId ?? null,
    },
    update: {
      listId: listId ?? null,
      spanish: spanish.trim(),
      example,
      partOfSpeech: partOfSpeech ?? null,
      level,
    },
  });

  return NextResponse.json({
    word: {
      id: word.id,
      english: word.english,
      spanish: word.spanish,
      example: word.example,
      partOfSpeech: word.partOfSpeech,
      level: word.level,
      notes: word.notes,
      listId: word.listId,
      createdAt: word.createdAt.toISOString(),
    },
  });
}
