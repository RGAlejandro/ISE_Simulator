import type { ExamLevel } from "@/types";

/** Sentences per round the learner can choose. */
export const ROUND_SIZES = [5, 8, 12, 15] as const;
export type RoundSize = (typeof ROUND_SIZES)[number];
export const DEFAULT_ROUND: RoundSize = 8;
export const isRoundSize = (n: unknown): n is RoundSize => ROUND_SIZES.includes(n as RoundSize);
/** About how long a round takes, in minutes (~40 s a sentence). */
export const roundMinutes = (n: number) => Math.max(3, Math.round(n * 0.65));
/** Longest answer we accept (characters). */
export const MAX_ANSWER = 400;

export type SourceLang = "es" | "fr";
export type Verdict = "correct" | "almost" | "wrong";

export interface TranslationItem {
  id: string;
  /** Sentence in the learner's language. */
  source: string;
  /** A natural English translation (one of several valid ones). */
  reference: string;
  /** Grammar point it practises, in English: "second conditional". */
  structure: string;
  /** Hint 1: how the structure is built, in the learner's UI language. Older rounds don't have it. */
  pattern?: string;
  /** Hint 2: key words of the sentence with their English equivalent. */
  words?: { from: string; to: string }[];
}

export type Hint =
  | { kind: "pattern"; text: string }
  | { kind: "words"; words: { from: string; to: string }[] }
  | { kind: "start"; text: string };

/** The first third of the reference, so the learner gets going without seeing the whole sentence. */
export function sentenceStart(reference: string): string {
  const words = reference.trim().split(/\s+/);
  const k = Math.min(Math.max(2, Math.ceil(words.length * 0.35)), Math.max(1, words.length - 2));
  return `${words.slice(0, k).join(" ")}…`;
}

/** The hints for a sentence, from least to most revealing. */
export function hintsFor(item: TranslationItem): Hint[] {
  const out: Hint[] = [];
  out.push({ kind: "pattern", text: item.pattern || item.structure });
  if (item.words?.length) out.push({ kind: "words", words: item.words });
  out.push({ kind: "start", text: sentenceStart(item.reference) });
  return out;
}

export interface TranslationResult {
  answer: string;
  verdict: Verdict;
  /** The learner's sentence with only the necessary fixes (equals the answer when correct). */
  corrected: string;
  /** One short explanation of the main issue, in the learner's UI language. Empty when correct. */
  note: string;
  /** A more natural / higher-band version, when it adds something. */
  natural: string;
  /** Hints the learner opened before answering. */
  hints?: number;
}

/**
 * Structures each ISE level is expected to handle, from Trinity's ISE grammar
 * and language-function lists. The generator spreads a round across them.
 */
export const LEVEL_STRUCTURES: Record<ExamLevel, string[]> = {
  ISE_FOUNDATION: [
    "past simple (regular and irregular)", "present continuous for future arrangements", "going to for plans",
    "comparatives and superlatives", "can / could for ability and requests", "have to / don't have to",
    "should for advice", "adverbs of frequency", "there is / there are", "prepositions of time and place",
  ],
  ISE_I: [
    "present perfect with ever / never / just / already / yet", "past continuous vs past simple", "will vs going to",
    "first conditional", "zero conditional", "used to", "defining relative clauses (who / which / that)",
    "must / mustn't / need to", "verb + -ing vs verb + to-infinitive", "too / enough",
  ],
  ISE_II: [
    "second conditional", "third conditional", "present perfect continuous", "past perfect",
    "passive voice (several tenses)", "reported speech (statements and questions)",
    "modals of deduction (must / might / can't have)", "wish / if only", "non-defining relative clauses",
    "contrast linkers (although / despite / however)",
  ],
  ISE_III: [
    "mixed conditionals", "negative inversion (never have I / not only / hardly)", "cleft sentences (what I need is / it was … that)",
    "impersonal passive (it is said that / is thought to)", "past modals (should have / needn't have)",
    "participle clauses", "wish + would", "causative have / get something done",
    "formal linkers (nevertheless / whereas / provided that)", "be supposed to / be bound to",
  ],
  ISE_IV: [
    "subjunctive (it is essential that he be)", "conditional inversion (should you / were it not for / had I known)",
    "nominalisation for formal register", "advanced modality and hedging", "ellipsis and substitution",
    "fronting for emphasis", "complex participle and absolute clauses", "idiomatic collocations",
    "concessive clauses (much as / however much)", "reporting verbs with nuance (concede / allege / contend)",
  ],
};

export const EXAM_LEVEL_VALUES = Object.keys(LEVEL_STRUCTURES) as ExamLevel[];

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validate the generator's output; drops malformed items and renumbers. */
export function sanitizeItems(raw: unknown, max: number): TranslationItem[] {
  const list = Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: unknown[] }).items : [];
  const out: TranslationItem[] = [];
  for (const it of list) {
    const o = it as Record<string, unknown>;
    const source = clip(o?.source, 300);
    const reference = clip(o?.reference, 300);
    const structure = clip(o?.structure, 80);
    if (source.length < 8 || reference.length < 8) continue;
    const pattern = clip(o?.pattern, 160);
    const words = (Array.isArray(o?.words) ? o.words : [])
      .map((w) => ({ from: clip((w as Record<string, unknown>)?.from, 60), to: clip((w as Record<string, unknown>)?.to, 60) }))
      .filter((w) => w.from && w.to)
      // A "key word" that is most of the answer isn't a hint any more.
      .filter((w) => w.to.split(/\s+/).length <= 4)
      .slice(0, 3);
    out.push({ id: `t${out.length + 1}`, source, reference, structure, ...(pattern ? { pattern } : {}), ...(words.length ? { words } : {}) });
    if (out.length === max) break;
  }
  return out;
}

/** Validate the checker's output; falls back to a safe verdict. */
export function sanitizeResult(raw: unknown, answer: string): TranslationResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  const verdict: Verdict = o.verdict === "correct" || o.verdict === "almost" || o.verdict === "wrong" ? o.verdict : "wrong";
  const corrected = clip(o.corrected, 400) || answer;
  const natural = clip(o.natural, 400);
  return {
    answer,
    verdict,
    corrected,
    note: clip(o.note, 300),
    // Drop the "natural" version when it adds nothing over the correction.
    natural: norm(natural) === norm(corrected) || norm(natural) === norm(answer) ? "" : natural,
  };
}

function norm(s: string) {
  return s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[.,!?;:"“”]/g, "").replace(/\s+/g, " ").trim();
}

/** Exact match with the reference (ignoring case and punctuation): no AI call needed. */
export function matchesReference(answer: string, reference: string): boolean {
  return norm(answer) === norm(reference);
}

const POINTS: Record<Verdict, number> = { correct: 2, almost: 1, wrong: 0 };

/** 0–100: a correct sentence is worth 2 points, an "almost" 1. */
export function roundScore(results: TranslationResult[], total: number): number {
  if (total === 0) return 0;
  const pts = results.reduce((a, r) => a + POINTS[r.verdict], 0);
  return Math.round((pts / (total * 2)) * 100);
}
