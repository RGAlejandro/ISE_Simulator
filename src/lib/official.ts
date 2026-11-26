import type { ExamLevel, ReadingText, WritingTaskContent, WritingTaskType } from "@/types";
import { cleanTranscription } from "@/lib/writing";

/**
 * Official Trinity papers done on paper. The blank paper is read into
 * question blocks (with their answer key), the candidate's answer sheets are
 * transcribed, the learner checks the transcription, then Reading is marked
 * here and each writing goes through the full Writing marking.
 */

export const OFFICIAL_LEVELS: ExamLevel[] = ["ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"];

/** match: one letter per question · select: choose N letters, any order · gap: words from the text. */
export type BlockType = "match" | "select" | "gap";
export type KeySource = "paper" | "upload" | "ai";

export interface OfficialBlock {
  task: 1 | 2;
  from: number;
  to: number;
  type: BlockType;
  instructions: string;
  /** match/select: the lettered options (summaries, statements, texts A–D). */
  options: { letter: string; text: string }[];
  /** match/gap: one stem per question (paragraph label, question, sentence with a gap). */
  items: { num: number; text: string }[];
  /** match/gap: one answer per question, in order ("a / b" lists accepted alternatives). select: the correct letters. */
  key: string[];
}

export interface OfficialWritingTask {
  title: string;
  /** "article", "essay", "review", "email", "report", "story"… */
  genre: string;
  prompt: string;
  bulletPoints: string[];
  wordLimit: { min: number; max: number };
  minutes: number;
}

export interface OfficialPaperContent {
  title: string;
  level: ExamLevel;
  keySource: KeySource;
  /** Task 2 texts: the sources Task 3 is written from. */
  sources: { letter: string; title: string; content: string }[];
  blocks: OfficialBlock[];
  task3: OfficialWritingTask | null;
  task4: OfficialWritingTask | null;
}

export interface OfficialAnswers {
  /** Question number → what the candidate wrote. */
  reading: Record<string, string>;
  task3: string;
  task4: string;
  /** Words the transcription could not read ([?]). */
  illegible: number;
}

export interface OfficialQuestionResult {
  num: number;
  task: 1 | 2;
  type: BlockType;
  given: string;
  expected: string;
  ok: boolean;
}

export interface OfficialReadingResult {
  correct: number;
  total: number;
  task1: { correct: number; total: number };
  task2: { correct: number; total: number };
  questions: OfficialQuestionResult[];
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[ \t]+/g, " ").trim().slice(0, max) : "");
const letter = (v: unknown) => clip(v, 3).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);

function sanitizeTask(raw: unknown): OfficialWritingTask | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const prompt = clip(o.prompt, 2000);
  if (prompt.length < 20) return null;
  const wl = (o.wordLimit ?? {}) as Record<string, unknown>;
  const min = typeof wl.min === "number" && wl.min > 0 ? Math.round(wl.min) : 150;
  const max = typeof wl.max === "number" && wl.max >= min ? Math.round(wl.max) : min + 30;
  return {
    title: clip(o.title, 140) || prompt.slice(0, 80),
    genre: clip(o.genre, 30).toLowerCase() || "essay",
    prompt,
    bulletPoints: Array.isArray(o.bulletPoints) ? o.bulletPoints.map((b) => clip(b, 300)).filter(Boolean).slice(0, 6) : [],
    wordLimit: { min, max },
    minutes: typeof o.minutes === "number" && o.minutes >= 10 && o.minutes <= 90 ? Math.round(o.minutes) : 40,
  };
}

/** Validate the paper as read by the AI. Null when it doesn't look like an ISE Reading & Writing paper. */
export function sanitizePaper(raw: unknown, hasKeyFile: boolean): OfficialPaperContent | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const level = OFFICIAL_LEVELS.includes(o.level as ExamLevel) ? (o.level as ExamLevel) : null;
  if (!level) return null;

  const blocks: OfficialBlock[] = [];
  for (const b of Array.isArray(o.blocks) ? o.blocks : []) {
    const r = (b ?? {}) as Record<string, unknown>;
    const type = r.type === "match" || r.type === "select" || r.type === "gap" ? r.type : null;
    const from = typeof r.from === "number" ? Math.round(r.from) : NaN;
    const to = typeof r.to === "number" ? Math.round(r.to) : NaN;
    if (!type || !(from >= 1 && to >= from && to <= 40)) continue;
    const options = Array.isArray(r.options)
      ? r.options.map((x) => { const p = (x ?? {}) as Record<string, unknown>; return { letter: letter(p.letter), text: clip(p.text, 400) }; })
          .filter((x) => x.letter)
      : [];
    const items = Array.isArray(r.items)
      ? r.items.map((x) => { const p = (x ?? {}) as Record<string, unknown>; return { num: typeof p.num === "number" ? Math.round(p.num) : 0, text: clip(p.text, 400) }; })
          .filter((x) => x.num >= from && x.num <= to)
      : [];
    const key = Array.isArray(r.key) ? r.key.map((k) => clip(k, 80)).filter(Boolean) : [];
    blocks.push({
      task: r.task === 2 || from >= 16 ? 2 : 1,
      from, to, type,
      instructions: clip(r.instructions, 400),
      options, items,
      key: type === "select" ? key.map(letter).filter(Boolean) : key,
    });
  }
  blocks.sort((a, b) => a.from - b.from);

  const keySource: KeySource = o.keySource === "paper" ? "paper" : o.keySource === "upload" && hasKeyFile ? "upload" : "ai";
  const sources = Array.isArray(o.sources)
    ? o.sources.map((x) => { const p = (x ?? {}) as Record<string, unknown>; return { letter: letter(p.letter), title: clip(p.title, 160), content: clip(p.content, 3000) }; })
        .filter((x) => x.letter && x.content.length > 20).slice(0, 4)
    : [];

  const task3 = sanitizeTask(o.task3);
  const task4 = sanitizeTask(o.task4);
  if (blocks.length === 0 && !task3 && !task4) return null;
  return { title: clip(o.title, 140) || "Trinity ISE paper", level, keySource, sources, blocks, task3, task4 };
}

