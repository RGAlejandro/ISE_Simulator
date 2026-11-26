import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/ai-provider";
import { quizCheckPrompt, quizQuestionsPrompt } from "@/lib/prompts/quiz";
import { DICTIONARIES, LOCALES, type Locale } from "@/i18n";
import { LESSON_TYPE, describeExercise, readLessonFeedback, sentenceAround, type LessonExercise } from "@/lib/teacher";
import type { TranslationItem, TranslationResult } from "@/lib/translation";
import {
  FREE_QUIZZES_PER_DAY, QUIZ_TYPE, masteryFrom, sanitizeQuestions, shuffleOptions,
  type MistakeRecord, type QuizQuestion, type QuizSeed,
} from "@/lib/quiz";
import type { WritingEvaluation } from "@/types";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Every mistake the quiz can use, from all the places the learner practises. */
export async function loadQuizSeeds(userId: string): Promise<QuizSeed[]> {
  const [drafts, rounds, lessons, words] = await Promise.all([
    prisma.writingDraft.findMany({
      // Same writings as the Writing notebook: hidden (deleted) practices don't count.
      where: { version: 1, practice: { userId, hiddenAt: null } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, text: true, feedback: true, createdAt: true },
    }),
    prisma.translationSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, items: true, answers: true, createdAt: true },
    }),
    prisma.grammarSession.findMany({
      where: { userId, exerciseType: LESSON_TYPE, completedAt: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, focus: true, questions: true, feedback: true, completedAt: true },
    }),
    prisma.savedWord.findMany({
      // Words the spaced-repetition review shows they keep missing.
      where: { userId, OR: [{ lapses: { gt: 0 } }, { reviewCount: { gt: 0 }, srsBox: { lte: 1 } }] },
      orderBy: [{ lapses: "desc" }, { lastReviewedAt: "desc" }],
      take: 40,
      select: { id: true, english: true, spanish: true, example: true, partOfSpeech: true, lastReviewedAt: true, createdAt: true },
    }),
  ]);

  const seeds: QuizSeed[] = [];

  for (const d of drafts) {
    const issues = (d.feedback as unknown as WritingEvaluation | null)?.issues;
    if (!Array.isArray(issues)) continue;
    issues.forEach((issue, i) => {
      if (!issue?.quote || !issue.correction || same(issue.quote, issue.correction) || issue.quote.length > 120) return;
      const at = d.text.slice(issue.start, issue.end) === issue.quote ? issue.start : d.text.indexOf(issue.quote);
      if (at < 0) return;
      seeds.push({
        key: `w:${d.id}:${i}`,
        source: "writing",
        date: d.createdAt.toISOString(),
        sentence: sentenceAround(d.text, at, at + issue.quote.length),
        quote: issue.quote,
        correction: issue.correction,
        explanation: issue.explanation ?? "",
        tag: issue.tag ?? "other",
      });
    });
  }

  for (const r of rounds) {
    const items = (r.items ?? []) as unknown as TranslationItem[];
    const answers = (r.answers ?? {}) as unknown as Record<string, TranslationResult>;
    for (const item of items) {
      const a = answers[item.id];
      if (!a || a.verdict === "correct" || !a.answer) continue;
      seeds.push({
        key: `t:${r.id}:${item.id}`,
        source: "translation",
        date: r.createdAt.toISOString(),
        spanish: item.source,
        answer: a.answer,
        corrected: a.corrected || item.reference,
        note: a.note,
        structure: item.structure,
      });
    }
  }

  for (const l of lessons) {
    const exercises = (l.questions ?? []) as unknown as LessonExercise[];
    const results = readLessonFeedback(l.feedback)?.results ?? [];
    for (const r of results) {
      const e = exercises.find((x) => x.id === r.id);
      if (!e || r.ok || !r.given.trim()) continue;
      const given = e.kind === "choice" ? e.options[Number(r.given)] ?? "" : r.given;
      if (!given) continue;
      seeds.push({
        key: `g:${l.id}:${e.id}`,
        source: "teacher",
        date: (l.completedAt ?? new Date()).toISOString(),
        topic: l.focus ?? "",
        task: describeExercise(e),
        given,
        expected: r.expected,
        explanation: r.why || r.explanation,
      });
    }
  }

  for (const w of words) {
    seeds.push({
      key: `v:${w.id}`,
      source: "vocab",
      date: (w.lastReviewedAt ?? w.createdAt).toISOString(),
      wordId: w.id,
      english: w.english,
      translation: w.spanish,
      example: w.example,
      partOfSpeech: w.partOfSpeech ?? "",
    });
  }

  return seeds;
}

