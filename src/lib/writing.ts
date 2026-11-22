/**
 * Writing Lab — pure helpers shared by the API routes and the client.
 * The AI quotes fragments of the candidate's text; the server locates them
 * (character offsets) and drops anything it can't find, so the client can
 * highlight spans without trusting model-produced positions.
 */
import type {
  ReadingText,
  WritingCriterion,
  WritingCriterionKey,
  WritingEvaluation,
  WritingIssue,
  WritingIssueCategory,
  WritingTaskContent,
  WritingTaskType,
  WritingUpgrade,
} from "@/types";

export const WRITING_TASK_TYPES: WritingTaskType[] = ["READING_INTO_WRITING", "EXTENDED_WRITING"];

/** Suggested minutes per task in exam conditions (same as /tips). */
export const WRITING_MINUTES: Record<WritingTaskType, number> = {
  READING_INTO_WRITING: 35,
  EXTENDED_WRITING: 45,
};

/** First attempt + rewrites per practice — bounds AI cost. */
export const MAX_DRAFTS = 4;
export const MIN_SUBMIT_WORDS = 40;
export const MAX_TEXT_CHARS = 6000;

export const CRITERIA_FOR_TASK: Record<WritingTaskType, WritingCriterionKey[]> = {
  READING_INTO_WRITING: ["readingForWriting", "taskFulfilment", "organisation", "languageControl"],
  EXTENDED_WRITING: ["taskFulfilment", "organisation", "languageControl"],
};

export const ISSUE_CATEGORIES: WritingIssueCategory[] = [
  "grammar", "vocabulary", "register", "cohesion", "spelling", "punctuation",
];

/** Error-notebook taxonomy: the AI tags every issue with one of these so mistakes can be counted across texts. */
export const WRITING_ERROR_TAGS = [
  "verb-tense", "verb-form", "subject-verb-agreement", "articles", "prepositions",
  "word-order", "relative-clauses", "conditionals", "passive", "modals",
  "countable-uncountable", "pronouns", "word-choice", "collocation", "false-friend",
  "word-form", "register", "linking", "repetition", "sentence-structure",
  "spelling", "punctuation", "capitalisation", "other",
] as const;
export type WritingErrorTag = (typeof WRITING_ERROR_TAGS)[number];

const MAX_ISSUES = 25;
const MAX_UPGRADES = 10;

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export type WritingBand = "distinction" | "merit" | "pass" | "below";

/** Band from the mean criterion score (Trinity scale: 2 = pass, 3 = merit, 4 = distinction). */
export function bandFromScore(avg: number): WritingBand {
  if (avg >= 3.5) return "distinction";
  if (avg >= 2.5) return "merit";
  if (avg >= 2) return "pass";
  return "below";
}

export function meanScore(evaluation: WritingEvaluation, taskType: WritingTaskType): number {
  const keys = CRITERIA_FOR_TASK[taskType];
  const sum = keys.reduce((acc, k) => acc + (evaluation.criteria[k]?.score ?? 0), 0);
  return Math.round((sum / keys.length) * 100) / 100;
}

// ─── Quote location ──────────────────────────────────────────────────────────

/** Lower-cased text with collapsed whitespace and straight quotes, plus a map back to original indices. */
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    let ch = s[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      ch = " ";
      prevSpace = true;
    } else {
      prevSpace = false;
      if (ch === "’" || ch === "‘") ch = "'";
      else if (ch === "“" || ch === "”") ch = '"';
      const lower = ch.toLowerCase();
      if (lower.length === 1) ch = lower; // keep 1:1 index mapping
    }
    norm += ch;
    map.push(i);
  }
  return { norm, map };
}

type Range = [number, number];

function overlaps([a, b]: Range, taken: Range[]): boolean {
  return taken.some(([c, d]) => a < d && c < b);
}

/**
 * Find `quote` in `text` as [start, end), skipping occurrences that overlap
 * ranges already taken. Exact match first, then a whitespace/case/quote-style
 * tolerant match. Null when the AI quoted something that isn't in the text.
 */
export function locateQuote(text: string, quote: string, taken: Range[] = []): Range | null {
  const q = quote.trim();
  if (!q) return null;

  for (let from = 0; ; ) {
    const i = text.indexOf(q, from);
    if (i === -1) break;
    const r: Range = [i, i + q.length];
    if (!overlaps(r, taken)) return r;
    from = i + 1;
  }

  const { norm, map } = normalizeWithMap(text);
  const nq = normalizeWithMap(q).norm.trim();
  if (!nq) return null;
  for (let from = 0; ; ) {
    const i = norm.indexOf(nq, from);
    if (i === -1) return null;
    const r: Range = [map[i], map[i + nq.length - 1] + 1];
    if (!overlaps(r, taken)) return r;
    from = i + 1;
  }
}

