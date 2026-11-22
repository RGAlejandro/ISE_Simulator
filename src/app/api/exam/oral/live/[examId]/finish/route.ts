import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import type { Prisma } from "@prisma/client";

const MAX_TURNS = 400;
const MAX_TURN_CHARS = 6000;
const MAX_METRICS_BYTES = 20_000;

interface TurnIn {
  role?: string;
  task?: string;
  text?: string;
}

/**
 * Persist a finished live session: the streamed transcript becomes ordinary
 * OralExchange rows, so the existing evaluator and results page work unchanged.
 * Idempotent — calling it twice replaces the transcript.
 */
export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { examId } = await params;

    const exam = await prisma.oralExam.findFirst({
      where: { id: examId, userId: user.id, mode: "live" },
      select: { id: true, status: true, selectedTasks: true },
    });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (exam.status === "EVALUATED") return NextResponse.json({ error: "Exam already evaluated" }, { status: 409 });

    const body = (await req.json().catch(() => ({}))) as { turns?: TurnIn[]; metrics?: unknown };
    const turns = (Array.isArray(body.turns) ? body.turns : [])
      .slice(0, MAX_TURNS)
      .map((t) => ({
        role: t.role === "EXAMINER" ? ("EXAMINER" as const) : ("CANDIDATE" as const),
        task: typeof t.task === "string" ? t.task : "",
        text: typeof t.text === "string" ? t.text.trim().slice(0, MAX_TURN_CHARS) : "",
      }))
      .filter((t) => t.text.length > 0 && exam.selectedTasks.includes(t.task));

    if (!turns.some((t) => t.role === "CANDIDATE")) {
      return NextResponse.json({ error: "Nothing was recorded from the candidate" }, { status: 400 });
    }

    let metrics: Prisma.InputJsonValue | undefined;
    if (body.metrics && typeof body.metrics === "object") {
      const json = JSON.stringify(body.metrics);
      if (json.length <= MAX_METRICS_BYTES) metrics = JSON.parse(json) as Prisma.InputJsonValue;
    }

    await prisma.$transaction([
      prisma.oralExchange.deleteMany({ where: { examId } }),
      prisma.oralExchange.createMany({
        data: turns.map((t, i) => ({
          examId,
          taskType: t.task as "TOPIC" | "COLLABORATIVE" | "CONVERSATION",
          role: t.role,
          content: t.text,
          order: i,
        })),
      }),
      prisma.oralExam.update({
        where: { id: examId },
        data: { status: "COMPLETED", ...(metrics !== undefined ? { liveMetrics: metrics } : {}) },
      }),
    ]);

    return NextResponse.json({ ok: true, turns: turns.length });
  } catch (error) {
    console.error("Error finishing live session:", error);
    return NextResponse.json({ error: "Failed to save the live session" }, { status: 500 });
  }
}
