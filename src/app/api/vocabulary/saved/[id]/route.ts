import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await params;
  const existing = await prisma.savedWord.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.savedWord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await params;
  const existing = await prisma.savedWord.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { listId, notes } = body as { listId?: string | null; notes?: string | null };

  if (listId) {
    const list = await prisma.vocabularyList.findUnique({ where: { id: listId } });
    if (!list || list.userId !== user.id) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
  }

  const updated = await prisma.savedWord.update({
    where: { id },
    data: {
      ...(listId !== undefined && { listId }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json({
    word: {
      id: updated.id,
      english: updated.english,
      spanish: updated.spanish,
      example: updated.example,
      partOfSpeech: updated.partOfSpeech,
      level: updated.level,
      notes: updated.notes,
      listId: updated.listId,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}
