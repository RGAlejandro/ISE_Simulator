import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { EXAM_LEVELS } from "@/lib/constants";
import { parseSelfAssessment } from "@/lib/welcome";
import type { ExamLevel } from "@/types";

const VALID_LEVELS = EXAM_LEVELS.map((l) => l.value) as string[];
const VALID_MODULES = ["BOTH", "READING_WRITING", "SPEAKING_LISTENING"] as const;
const VALID_TARGETS = ["PASS", "MERIT", "DISTINCTION"] as const;
const MAX_DAYS_AHEAD = 730;

/**
 * Update the learner's exam goal: date and level (dashboard countdown), which
 * module(s) they still have to pass and the band they aim for. Every field is
 * optional; whatever is sent is validated and saved, the rest is kept.
 * `examDate: null` clears the date. The first-run welcome also sends the
 * learner's `selfAssessment` and `completeWelcome: true`.
 */
export async function PUT(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: {
    examDate?: string | null; examLevel?: string | null; examModules?: string; targetBand?: string;
    selfAssessment?: unknown; completeWelcome?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { examDate, examLevel, examModules, targetBand, selfAssessment, completeWelcome } = body;
  const data: Prisma.UserUpdateInput = {};

  if (examModules !== undefined) {
    if (!(VALID_MODULES as readonly string[]).includes(examModules)) return NextResponse.json({ error: "Invalid modules" }, { status: 400 });
    data.examModules = examModules as (typeof VALID_MODULES)[number];
  }
  if (targetBand !== undefined) {
    if (!(VALID_TARGETS as readonly string[]).includes(targetBand)) return NextResponse.json({ error: "Invalid target band" }, { status: 400 });
    data.targetBand = targetBand as (typeof VALID_TARGETS)[number];
  }
  if (examLevel !== undefined && examLevel !== null) {
    if (!VALID_LEVELS.includes(examLevel)) return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    data.examLevel = examLevel as ExamLevel;
  }
  if (examDate === null) {
    data.examDate = null;
  } else if (examDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    const date = new Date(`${examDate}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const days = (date.getTime() - today.getTime()) / 86_400_000;
    if (Number.isNaN(date.getTime()) || days < 0 || days > MAX_DAYS_AHEAD) {
      return NextResponse.json({ error: "The exam date must be in the next two years" }, { status: 400 });
    }
    // A date only makes sense together with a level.
    if (!data.examLevel && !user.examLevel) return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    data.examDate = date;
  }
  if (selfAssessment !== undefined) {
    const parsed = parseSelfAssessment(selfAssessment);
    if (!parsed) return NextResponse.json({ error: "Invalid self-assessment" }, { status: 400 });
    data.selfAssessment = parsed;
  }
  if (completeWelcome === true) {
    // The welcome can't finish without a level: every exercise is pitched at it.
    if (!data.examLevel && !user.examLevel) return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    if (!user.onboardedAt) data.onboardedAt = new Date();
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { examDate: true, examLevel: true, examModules: true, targetBand: true },
  });
  return NextResponse.json({
    examDate: updated.examDate ? updated.examDate.toISOString().slice(0, 10) : null,
    examLevel: updated.examLevel,
    examModules: updated.examModules,
    targetBand: updated.targetBand,
  });
}
