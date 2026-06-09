import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateChat } from "@/lib/ai-provider";
import { getCurrentUser, getDailyUsage, incrementUsage } from "@/lib/user";
import {
  getOralExaminerSystemPrompt,
  getTopicTaskPrompt,
} from "@/lib/prompts/oral-exam";
import type { ExamLevel, OralTaskType } from "@prisma/client";

const VALID_LEVELS: ExamLevel[] = ["ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"];
const ALL_TASKS: OralTaskType[] = ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"];

// Per-level allowed tasks (Trinity official spec)
const ALLOWED_TASKS_BY_LEVEL: Record<ExamLevel, OralTaskType[]> = {
  ISE_FOUNDATION: ["TOPIC", "CONVERSATION", "LISTENING"],
  ISE_I:          ["TOPIC", "CONVERSATION", "LISTENING"],
  ISE_II:         ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"],
  ISE_III:        ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"],
  ISE_IV:         ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"],
};

interface Body {
  level?: string;
  selectedTasks?: string[];
  topicGeneral?: string;
  topicDetailed?: string;
  /** Legacy: single topic string (kept for backward compat) */
  topic?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = (await req.json()) as Body;
    const level = body.level;

    if (!level || !VALID_LEVELS.includes(level as ExamLevel)) {
      return NextResponse.json({ error: "Invalid exam level" }, { status: 400 });
    }
    const lvl = level as ExamLevel;

    // Validate selectedTasks against allowed for this level (fallback: all allowed)
    const requested = (body.selectedTasks ?? ALLOWED_TASKS_BY_LEVEL[lvl])
      .filter((t): t is OralTaskType => ALL_TASKS.includes(t as OralTaskType))
      .filter(t => ALLOWED_TASKS_BY_LEVEL[lvl].includes(t));

    if (requested.length === 0) {
      return NextResponse.json({ error: "Select at least one task" }, { status: 400 });
    }

    // Preserve canonical order (Topic → Collab → Conversation → Listening)
    const order: OralTaskType[] = ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"];
    const selectedTasks = order.filter(t => requested.includes(t));

    // Topic content: prefer new fields, fallback to legacy `topic`
    const topicGeneral = (body.topicGeneral ?? "").trim() || null;
    const topicDetailed = (body.topicDetailed ?? body.topic ?? "").trim() || null;

    // If TOPIC selected, require some content (general or detailed)
    if (selectedTasks.includes("TOPIC") && !topicGeneral && !topicDetailed) {
      return NextResponse.json({ error: "Please provide topic content (general or detailed)" }, { status: 400 });
    }

    // Daily limit check
    const usage = await getDailyUsage(user.id);
    if (!usage.canTakeOral) {
      return NextResponse.json(
        { error: "Daily limit reached. Upgrade to Pro for unlimited exams." },
        { status: 429 },
      );
    }

    // Create exam
    const exam = await prisma.oralExam.create({
      data: {
        userId: user.id,
        level: lvl,
        status: "IN_PROGRESS",
        selectedTasks,
        topicGeneral,
        topicDetailed,
      },
    });

    // Generate examiner opening for the FIRST selected task
    const firstTask = selectedTasks[0];
    let examinerOpening = "";

    if (firstTask === "TOPIC") {
      const topicForPrompt = topicDetailed || topicGeneral || "general topic";
      const systemPrompt = getOralExaminerSystemPrompt(lvl);
      const topicPrompt = getTopicTaskPrompt(lvl, topicForPrompt);
      examinerOpening = await generateChat(systemPrompt, topicPrompt, {
        temperature: 0.7,
        maxTokens: 200,
      });
    } else if (firstTask === "CONVERSATION") {
      const systemPrompt = getOralExaminerSystemPrompt(lvl);
      examinerOpening = await generateChat(
        systemPrompt,
        `The candidate has chosen to skip the Topic task. Begin the Conversation task. Choose one of the official ISE conversation subject areas for ${lvl} and open the discussion with one focused question. Keep it natural and friendly.`,
        { temperature: 0.7, maxTokens: 180 },
      );
    } else if (firstTask === "COLLABORATIVE") {
      const systemPrompt = getOralExaminerSystemPrompt(lvl);
      examinerOpening = await generateChat(
        systemPrompt,
        `Begin the Collaborative task. Present a short prompt (an opinion or situation) that the candidate should respond to by asking questions, weighing pros/cons, and concluding. Stop talking after presenting the prompt so the candidate can begin.`,
        { temperature: 0.7, maxTokens: 200 },
      );
    } else {
      // LISTENING — placeholder, full handling in phase 4
      examinerOpening = "We will now do the Independent Listening task. (Audio playback coming soon.)";
    }

    await prisma.oralExchange.create({
      data: {
        examId: exam.id,
        taskType: firstTask,
        role: "EXAMINER",
        content: examinerOpening,
        order: 0,
      },
    });

    await incrementUsage(user.id, "oral");

    return NextResponse.json({
      examId: exam.id,
      examinerMessage: examinerOpening,
      selectedTasks,
    });
  } catch (error) {
    console.error("Error starting oral exam:", error);
    return NextResponse.json({ error: "Failed to start oral exam" }, { status: 500 });
  }
}
