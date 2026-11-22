import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { EXAM_LEVELS } from "@/lib/constants";
import type { ExamLevel } from "@/types";

const VALID_LEVELS = EXAM_LEVELS.map((l) => l.value) as string[];
const MAX_DAYS_AHEAD = 730;

/** Set (or clear with nulls) the learner's exam date and level — drives the dashboard countdown. */
export async function PUT(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { examDate, examLevel } = (await req.json()) as { examDate?: string | null; examLevel?: string | null };

  if (examDate === null) {
    await prisma.user.update({ where: { id: user.id }, data: { examDate: null } });
    return NextResponse.json({ examDate: null, examLevel: user.examLevel });
  }

  if (!examDate || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const date = new Date(`${examDate}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = (date.getTime() - today.getTime()) / 86_400_000;
  if (Number.isNaN(date.getTime()) || days < 0 || days > MAX_DAYS_AHEAD) {
    return NextResponse.json({ error: "The exam date must be in the next two years" }, { status: 400 });
  }
  if (!examLevel || !VALID_LEVELS.includes(examLevel)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { examDate: date, examLevel: examLevel as ExamLevel },
  });
  return NextResponse.json({ examDate, examLevel });
}