/** Validate a transcription against the paper's question numbers. */
export function sanitizeAnswers(raw: unknown, paper: OfficialPaperContent): OfficialAnswers {
  const o = (raw ?? {}) as Record<string, unknown>;
  const r = (o.reading ?? {}) as Record<string, unknown>;
  const reading: Record<string, string> = {};
  for (const b of paper.blocks) {
    for (let n = b.from; n <= b.to; n++) {
      const v = r[String(n)];
      reading[String(n)] = b.type === "gap" ? clip(v, 80) : letter(v);
    }
  }
  return {
    reading,
    task3: typeof o.task3 === "string" ? cleanTranscription(o.task3).slice(0, 6000) : "",
    task4: typeof o.task4 === "string" ? cleanTranscription(o.task4).slice(0, 6000) : "",
    illegible: typeof o.illegible === "number" && o.illegible > 0 ? Math.round(o.illegible) : 0,
  };
}

const normGap = (s: string) =>
  s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[.,;:!?"“”()]/g, "").replace(/\s+/g, " ").trim();

/**
 * Accepted forms of a key answer: alternatives split on "/" or " OR ", and
 * Trinity's optional words in brackets, e.g. "(the) hippocampus" → "the hippocampus", "hippocampus".
 */
export function acceptedForms(key: string): string[] {
  const out = new Set<string>();
  for (const alt of key.split(/\s*\/\s*|\s+OR\s+/)) {
    const parts = alt.split(/(\([^)]*\))/).filter((p) => p !== "");
    const optional = parts.filter((p) => p.startsWith("("));
    for (let mask = 0; mask < 1 << Math.min(optional.length, 4); mask++) {
      let i = 0;
      const text = parts.map((p) => (p.startsWith("(") ? ((mask >> i++) & 1 ? p.slice(1, -1) : "") : p)).join(" ");
      const n = normGap(text);
      if (n) out.add(n);
    }
  }
  return [...out];
}

/** Mark Tasks 1 and 2. Gap answers accept any listed alternative, ignoring case and punctuation. */
export function markReading(paper: OfficialPaperContent, answers: OfficialAnswers): OfficialReadingResult {
  const questions: OfficialQuestionResult[] = [];
  for (const b of paper.blocks) {
    if (b.type === "select") {
      const key = new Set(b.key);
      const seen = new Set<string>();
      for (let n = b.from; n <= b.to; n++) {
        const given = answers.reading[String(n)] ?? "";
        const ok = !!given && key.has(given) && !seen.has(given);
        if (given) seen.add(given);
        questions.push({ num: n, task: b.task, type: b.type, given, expected: [...key].join(", "), ok });
      }
      continue;
    }
    for (let n = b.from; n <= b.to; n++) {
      const expected = b.key[n - b.from] ?? "";
      const given = answers.reading[String(n)] ?? "";
      const ok = b.type === "match"
        ? !!given && given === letterOf(expected)
        : !!given && acceptedForms(expected).includes(normGap(given));
      questions.push({ num: n, task: b.task, type: b.type, given, expected, ok });
    }
  }
  const sum = (task?: 1 | 2) => {
    const qs = task ? questions.filter((q) => q.task === task) : questions;
    return { correct: qs.filter((q) => q.ok).length, total: qs.length };
  };
  return { ...sum(), task1: sum(1), task2: sum(2), questions };
}

const letterOf = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);

/** Same formula as the mock exam: half reading %, half writing (criteria mean 0–4 → %). */
export function overallScore(reading: OfficialReadingResult | null, writingMeans: number[]): number | null {
  const readingPct = reading && reading.total > 0 ? (reading.correct / reading.total) * 100 : null;
  const writingPct = writingMeans.length > 0 ? (writingMeans.reduce((a, b) => a + b, 0) / writingMeans.length / 4) * 100 : null;
  if (readingPct === null && writingPct === null) return null;
  if (readingPct === null) return Math.round(writingPct as number);
  if (writingPct === null) return Math.round(readingPct);
  return Math.round(readingPct * 0.5 + writingPct * 0.5);
}

/** Turn an official writing task into a Writing practice task (Task 3 gets the Task 2 texts as sources). */
export function toWritingTask(task: OfficialWritingTask, taskType: WritingTaskType, sources: OfficialPaperContent["sources"]): WritingTaskContent {
  return {
    title: task.title,
    prompt: task.prompt,
    bulletPoints: task.bulletPoints,
    wordLimit: task.wordLimit,
    minutes: task.minutes,
    ...(taskType === "READING_INTO_WRITING" && sources.length > 0
      ? { sources: sources.map((s): ReadingText => ({ letter: s.letter, title: s.title, source: s.title, content: s.content })) }
      : {}),
  };
}
