import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MIN_SUBMIT_WORDS, countWords, stripStruck } from "@/lib/writing";
import { markWritingText } from "@/lib/writing-marking";
import {
  markReading, overallScore, sanitizeAnswers, toWritingTask,
  type OfficialPaperContent, type OfficialWritingTask,
} from "@/lib/official";
import { requireProUser } from "@/lib/official-server";
import type { WritingTaskType } from "@/types";

/**
 * Step 3: mark the answers the learner checked. Reading against the key;
 * each writing through the full Writing marking, saved as a Writing practice
 * so the learner gets the annotated text and can rewrite it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireProUser();
    if ("error" in auth) return auth.error;
    const { user } = auth;
    const { id } = await params;

    const paper = await prisma.officialPaper.findUnique({ where: { id } });
    if (!paper || paper.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.status === "MARKED") return NextResponse.json({ error: "Already marked" }, { status: 409 });

    const body = (await req.json().catch(() => ({}))) as { answers?: unknown; locale?: string };
    const content = paper.content as unknown as OfficialPaperContent;
    const checked = sanitizeAnswers(body.answers, content);
    // ⟦…⟧ fragments left by the learner are treated as crossed out.
    const answers = { ...checked, task3: stripStruck(checked.task3), task4: stripStruck(checked.task4) };
    const locale = typeof body.locale === "string" ? body.locale : "es";

    const reading = content.blocks.length > 0 ? markReading(content, answers) : null;

    const writings: { taskType: WritingTaskType; task: OfficialWritingTask | null; text: string }[] = [
      { taskType: "READING_INTO_WRITING", task: content.task3, text: answers.task3 },
      { taskType: "EXTENDED_WRITING", task: content.task4, text: answers.task4 },
    ];
    const marked = await Promise.all(
      writings.map(async (w) => {
        if (!w.task || countWords(w.text) < MIN_SUBMIT_WORDS) return null;
        const task = toWritingTask(w.task, w.taskType, content.sources);
        const result = await markWritingText({ level: paper.level, taskType: w.taskType, genre: w.task.genre, task, text: w.text, locale });
        if (!result) throw new Error("writing marking failed");
        return { taskType: w.taskType, text: w.text, genre: w.task.genre, task, result };
      }),
    ).catch((err) => {
      console.error("[official] writing marking error:", err);
      return null;
    });
    if (!marked) return NextResponse.json({ error: "Couldn't mark the writing", code: "mark" }, { status: 503 });

    // Each marked writing becomes a Writing practice (annotated text, rewrite, Readiness).
    const practiceIds: (string | null)[] = [];
    for (const m of marked) {
      if (!m) { practiceIds.push(null); continue; }
      const practice = await prisma.writingPractice.create({
        data: {
          userId: user.id,
          level: paper.level,
          taskType: m.taskType,
          genre: m.genre,
          topic: `${paper.title} · ${m.taskType === "READING_INTO_WRITING" ? "Task 3" : "Task 4"}`,
          task: JSON.parse(JSON.stringify(m.task)),
          drafts: {
            create: {
              version: 1,
              text: m.text,
              wordCount: m.result.wordCount,
              source: "photo",
              feedback: JSON.parse(JSON.stringify(m.result.evaluation)),
              score: m.result.score,
            },
          },
        },
      });
      practiceIds.push(practice.id);
    }

    const score = overallScore(reading, marked.filter((m) => m !== null).map((m) => m.result.score));
    await prisma.officialPaper.update({
      where: { id },
      data: {
        answers: JSON.parse(JSON.stringify(answers)),
        readingResult: reading ? JSON.parse(JSON.stringify(reading)) : undefined,
        task3PracticeId: practiceIds[0],
        task4PracticeId: practiceIds[1],
        score,
        status: "MARKED",
      },
    });
    return NextResponse.json({ ok: true, score });
  } catch (err) {
    console.error("[official] mark error:", err);
    return NextResponse.json({ error: "Failed to mark", code: "mark" }, { status: 500 });
  }
}
