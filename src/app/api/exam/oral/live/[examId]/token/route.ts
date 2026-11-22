import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { LIVE_MODELS } from "@/lib/constants";
import { buildLiveSetup, LIVE_WS_URL, liveModelFor, mintLiveToken } from "@/lib/live-examiner";

/** A live exam can mint credentials for this long after it was created. */
const SESSION_WINDOW_MS = 45 * 60_000;
/** Model fallbacks + reconnects (GoAway / network blips) allowed per exam. */
const MAX_TOKENS_PER_EXAM = 8;

// Per-process guard against a client minting tokens in a loop. Good enough for a
// single-instance deployment; a multi-instance one would move this to the DB.
const minted = new Map<string, number>();

interface Body {
  /** Index into LIVE_MODELS: 0 = preferred, 1+ = fallbacks after a failed connect. */
  attempt?: number;
  /** Session resumption handle from Gemini (reconnect after GoAway keeps the context). */
  resumeHandle?: string;
}

export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { examId } = await params;

    const exam = await prisma.oralExam.findFirst({
      where: { id: examId, userId: user.id, mode: "live" },
      select: { id: true, level: true, status: true, selectedTasks: true, topicGeneral: true, topicDetailed: true, examinerPersona: true, createdAt: true },
    });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (exam.status !== "IN_PROGRESS") return NextResponse.json({ error: "This exam has already finished" }, { status: 409 });
    if (Date.now() - exam.createdAt.getTime() > SESSION_WINDOW_MS) {
      return NextResponse.json({ error: "This live session has expired. Start a new one." }, { status: 410 });
    }

    const count = (minted.get(examId) ?? 0) + 1;
    if (count > MAX_TOKENS_PER_EXAM) {
      return NextResponse.json({ error: "Too many connection attempts for this exam" }, { status: 429 });
    }
    minted.set(examId, count);

    const body = (await req.json().catch(() => ({}))) as Body;
    const attempt = Number.isInteger(body.attempt) ? Math.max(0, body.attempt as number) : 0;
    const model = liveModelFor(attempt);
    if (!model) {
      return NextResponse.json({ error: "No live model available", exhausted: true }, { status: 503 });
    }
    // Resumption handles are opaque base64-ish strings from Google; reject anything else.
    const resumeHandle =
      typeof body.resumeHandle === "string" && /^[\w\-.=/+]{8,512}$/.test(body.resumeHandle) ? body.resumeHandle : undefined;

    const { setup, plan } = buildLiveSetup(
      {
        level: exam.level,
        personaId: exam.examinerPersona,
        selectedTasks: exam.selectedTasks,
        topicGeneral: exam.topicGeneral,
        topicDetailed: exam.topicDetailed,
      },
      model,
      resumeHandle,
    );
    const { token, expiresAt } = await mintLiveToken(setup);

    return NextResponse.json({
      token,
      expiresAt,
      wsUrl: LIVE_WS_URL,
      model,
      attempt,
      hasFallback: attempt + 1 < LIVE_MODELS.length,
      plan,
    });
  } catch (error) {
    console.error("Error minting live token:", error);
    return NextResponse.json({ error: "Could not start the live examiner" }, { status: 502 });
  }
}
