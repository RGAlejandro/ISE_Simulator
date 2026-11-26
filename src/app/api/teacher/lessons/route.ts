import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai-provider";
import { prisma } from "@/lib/prisma";
import { consumeAiAssist, getCurrentUser, isProUser } from "@/lib/user";
import { LESSON_TYPE, diagnose, isTeachable, sanitizeLesson } from "@/lib/teacher";
import { canStartLesson, cefrFor, loadMarkedDrafts } from "@/lib/teacher-server";
import { teacherLessonPrompt } from "@/lib/prompts/teacher";

/** Mistakes passed to the lesson writer, at most. */
const MAX_MISTAKES = 6;

/** Create a Teacher lesson on one error tag, built on the learner's own mistakes. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isPro = isProUser(user);

    const body = (await req.json().catch(() => ({}))) as { focus?: unknown; locale?: unknown };
    if (!isTeachable(body.focus)) return NextResponse.json({ error: "Invalid topic" }, { status: 400 });
    const focus = body.focus;
    const locale = typeof body.locale === "string" ? body.locale : "es";

    if (!(await canStartLesson(user.id, isPro))) {
      return NextResponse.json({ error: "limit", code: "DAILY_LIMIT" }, { status: 429 });
    }
    if (!(await consumeAiAssist(user.id, isPro))) {
      return NextResponse.json({ error: "limit", code: "AI_LIMIT" }, { status: 429 });
    }

    const level = user.examLevel ?? "ISE_II";
    const cefr = cefrFor(user.examLevel);
    const mistakes = (diagnose(await loadMarkedDrafts(user.id)).find((d) => d.tag === focus)?.examples ?? []).slice(0, MAX_MISTAKES);
    const prompt = teacherLessonPrompt({ tag: focus, level, cefr, locale, mistakes });

    // Gemini first: a teacher can't teach a wrong answer, and it checks itself better.
    let made = sanitizeLesson(await generateJSON(prompt, { temperature: 0.4, prefer: "gemini" }).catch(() => null), mistakes);
    if (!made) made = sanitizeLesson(await generateJSON(prompt, { temperature: 0.5 }).catch(() => null), mistakes);
    if (!made) return NextResponse.json({ error: "Couldn't prepare the lesson", code: "generate" }, { status: 503 });

    const session = await prisma.grammarSession.create({
      data: {
        userId: user.id,
        cefrLevel: cefr,
        exerciseType: LESSON_TYPE,
        focus,
        lesson: JSON.parse(JSON.stringify(made.lesson)),
        questions: JSON.parse(JSON.stringify(made.exercises)),
      },
    });
    return NextResponse.json({ id: session.id });
  } catch (err) {
    console.error("[teacher] lesson error:", err);
    return NextResponse.json({ error: "Couldn't prepare the lesson", code: "generate" }, { status: 500 });
  }
}
