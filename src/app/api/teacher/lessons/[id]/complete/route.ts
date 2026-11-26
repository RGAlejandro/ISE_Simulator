import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/ai-provider";
import { consumeAiAssist, getCurrentUser, isProUser } from "@/lib/user";
import {
  LESSON_TYPE,
  checkExercise,
  describeExercise,
  isTeachable,
  readLessonFeedback,
  type ExerciseResult,
  type LessonExercise,
  type LessonFeedback,
  type TeacherLesson,
} from "@/lib/teacher";
import { teacherReviewPrompt } from "@/lib/prompts/teacher";

/**
 * Check a lesson's exercises against the answers that came with it, then one
 * AI review of the wrong ones: an answer that is also right (a correction often
 * has several valid forms) is accepted, the rest get a personal explanation,
 * and the teacher closes with a comment on the whole lesson.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const session = await prisma.grammarSession.findUnique({ where: { id } });
    if (!session || session.userId !== user.id || session.exerciseType !== LESSON_TYPE) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (session.completedAt) {
      return NextResponse.json({ ...readLessonFeedback(session.feedback), score: session.score });
    }

    const body = (await req.json().catch(() => ({}))) as { answers?: unknown; locale?: unknown };
    const locale = typeof body.locale === "string" ? body.locale : "es";
    const raw = body.answers && typeof body.answers === "object" ? (body.answers as Record<string, unknown>) : {};
    const exercises = session.questions as unknown as LessonExercise[];
    const answers: Record<string, string> = {};
    for (const e of exercises) answers[e.id] = typeof raw[e.id] === "string" ? (raw[e.id] as string).slice(0, 300) : "";

    const results: ExerciseResult[] = exercises.map((e) => checkExercise(e, answers[e.id]));

    const feedback: LessonFeedback = { results, comment: "" };

    const wrong = exercises.filter((e, i) => !results[i].ok && answers[e.id].trim().length > 0);
    if (wrong.length > 0 && isTeachable(session.focus) && (await consumeAiAssist(user.id, isProUser(user)))) {
      const lesson = session.lesson as unknown as TeacherLesson | null;
      const prompt = teacherReviewPrompt({
        topic: session.focus,
        locale,
        items: wrong.map((e) => ({
          id: e.id,
          task: describeExercise(e),
          expected: e.kind === "choice" ? [e.options[e.answer]] : e.accepted,
          given: e.kind === "choice" ? (e.options[Number(answers[e.id])] ?? answers[e.id]) : answers[e.id],
          why: e.explanation,
        })),
        mistakes: lesson?.mistakes ?? [],
        score: results.filter((r) => r.ok).length,
        total: results.length,
      });
      // Gemini first: slower (~10 s) but its explanations are the accurate, personal ones.
      const review = await generateJSON(prompt, { temperature: 0.2, prefer: "gemini" }).catch(() => null);
      for (const v of Array.isArray(review?.verdicts) ? review.verdicts : []) {
        const r = results.find((x) => x.id === v?.id);
        if (!r || r.ok || !wrong.some((e) => e.id === r.id)) continue;
        const text = typeof v?.feedback === "string" ? v.feedback.replace(/\s+/g, " ").trim().slice(0, 500) : "";
        if (v?.ok === true) {
          r.ok = true;
          r.note = text;
        } else if (text) {
          r.why = text;
        }
      }
      if (typeof review?.comment === "string") feedback.comment = review.comment.replace(/\s+/g, " ").trim().slice(0, 700);
    }
    const score = results.filter((r) => r.ok).length;

    await prisma.grammarSession.update({
      where: { id },
      data: { responses: answers, feedback: JSON.parse(JSON.stringify(feedback)), score, completedAt: new Date() },
    });
    return NextResponse.json({ ...feedback, score });
  } catch (err) {
    console.error("[teacher] complete error:", err);
    return NextResponse.json({ error: "Failed to check the lesson" }, { status: 500 });
  }
}
