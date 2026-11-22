import type { ExamLevel } from "@/types";

/**
 * AI mini-lesson for a teacher, built ONLY from aggregated class weaknesses
 * (criterion averages + error-tag counts). No student text ever reaches the
 * prompt, so nothing personal leaks into the model call.
 */

export interface LessonFocus {
  level: ExamLevel;
  cefr: string;
  students: number;
  criteria: { label: string; value: number }[];
  errors: { tag: string; students: number; occurrences: number }[];
}

export interface TeamLessonContent {
  title: string;
  objective: string;
  minutes: number;
  warmUp: string;
  points: { point: string; example: string; mistake: string; fix: string }[];
  exercise: { instruction: string; items: { prompt: string; answer: string }[] };
  speakingTask: string;
  homework: string;
}

export function getTeamLessonPrompt(f: LessonFocus): string {
  const crit = f.criteria.map((c) => `- ${c.label}: class average ${Math.round(c.value * 100)}% of the Trinity maximum (Pass ≈ 50%)`).join("\n") || "- (no criterion data)";
  const errs = f.errors.map((e) => `- ${e.tag}: ${e.occurrences} errors by ${e.students} of ${f.students} students`).join("\n") || "- (no error data)";
  return `You are an experienced Trinity ISE teacher trainer. Design a focused 10-minute mini-lesson for a class preparing Trinity ISE ${f.level.replace("ISE_", "")} (CEFR ${f.cefr}), ${f.students} students.

The class's weakest Trinity marking criteria:
${crit}

The most common mistakes in their marked writing (error-notebook tags):
${errs}

Target the 2–3 issues that would raise the most students' marks. Pitch every example at ${f.cefr} and in ISE task contexts (formal emails, essays, reviews, discussions). Use British English.

Return ONLY this JSON:
{
  "title": "short lesson title",
  "objective": "one sentence: what students will be able to do",
  "minutes": 10,
  "warmUp": "a 1-2 minute warm-up the teacher can run immediately",
  "points": [
    { "point": "the rule or strategy, in one sentence", "example": "a correct ${f.cefr} example sentence", "mistake": "a typical wrong sentence", "fix": "the corrected sentence" }
  ],
  "exercise": {
    "instruction": "instruction for a 6-item exercise",
    "items": [ { "prompt": "item with a gap or an error to fix", "answer": "the answer" } ]
  },
  "speakingTask": "a 2-minute pair-speaking activity that practises the same points (ISE Collaborative/Conversation style)",
  "homework": "one short follow-up task using the app (e.g. a Writing Lab task type or genre)"
}
Give 2-3 points and exactly 6 exercise items.`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Clamp and shape the model output; returns null if it's unusable. */
export function sanitizeLesson(raw: unknown): TeamLessonContent | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const points = (Array.isArray(o.points) ? o.points : [])
    .slice(0, 3)
    .map((p) => {
      const q = (p ?? {}) as Record<string, unknown>;
      return { point: str(q.point, 300), example: str(q.example, 300), mistake: str(q.mistake, 300), fix: str(q.fix, 300) };
    })
    .filter((p) => p.point);
  const ex = (o.exercise ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(ex.items) ? ex.items : [])
    .slice(0, 8)
    .map((it) => {
      const q = (it ?? {}) as Record<string, unknown>;
      return { prompt: str(q.prompt, 300), answer: str(q.answer, 200) };
    })
    .filter((it) => it.prompt && it.answer);
  const title = str(o.title, 120);
  if (!title || points.length === 0 || items.length === 0) return null;
  return {
    title,
    objective: str(o.objective, 300),
    minutes: 10,
    warmUp: str(o.warmUp, 600),
    points,
    exercise: { instruction: str(ex.instruction, 300), items },
    speakingTask: str(o.speakingTask, 600),
    homework: str(o.homework, 400),
  };
}
