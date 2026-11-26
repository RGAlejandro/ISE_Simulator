import { WRITING_ERROR_TAGS, type WritingErrorTag } from "@/lib/writing";
import type { WritingEvaluation } from "@/types";

/**
 * The Teacher: short lessons built from the learner's own mistakes. The marked
 * writings (practice and official papers) already tag every error; the most
 * frequent tags become lessons that explain the rule with the learner's own
 * sentences and then drill it. Lessons are GrammarSession rows with
 * exerciseType "lesson".
 */

export const LESSON_TYPE = "lesson";
export const LESSON_EXERCISES = 10;
/** The learner's own sentences turned into "fix it" items, at most. */
export const MAX_OWN_EXERCISES = 4;
/** Free plan: lessons per day. */
export const FREE_LESSONS_PER_DAY = 1;

/** Tags a lesson can be about ("other" can't). */
export const TEACHABLE_TAGS = WRITING_ERROR_TAGS.filter((t) => t !== "other") as Exclude<WritingErrorTag, "other">[];
export type TeachableTag = (typeof TEACHABLE_TAGS)[number];

export function isTeachable(v: unknown): v is TeachableTag {
  return typeof v === "string" && (TEACHABLE_TAGS as string[]).includes(v);
}

// ─── Diagnosis ───────────────────────────────────────────────────────────────

export interface OwnMistake {
  /** The sentence of the learner's text that contains the error. */
  sentence: string;
  /** The wrong span, exactly as written (inside `sentence`). */
  quote: string;
  correction: string;
  explanation: string;
}

export interface TagDiagnosis {
  tag: TeachableTag;
  count: number;
  /** Writings where it appears. */
  writings: number;
  /** Newest first. */
  examples: OwnMistake[];
}

export interface MarkedDraft {
  text: string;
  feedback: WritingEvaluation;
  createdAt: Date;
}

/** The sentence around [start, end) of `text`. */
export function sentenceAround(text: string, start: number, end: number): string {
  let a = start;
  while (a > 0 && !/[.!?\n]/.test(text[a - 1])) a--;
  let b = end;
  while (b < text.length && !/[.!?\n]/.test(text[b])) b++;
  if (b < text.length && /[.!?]/.test(text[b])) b++;
  const s = text.slice(a, b).replace(/\s+/g, " ").trim();
  // A runaway "sentence" (no full stops) is cut around the error.
  if (s.length <= 260) return s;
  const from = Math.max(0, start - 110);
  return `…${text.slice(from, Math.min(text.length, end + 110)).replace(/\s+/g, " ").trim()}…`;
}

/**
 * Count the learner's errors by tag across first drafts (rewrites repeat the
 * same mistakes), newest first, keeping each error's sentence.
 */