// ─── Sanitising the AI evaluation ────────────────────────────────────────────

/** Trimmed plain text: markdown emphasis removed, cut at a word boundary when too long. */
function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const t = v.replace(/\*\*|__/g, "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

function strList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

function criterion(v: unknown): WritingCriterion | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = typeof o.score === "number" ? o.score : Number(o.score);
  if (!Number.isFinite(n)) return null;
  return { score: Math.max(0, Math.min(4, Math.round(n))), comment: str(o.comment ?? o.comments, 700) };
}

function asTag(v: unknown): WritingErrorTag {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (WRITING_ERROR_TAGS as readonly string[]).includes(t) ? (t as WritingErrorTag) : "other";
}

function asCategory(v: unknown, tag: WritingErrorTag): WritingIssueCategory {
  const c = typeof v === "string" ? v.trim().toLowerCase() : "";
  if ((ISSUE_CATEGORIES as string[]).includes(c)) return c as WritingIssueCategory;
  if (tag === "spelling" || tag === "capitalisation") return "spelling";
  if (tag === "punctuation") return "punctuation";
  if (tag === "register") return "register";
  if (tag === "linking" || tag === "repetition") return "cohesion";
  if (tag === "word-choice" || tag === "collocation" || tag === "false-friend") return "vocabulary";
  return "grammar";
}

/**
 * Validate the model's evaluation against the candidate's text: clamp scores,
 * keep only issues/upgrades whose quote is really in the text (issues win
 * over upgrades when they overlap), and drop no-op corrections.
 * Returns null when any required criterion is missing.
 */
export function sanitizeEvaluation(raw: unknown, text: string, taskType: WritingTaskType): WritingEvaluation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rawCriteria = (o.criteria ?? {}) as Record<string, unknown>;

  const criteria: WritingEvaluation["criteria"] = {};
  for (const key of CRITERIA_FOR_TASK[taskType]) {
    const c = criterion(rawCriteria[key]);
    if (!c) return null;
    criteria[key] = c;
  }

  const taken: Range[] = [];

  const issues: WritingIssue[] = [];
  for (const item of Array.isArray(o.issues) ? o.issues : []) {
    if (issues.length >= MAX_ISSUES) break;
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const quote = str(it.quote, 300);
    const correction = str(it.correction, 300);
    if (!quote || !correction || quote === correction) continue;
    const range = locateQuote(text, quote, taken);
    if (!range) continue;
    taken.push(range);
    const tag = asTag(it.tag);
    issues.push({
      start: range[0],
      end: range[1],
      quote: text.slice(range[0], range[1]),
      correction,
      category: asCategory(it.category, tag),
      tag,
      explanation: str(it.explanation, 400),
    });
  }

  const upgrades: WritingUpgrade[] = [];
  for (const item of Array.isArray(o.upgrades) ? o.upgrades : []) {
    if (upgrades.length >= MAX_UPGRADES) break;
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const quote = str(it.quote, 120);
    const suggestions = (Array.isArray(it.suggestions) ? it.suggestions : [])
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const so = s as Record<string, unknown>;
        const textAlt = str(so.text, 80);
        return textAlt && textAlt.toLowerCase() !== quote.toLowerCase()
          ? { text: textAlt, translation: str(so.translation, 80) }
          : null;
      })
      .filter((s): s is { text: string; translation: string } => s !== null)
      .slice(0, 3);
    if (!quote || suggestions.length === 0) continue;
    const range = locateQuote(text, quote, taken);
    if (!range) continue;
    taken.push(range);
    upgrades.push({
      start: range[0],
      end: range[1],
      quote: text.slice(range[0], range[1]),
      suggestions,
      example: str(it.example, 400),
      note: str(it.note, 300),
    });
  }

  issues.sort((a, b) => a.start - b.start);
  upgrades.sort((a, b) => a.start - b.start);

  return {
    criteria,
    summary: str(o.summary, 900),
    strengths: strList(o.strengths, 4, 450),
    issues,
    upgrades,
    improvedVersion: str(o.improvedVersion, 5000),
    nextSteps: strList(o.nextSteps, 4, 550),
  };
}

// ─── Sanitising a generated task ─────────────────────────────────────────────

