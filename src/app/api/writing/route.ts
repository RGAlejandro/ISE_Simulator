import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getDailyUsage, incrementUsage } from "@/lib/user";
import { generateJSON } from "@/lib/ai-provider";
import { EXAM_LEVELS } from "@/lib/constants";
import { getLevelSpec } from "@/lib/prompts/written-exam";
import { getWritingTaskPrompt } from "@/lib/prompts/writing";
import { WRITING_MINUTES, WRITING_TASK_TYPES, sanitizeWritingTask } from "@/lib/writing";
import type { ExamLevel, WritingTaskType } from "@/types";

const VALID_LEVELS = EXAM_LEVELS.map((l) => l.value) as string[];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Create a Writing Lab practice: generate one Trinity Task 3 or Task 4 item. */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { level, taskType, genre, topic } = body as {
      level?: string; taskType?: string; genre?: string; topic?: string;
    };

    if (!level || !VALID_LEVELS.includes(level)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }
    if (!taskType || !WRITING_TASK_TYPES.includes(taskType as WritingTaskType)) {
      return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
    }
    const examLevel = level as ExamLevel;
    const type = taskType as WritingTaskType;
    const spec = getLevelSpec(examLevel);
    const genres = type === "READING_INTO_WRITING" ? spec.writingTypes.riw : spec.writingTypes.ew;

    const chosenGenre = !genre || genre === "random" ? pick(genres) : genre;
    if (!genres.includes(chosenGenre)) {
      return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
    }
    const chosenTopic = !topic || topic === "random" ? pick(spec.topics) : topic;
    if (!spec.topics.includes(chosenTopic)) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 400 });
    }

    const usage = await getDailyUsage(user.id);
    if (!usage.canTakeWriting) {
      return NextResponse.json(
        { error: "Daily writing limit reached. Upgrade to Pro for unlimited writing practice." },
        { status: 429 },
      );
    }

    const prompt = getWritingTaskPrompt({ level: examLevel, taskType: type, genre: chosenGenre, topic: chosenTopic });
    const opts = {
      taskType: type,
      wordLimit: type === "READING_INTO_WRITING" ? spec.writingWordLimit.riw : spec.writingWordLimit.ew,
      minutes: WRITING_MINUTES[type],
    };
    let task = sanitizeWritingTask(await generateJSON(prompt, { temperature: 0.8, prefer: "gemini" }), opts);
    if (!task) {
      // One retry — the model occasionally drops a source text or the bullets.
      task = sanitizeWritingTask(await generateJSON(prompt, { temperature: 0.7, prefer: "gemini" }), opts);
    }
    if (!task) {
      return NextResponse.json({ error: "Couldn't generate a good task. Please try again." }, { status: 503 });
    }

    const practice = await prisma.writingPractice.create({
      data: {
        userId: user.id,
        level: examLevel,
        taskType: type,
        genre: chosenGenre,
        topic: chosenTopic,
        task: JSON.parse(JSON.stringify(task)),
      },
    });
    await incrementUsage(user.id, "writing");

    return NextResponse.json({ id: practice.id });
  } catch (err) {
    console.error("Writing create error:", err);
    return NextResponse.json({ error: "Failed to create writing task" }, { status: 500 });
  }
}
