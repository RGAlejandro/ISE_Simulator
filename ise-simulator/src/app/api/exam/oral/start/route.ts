import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateChat } from "@/lib/ai-provider";
import { getCurrentUser, getDailyUsage, incrementUsage } from "@/lib/user";
import {
  getOralExaminerSystemPrompt,
  getTopicTaskPrompt,
  getCollaborativeTaskPrompt,
  getConversationTaskPrompt,
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

    // Server-side length limits — oversized payloads never reach the DB or prompts
    const MAX_TOPIC_TEXT = 5000;
    if ((topicGeneral?.length ?? 0) > MAX_TOPIC_TEXT || (topicDetailed?.length ?? 0) > MAX_TOPIC_TEXT) {
      return NextResponse.json(
        { error: `Topic preparation text is too long (max ${MAX_TOPIC_TEXT} characters)` },
        { status: 400 },
      );
    }

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
      // Use the first non-empty piece of prep as the displayed topic seed for the opening line
      const topicForPrompt = topicGeneral?.split("\n").find(l => l.trim())?.trim() || "your prepared topic";
      const systemPrompt = getOralExaminerSystemPrompt(lvl);
      const topicPrompt = getTopicTaskPrompt(lvl, topicForPrompt, {
        general: topicGeneral,
        detailed: topicDetailed,
      });
      examinerOpening = await generateChat(systemPrompt, topicPrompt, {
        temperature: 0.7,
        maxTokens: 200,
      });
    } else if (firstTask === "CONVERSATION") {
      const systemPrompt = getOralExaminerSystemPrompt(lvl);
      examinerOpening = await generateChat(systemPrompt, getConversationTaskPrompt(lvl), {
        temperature: 0.7,
        maxTokens: 180,
      });
    } else if (firstTask === "COLLABORATIVE") {
      const systemPrompt = getOralExaminerSystemPrompt(lvl);
      examinerOpening = await generateChat(systemPrompt, getCollaborativeTaskPrompt(lvl), {
        temperature: 0.7,
        maxTokens: 200,
      });
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
