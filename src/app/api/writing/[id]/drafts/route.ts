import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { generateJSON } from "@/lib/ai-provider";
import { awardXp, type AwardResult } from "@/lib/gamification-server";
import { getWritingEvaluationPrompt } from "@/lib/prompts/writing";
import {
  CRITERIA_FOR_TASK, MAX_DRAFTS, MAX_TEXT_CHARS, MIN_SUBMIT_WORDS,
  countWords, meanScore, sanitizeEvaluation,
} from "@/lib/writing";
import type {
  ExamLevel, WritingCriterionKey, WritingDraftData, WritingEvaluation, WritingTaskContent, WritingTaskType,
} from "@/types";

/** XP for a first text and for each rewrite (flat: writing isn't a quiz). */
const XP_FIRST_DRAFT = 60;
const XP_REWRITE = 25;
/** Longest believable time on one task (2h) — anything else is ignored. */
const MAX_SECONDS = 2 * 60 * 60;

/**
 * Submit a draft (first attempt or rewrite) and get it marked: Trinity
 * criteria, located errors, word upgrades and an improved version.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const practice = await prisma.writingPractice.findUnique({
      where: { id },
      include: { drafts: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!practice || practice.userId !== user.id || practice.hiddenAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { text: rawText, source, secondsUsed, locale = "es" } = body as {
      text?: string; source?: string; secondsUsed?: number; locale?: string;
    };
    const text = (rawText ?? "").replace(/\r\n/g, "\n").trim();
    const wordCount = countWords(text);
    if (wordCount < MIN_SUBMIT_WORDS) {
      return NextResponse.json({ error: `Write at least ${MIN_SUBMIT_WORDS} words before submitting.` }, { status: 400 });
    }
    if (text.length > MAX_TEXT_CHARS) {
      return NextResponse.json({ error: "Text too long." }, { status: 400 });
    }

    const previous = practice.drafts[0] ?? null;
    if (previous && previous.version >= MAX_DRAFTS) {
      return NextResponse.json({ error: `You can submit up to ${MAX_DRAFTS} versions per task.` }, { status: 409 });
    }
    if (previous && previous.text.trim() === text) {
      return NextResponse.json({ error: "This version is identical to the previous one." }, { status: 400 });
    }

    const taskType = practice.taskType as WritingTaskType;
    const criteria = CRITERIA_FOR_TASK[taskType];
    const prevFeedback = previous ? (previous.feedback as unknown as WritingEvaluation) : null;
    const prompt = getWritingEvaluationPrompt({
      level: practice.level as ExamLevel,
      taskType,
      genre: practice.genre,
      task: practice.task as unknown as WritingTaskContent,
      text,
      wordCount,
      locale,
      criteria,
      previous: previous && prevFeedback
        ? {
            version: previous.version,
            scores: Object.fromEntries(criteria.map((k) => [k, prevFeedback.criteria[k]?.score])) as Partial<Record<WritingCriterionKey, number>>,
          }
        : null,
    });

    let evaluation = sanitizeEvaluation(await generateJSON(prompt, { temperature: 0.2, prefer: "gemini" }), text, taskType);
    if (!evaluation) {
      evaluation = sanitizeEvaluation(await generateJSON(prompt, { temperature: 0.3, prefer: "gemini" }), text, taskType);
    }
    if (!evaluation) {
      return NextResponse.json({ error: "Couldn't mark your text right now. Please try again." }, { status: 503 });
    }

    const score = meanScore(evaluation, taskType);
    const seconds = typeof secondsUsed === "number" && secondsUsed > 0 && secondsUsed <= MAX_SECONDS
      ? Math.round(secondsUsed)
      : null;

    const draft = await prisma.writingDraft.create({
      data: {
        practiceId: practice.id,
        version: (previous?.version ?? 0) + 1,
        text,
        wordCount,
        source: source === "photo" ? "photo" : "typed",
        secondsUsed: seconds,
        feedback: JSON.parse(JSON.stringify(evaluation)),
        score,
      },
    });
    await prisma.writingPractice.update({ where: { id: practice.id }, data: { updatedAt: new Date() } });

    let award: AwardResult | null = null;
    try {
      award = await awardXp(user.id, {
        correct: 0,
        total: 0,
        countsAsQuest: false,
        xp: previous ? XP_REWRITE : XP_FIRST_DRAFT,
      });
    } catch (err) {
      console.error("[writing] XP award failed:", err);
    }

    const data: WritingDraftData = {
      id: draft.id,
      version: draft.version,
      text: draft.text,
      wordCount: draft.wordCount,
      source: draft.source === "photo" ? "photo" : "typed",
      secondsUsed: draft.secondsUsed,
      score: draft.score,
      feedback: evaluation,
      createdAt: draft.createdAt.toISOString(),
    };
    return NextResponse.json({ draft: data, award });
  } catch (err) {
    // Two submissions racing for the same version number.
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "This version was already submitted." }, { status: 409 });
    }
    console.error("Writing draft error:", err);
    return NextResponse.json({ error: "Failed to mark your text" }, { status: 500 });
  }
}