/** The learner's past quizzes, folded into how each mistake went. */
export async function loadMastery(userId: string): Promise<Map<string, MistakeRecord>> {
  const quizzes = await prisma.grammarSession.findMany({
    where: { userId, exerciseType: QUIZ_TYPE },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: { questions: true, responses: true, createdAt: true },
  });
  return masteryFrom(quizzes);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Free plan: one quiz a day. */
export async function canStartQuiz(userId: string, isPro: boolean): Promise<boolean> {
  if (isPro) return true;
  const today = await prisma.grammarSession.count({
    where: { userId, exerciseType: QUIZ_TYPE, createdAt: { gte: startOfToday() } },
  });
  return today < FREE_QUIZZES_PER_DAY;
}

// ─── Vocabulary questions (no AI: the other options are the learner's own words) ──

export interface PoolWord {
  english: string;
  spanish: string;
  partOfSpeech: string | null;
}

export async function loadWordPool(userId: string): Promise<PoolWord[]> {
  return prisma.savedWord.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { english: true, spanish: true, partOfSpeech: true },
  });
}

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const baseType = (pos: string | null) => (pos ?? "").split("·")[0].trim().toLowerCase();

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "What does X mean?" or "How do you say Y in English?", with three of the learner's other words as options. */
export function vocabQuestion(seed: Extract<QuizSeed, { source: "vocab" }>, pool: PoolWord[], locale: string): Omit<QuizQuestion, "id"> | null {
  const v = DICTIONARIES[(LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : "es"].quiz.vocab;
  const others = pool.filter((w) => !same(w.english, seed.english) && !same(w.spanish, seed.translation));
  // Same word type first: "decipher" vs other verbs is a real choice.
  const kind = baseType(seed.partOfSpeech);
  const ranked = [...shuffled(others.filter((w) => baseType(w.partOfSpeech) === kind)), ...shuffled(others.filter((w) => baseType(w.partOfSpeech) !== kind))];
  const meaning = Math.random() < 0.5;
  const picks: PoolWord[] = [];
  for (const w of ranked) {
    const text = meaning ? w.spanish : w.english;
    if (picks.some((p) => same(meaning ? p.spanish : p.english, text))) continue;
    picks.push(w);
    if (picks.length === 3) break;
  }
  if (picks.length < 3) return null;

  const right = {
    text: meaning ? seed.translation : seed.english,
    why: fill(v.rightWhy, { en: seed.english, tr: seed.translation, example: seed.example }),
  };
  const wrong = picks.map((w) => ({
    text: meaning ? w.spanish : w.english,
    why: fill(v.otherWhy, { x: meaning ? w.spanish : w.english, y: meaning ? w.english : w.spanish }),
  }));
  return {
    key: seed.key,
    source: "vocab",
    date: seed.date,
    topic: "",
    prompt: meaning ? v.meaningPrompt : v.wordPrompt,
    question: meaning ? seed.english : seed.translation,
    ...shuffleOptions([right, ...wrong], 0),
    yours: "",
  };
}

// ─── Questions written by the model ──────────────────────────────────────────

type AiSeed = Exclude<QuizSeed, { source: "vocab" }>;

/** Resolves to null if `p` fails or takes longer than `ms` (the request keeps going, unused). */
function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** How long to wait for Gemini before writing the questions with the fast provider. */
const GEMINI_WAIT_MS = 30_000;

/**
 * One multiple-choice question per mistake, in two halves in parallel (one
 * call for ~12 questions takes Gemini ~40 s). Gemini writes the better, more
 * personal explanations; when it's slow or out of quota the fast provider
 * writes them instead. Then every question gets a second look.
 */
export async function writeQuestions(seeds: AiSeed[], cefr: string, locale: string): Promise<Omit<QuizQuestion, "id">[]> {
  const withIds = seeds.map((seed, i) => ({ id: `s${i + 1}`, seed }));
  const half = Math.ceil(withIds.length / 2);
  const chunks = withIds.length > 5 ? [withIds.slice(0, half), withIds.slice(half)] : [withIds];
  const done = await Promise.all(
    chunks.map(async (chunk) => {
      const prompt = quizQuestionsPrompt({ seeds: chunk, cefr, locale });
      const byId = new Map<string, QuizSeed>(chunk.map((x) => [x.id, x.seed]));
      const opts = { temperature: 0.3, maxTokens: 6000 };
      let qs = sanitizeQuestions(await within(generateJSON(prompt, { ...opts, prefer: "gemini" }), GEMINI_WAIT_MS), byId);
      if (qs.length < Math.ceil(chunk.length / 2)) {
        qs = sanitizeQuestions(await generateJSON(prompt, opts).catch(() => null), byId);
      }
      return qs;
    }),
  );
  return checkQuestions(done.flat());
}

/**
 * Drop "wrong" options that are also correct English (a right answer would be
 * marked wrong) and questions whose right answer is doubtful. If the check
 * fails, the questions go out as they are.
 */
export async function checkQuestions(questions: Omit<QuizQuestion, "id">[]): Promise<Omit<QuizQuestion, "id">[]> {
  if (questions.length === 0) return questions;
  const items = questions.map((q, n) => ({
    id: `q${n + 1}`,
    question: q.question,
    right: q.options[q.answer].text,
    wrong: q.options.map((o, i) => ({ i, text: o.text })).filter((o) => o.i !== q.answer),
  }));
  // Small batches in parallel: with a long list the checker pays less attention to each.
  const batches: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += 5) batches.push(items.slice(i, i + 5));
  const raws = await Promise.all(batches.map((b) => within(generateJSON(quizCheckPrompt(b), { temperature: 0.1, maxTokens: 1200 }), 20_000)));
  const checks = raws.flatMap((raw) => (Array.isArray(raw?.checks) ? (raw.checks as { id?: unknown; alsoRight?: unknown; rightIsWrong?: unknown }[]) : []));
  const out: Omit<QuizQuestion, "id">[] = [];
  questions.forEach((q, n) => {
    const c = checks.find((x) => x?.id === `q${n + 1}`);
    if (c?.rightIsWrong === true) return;
    const drop = new Set((Array.isArray(c?.alsoRight) ? c.alsoRight : []).filter((i): i is number => typeof i === "number" && i !== q.answer));
    if (drop.size === 0) return void out.push(q);
    const options = q.options.filter((_, i) => !drop.has(i));
    if (options.length < 3) return;
    out.push({ ...q, options, answer: options.indexOf(q.options[q.answer]) });
  });
  return out;
}
