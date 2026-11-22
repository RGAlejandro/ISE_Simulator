import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getDailyUsage, incrementUsage } from "@/lib/user";
import { getPersona } from "@/lib/examiner-personas";
import { EXAM_LEVELS, ORAL_TASKS_BY_LEVEL } from "@/lib/constants";
import { buildLivePlan, isLiveTask } from "@/lib/live-examiner";
import type { ExamLevel } from "@/types";

const MAX_TOPIC_TEXT = 5000;

interface Body {
  level?: string;
  selectedTasks?: string[];
  topicGeneral?: string;
  topicDetailed?: string;
  examinerPersona?: string;
}

/**
 * Create a Live Examiner session. Only creates the exam row; the browser then
 * asks /token for a locked ephemeral credential and connects to Gemini Live.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Body;
    const level = EXAM_LEVELS.find((l) => l.value === body.level)?.value as ExamLevel | undefined;
    if (!level) return NextResponse.json({ error: "Invalid exam level" }, { status: 400 });

    const allowed = ORAL_TASKS_BY_LEVEL[level] ?? [];
    const requested = (body.selectedTasks ?? []).filter((t) => isLiveTask(t) && allowed.includes(t));
    const plan = buildLivePlan(level, requested);
    if (plan.length === 0) {
      return NextResponse.json({ error: "Select at least one spoken task (Topic, Collaborative or Conversation)" }, { status: 400 });
    }

    const topicGeneral = (body.topicGeneral ?? "").trim() || null;
    const topicDetailed = (body.topicDetailed ?? "").trim() || null;
    if ((topicGeneral?.length ?? 0) > MAX_TOPIC_TEXT || (topicDetailed?.length ?? 0) > MAX_TOPIC_TEXT) {
      return NextResponse.json({ error: `Topic preparation text is too long (max ${MAX_TOPIC_TEXT} characters)` }, { status: 400 });
    }
    if (plan.some((p) => p.task === "TOPIC") && !topicGeneral && !topicDetailed) {
      return NextResponse.json({ error: "Please provide topic content (general or detailed)" }, { status: 400 });
    }

    const usage = await getDailyUsage(user.id);
    if (!usage.canTakeOral) {
      return NextResponse.json({ error: "Daily limit reached. Upgrade to Pro for unlimited exams." }, { status: 429 });
    }

    const exam = await prisma.oralExam.create({
      data: {
        userId: user.id,
        level,
        status: "IN_PROGRESS",
        mode: "live",
        selectedTasks: plan.map((p) => p.task),
        topicGeneral,
        topicDetailed,
        examinerPersona: getPersona(body.examinerPersona).id,
      },
      select: { id: true },
    });
    await incrementUsage(user.id, "oral");

    return NextResponse.json({ examId: exam.id, plan });
  } catch (error) {
    console.error("Error creating live oral session:", error);
    return NextResponse.json({ error: "Failed to create live session" }, { status: 500 });
  }
}
