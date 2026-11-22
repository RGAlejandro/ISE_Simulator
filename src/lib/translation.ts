import type { ExamLevel } from "@/types";

/** Sentences per round. */
export const TRANSLATION_ROUND = 8;
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
export function sanitizeItems(raw: unknown): TranslationItem[] {
  const list = Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: unknown[] }).items : [];
  const out: TranslationItem[] = [];
  for (const it of list) {
    const o = it as Record<string, unknown>;
    const source = clip(o?.source, 300);
    const reference = clip(o?.reference, 300);
    const structure = clip(o?.structure, 80);
    if (source.length < 8 || reference.length < 8) continue;
    out.push({ id: `t${out.length + 1}`, source, reference, structure });
    if (out.length === TRANSLATION_ROUND) break;
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