const SOURCE_LETTERS = ["A", "B", "C", "D"];
const SOURCE_KINDS = ["Blog", "Forum post", "Article", "Infographic"];

function sanitizeSource(v: unknown, idx: number): ReadingText | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const content = str(o.content, 2500);
  const isD = idx === 3;
  if (content.length < (isD ? 30 : 250)) return null;
  const graphData = (Array.isArray(o.graphData) ? o.graphData : [])
    .map((d) => {
      if (!d || typeof d !== "object") return null;
      const dd = d as Record<string, unknown>;
      const value = typeof dd.value === "number" ? dd.value : Number(dd.value);
      const label = str(dd.label, 60);
      return label && Number.isFinite(value) ? { label, value } : null;
    })
    .filter((d): d is { label: string; value: number } => d !== null)
    .slice(0, 8);
  const source: ReadingText = {
    letter: SOURCE_LETTERS[idx],
    title: str(o.title, 120) || `Text ${SOURCE_LETTERS[idx]}`,
    source: str(o.source, 40) || SOURCE_KINDS[idx],
    content,
  };
  const author = str(o.author, 60);
  if (author) source.author = author;
  if (isD && graphData.length >= 3) {
    source.isGraph = true;
    source.graphData = graphData;
  }
  return source;
}

/** Validate a generated Writing Lab task; null if anything essential is missing. */
export function sanitizeWritingTask(
  raw: unknown,
  opts: { taskType: WritingTaskType; wordLimit: { min: number; max: number }; minutes: number },
): WritingTaskContent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const prompt = str(o.prompt, 900);
  const bulletPoints = strList(o.bulletPoints, 3, 200);
  if (prompt.length < 30 || bulletPoints.length < 2) return null;

  const task: WritingTaskContent = {
    title: str(o.title, 80) || "Writing task",
    prompt,
    bulletPoints,
    wordLimit: opts.wordLimit,
    minutes: opts.minutes,
  };

  if (opts.taskType === "READING_INTO_WRITING") {
    const rawSources = Array.isArray(o.sources) ? o.sources.slice(0, 4) : [];
    const sources = rawSources.map(sanitizeSource);
    if (sources.length !== 4 || sources.some((s) => s === null)) return null;
    task.sources = sources as ReadingText[];
  }
  return task;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

export type AnnotatedSegment =
  | { kind: "text"; text: string }
  | { kind: "issue"; text: string; index: number }
  | { kind: "upgrade"; text: string; index: number };

/** Split the draft into plain text + highlighted spans (issues and upgrades never overlap). */
export function buildAnnotatedSegments(text: string, issues: WritingIssue[], upgrades: WritingUpgrade[]): AnnotatedSegment[] {
  const spans = [
    ...issues.map((s, index) => ({ kind: "issue" as const, start: s.start, end: s.end, index })),
    ...upgrades.map((s, index) => ({ kind: "upgrade" as const, start: s.start, end: s.end, index })),
  ]
    .filter((s) => s.start >= 0 && s.end <= text.length && s.start < s.end)
    .sort((a, b) => a.start - b.start);

  const segments: AnnotatedSegment[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue; // defensive: skip overlaps
    if (s.start > pos) segments.push({ kind: "text", text: text.slice(pos, s.start) });
    segments.push({ kind: s.kind, text: text.slice(s.start, s.end), index: s.index });
    pos = s.end;
  }
  if (pos < text.length) segments.push({ kind: "text", text: text.slice(pos) });
  return segments;
}

// ─── Error notebook ──────────────────────────────────────────────────────────

export interface ErrorTagStat {
  tag: WritingErrorTag;
  count: number;
  /** Most recent examples first. */
  examples: { quote: string; correction: string; explanation: string }[];
}

/**
 * Count issue tags across first drafts (rewrites would double-count the same
 * mistakes). `evaluations` should be ordered newest first.
 */
export function aggregateErrorTags(evaluations: WritingEvaluation[], maxExamples = 3): ErrorTagStat[] {
  const byTag = new Map<WritingErrorTag, ErrorTagStat>();
  for (const ev of evaluations) {
    for (const issue of ev.issues ?? []) {
      const tag = asTag(issue.tag);
      const stat = byTag.get(tag) ?? { tag, count: 0, examples: [] };
      stat.count++;
      if (stat.examples.length < maxExamples) {
        stat.examples.push({ quote: issue.quote, correction: issue.correction, explanation: issue.explanation });
      }
      byTag.set(tag, stat);
    }
  }
  return [...byTag.values()].sort((a, b) => b.count - a.count);
}