export function diagnose(drafts: MarkedDraft[], maxExamples = 8): TagDiagnosis[] {
  const byTag = new Map<TeachableTag, TagDiagnosis & { seen: Set<number> }>();
  const sorted = [...drafts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  sorted.forEach((d, i) => {
    for (const issue of d.feedback?.issues ?? []) {
      if (!isTeachable(issue.tag)) continue;
      const stat = byTag.get(issue.tag) ?? { tag: issue.tag, count: 0, writings: 0, examples: [], seen: new Set<number>() };
      stat.count++;
      if (!stat.seen.has(i)) { stat.seen.add(i); stat.writings++; }
      const at = issue.quote ? d.text.indexOf(issue.quote) : -1;
      if (at >= 0 && stat.examples.length < maxExamples) {
        stat.examples.push({
          sentence: sentenceAround(d.text, at, at + issue.quote.length),
          quote: issue.quote,
          correction: issue.correction,
          explanation: issue.explanation,
        });
      }
      byTag.set(issue.tag, stat);
    }
  });
  return [...byTag.values()]
    .map((s) => ({ tag: s.tag, count: s.count, writings: s.writings, examples: s.examples }))
    .sort((a, b) => b.count - a.count || b.writings - a.writings);
}

/** Errors of one tag in drafts marked after `since` (to see if a lesson helped). */
export function errorsSince(drafts: MarkedDraft[], tag: string, since: Date): { errors: number; writings: number } {
  const after = drafts.filter((d) => d.createdAt > since);
  return {
    errors: after.reduce((n, d) => n + (d.feedback?.issues ?? []).filter((x) => x.tag === tag).length, 0),
    writings: after.length,
  };
}

// ─── Lesson content ──────────────────────────────────────────────────────────

export interface LessonRule {
  title: string;
  explanation: string;
  examples: { wrong: string; right: string }[];
}

export interface TeacherLesson {
  title: string;
  /** What the learner's mistakes show, in their language. */
  intro: string;
  rules: LessonRule[];
  /** One exam tip. */
  tip: string;
  /** The learner's own mistakes the lesson is built on (shown as they wrote them). */
  mistakes: OwnMistake[];
}

export type LessonExercise =
  | { id: string; kind: "fix"; sentence: string; highlight: string; accepted: string[]; explanation: string; own: boolean }
  | { id: string; kind: "gap"; sentence: string; hint: string; accepted: string[]; explanation: string }
  | { id: string; kind: "choice"; question: string; options: string[]; answer: number; explanation: string };

/** What the browser gets before checking: no answers. */
export type ClientExercise =
  | { id: string; kind: "fix"; sentence: string; highlight: string; own: boolean }
  | { id: string; kind: "gap"; sentence: string; hint: string }
  | { id: string; kind: "choice"; question: string; options: string[] };

export interface ExerciseResult {
  id: string;
  given: string;
  ok: boolean;
  /** The answer to show (first accepted form / the right option). */
  expected: string;
  explanation: string;
  /** Set when the AI accepted an answer that wasn't among the expected ones. */
  note?: string;
  /** The teacher's word on a wrong answer: why theirs doesn't work here and why the right one does. */
  why?: string;
}

/** What a checked lesson stores: each exercise plus the teacher's closing comment. */
export interface LessonFeedback {
  results: ExerciseResult[];
  comment: string;
}

/** Stored feedback, old (a bare results array) or new. */
export function readLessonFeedback(raw: unknown): LessonFeedback | null {
  if (Array.isArray(raw)) return { results: raw as ExerciseResult[], comment: "" };
  if (raw && typeof raw === "object" && Array.isArray((raw as LessonFeedback).results)) {
    const f = raw as LessonFeedback;
    return { results: f.results, comment: typeof f.comment === "string" ? f.comment : "" };
  }
  return null;
}

/** The task as text, for the AI's review of a wrong answer. */
export function describeExercise(e: LessonExercise): string {
  if (e.kind === "fix") return `Correct the part ${JSON.stringify(e.highlight)} in: ${JSON.stringify(e.sentence)}. The learner writes only the replacement for that part (or the whole sentence).`;
  if (e.kind === "gap") return `Fill the gap (___) in: ${JSON.stringify(e.sentence)}${e.hint ? ` (hint: ${e.hint})` : ""}.`;
  return `Choose the option for: ${JSON.stringify(e.question)}. Options: ${e.options.map((o) => JSON.stringify(o)).join(", ")}.`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const strList = (v: unknown, max: number, each: number) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(/\s*\/\s*/) : [])
    .map((x) => str(x, each))
    .filter(Boolean)
    .slice(0, max);

/** Validate the model's lesson. Returns null if it's unusable. */
export function sanitizeLesson(raw: unknown, mistakes: OwnMistake[]): { lesson: TeacherLesson; exercises: LessonExercise[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const rules: LessonRule[] = (Array.isArray(o.rules) ? o.rules : [])
    .map((r): LessonRule | null => {
      const x = (r ?? {}) as Record<string, unknown>;
      const title = str(x.title, 120);
      const explanation = str(x.explanation, 700);
      if (!title || !explanation) return null;
      const examples = (Array.isArray(x.examples) ? x.examples : [])
        .map((e) => {
          const y = (e ?? {}) as Record<string, unknown>;
          return { wrong: str(y.wrong, 200), right: str(y.right, 200) };
        })
        .filter((e) => e.right)
        .slice(0, 3);
      return { title, explanation, examples };
    })
    .filter((r): r is LessonRule => r !== null)
    .slice(0, 5);

  const exercises: LessonExercise[] = [];
  for (const e of Array.isArray(o.exercises) ? o.exercises : []) {
    if (exercises.length >= LESSON_EXERCISES) break;
    const x = (e ?? {}) as Record<string, unknown>;
    const id = `e${exercises.length + 1}`;
    const explanation = str(x.explanation, 400);
    const kind = str(x.kind ?? x.type, 12).toLowerCase();
    if (kind === "fix") {
      const sentence = str(x.sentence, 320);
      const highlight = str(x.highlight, 120);
      const accepted = strList(x.accepted ?? x.answer, 5, 120);
      if (!sentence || !highlight || !sentence.includes(highlight) || accepted.length === 0) continue;
      // A "correction" identical to the highlighted text isn't an exercise.
      if (accepted.some((a) => normalizeAnswer(a) === normalizeAnswer(highlight))) continue;
      const own = mistakes.some((m) => m.sentence === sentence || (m.quote === highlight && sentence.includes(m.quote)));
      exercises.push({ id, kind: "fix", sentence, highlight, accepted, explanation, own });
    } else if (kind === "gap") {
      const sentence = str(x.sentence, 320);
      const accepted = strList(x.accepted ?? x.answer, 5, 80);
      if (!sentence.includes("___") || accepted.length === 0) continue;
      // The answer written in brackets next to the gap gives it away.
      const brackets = [...sentence.matchAll(/\(([^)]*)\)/g)].map((m) => normalizeAnswer(m[1]));
      if (brackets.some((b) => accepted.some((a) => normalizeAnswer(a) === b))) continue;
      exercises.push({ id, kind: "gap", sentence, hint: gapHint(str(x.hint, 80), accepted[0]), accepted, explanation });
    } else if (kind === "choice") {
      const question = str(x.question, 320);
      const options = strList(x.options, 4, 160);
      const answer = typeof x.answer === "number" ? x.answer : Number(x.answer);
      if (!question || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
      if (new Set(options.map(normalizeAnswer)).size !== options.length) continue;
      exercises.push({ id, kind: "choice", question, options, answer, explanation });
    }
  }

  const title = str(o.title, 120);
  if (!title || rules.length === 0 || exercises.length < 6) return null;
  return {
    lesson: { title, intro: str(o.intro, 600), rules, tip: str(o.tip, 400), mistakes },
    exercises,
  };
}

/** Hints that only name the word class: on their own they leave a vocabulary gap open to guesswork. */
const WORD_CLASS_ONLY = new Set([
  "verb", "noun", "adjective", "adverb", "phrase", "expression",
  "verbo", "sustantivo", "nombre", "adjetivo", "adverbio", "expresión",
  "verbe", "nom", "adjectif", "adverbe", "expression",
]);

/**
 * First letter and length of the answer ("a______"). Short answers
 * (prepositions, articles) get none: the grammar decides them and a letter
 * would give them away.
 */
export function letterHint(answer: string): string {
  const a = answer.trim();
  if (a.replace(/[^a-z]/gi, "").length <= 4) return "";
  return [...a].map((ch, i) => (i === 0 || !/[a-z]/i.test(ch) ? ch : "_")).join("");
}

/**
 * The clue shown next to a gap, so it has one answer you can work out: the
 * model's hint, plus the first letter when the hint is missing or only says
 * "verb" (e.g. "It is vital that we ___ the root causes" fits several verbs).
 */
export function gapHint(hint: string, answer: string): string {
  const h = hint.trim();
  const letters = letterHint(answer);
  if (!letters || (h && !WORD_CLASS_ONLY.has(h.toLowerCase()))) return h;
  return h ? `${h} · ${letters}` : letters;
}

export function toClientExercise(e: LessonExercise): ClientExercise {
  if (e.kind === "fix") return { id: e.id, kind: "fix", sentence: e.sentence, highlight: e.highlight, own: e.own };
  // gapHint again here: lessons made before it existed get the letter clue too.
  if (e.kind === "gap") return { id: e.id, kind: "gap", sentence: e.sentence, hint: gapHint(e.hint, e.accepted[0] ?? "") };
  return { id: e.id, kind: "choice", question: e.question, options: e.options };
}

// ─── Checking ────────────────────────────────────────────────────────────────

export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    // Quotes and end punctuation in any order: `"on".` and `on.` both become `on`.
    .replace(/^["'\s]+|["'.!?,;:\s]+$/g, "")
    .replace(/\s+/g, " ");
}

export function checkExercise(e: LessonExercise, given: string): ExerciseResult {
  if (e.kind === "choice") {
    const pick = Number(given);
    return { id: e.id, given, ok: Number.isInteger(pick) && pick === e.answer, expected: e.options[e.answer], explanation: e.explanation };
  }
  const g = normalizeAnswer(given);
  const ok = g !== "" && e.accepted.some((a) => {
    const n = normalizeAnswer(a);
    // "fix": also accept the whole corrected sentence typed out.
    return g === n || (e.kind === "fix" && g === normalizeAnswer(e.sentence.replace(e.highlight, a)));
  });
  return { id: e.id, given, ok, expected: e.accepted[0], explanation: e.explanation };
}
