/**
 * Spaced repetition (Leitner boxes) for saved words — pure helpers.
 * Box 0 = new. A correct answer moves a word up one box; a wrong answer
 * sends it back to box 1 (review tomorrow). Gaps are short enough to be
 * useful for an exam a few weeks away.
 */

/** Days until the next review once a word is in box N (index = box). */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60];
export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;
/** A word in this box or above counts as "learned". */
export const LEARNED_BOX = 4;

export const SESSION_MAX_REVIEWS = 20;
export const SESSION_MAX_NEW = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

export function nextReview(box: number, correct: boolean, now = new Date()): { box: number; dueAt: Date } {
  const next = correct ? Math.min(MAX_BOX, Math.max(1, box + 1)) : 1;
  // Due at the start of the target day, so "due today" doesn't depend on the review hour.
  const due = new Date(now.getTime() + BOX_INTERVAL_DAYS[next] * DAY_MS);
  due.setHours(0, 0, 0, 0);
  return { box: next, dueAt: due };
}

/**
 * New and shaky words get a recognition-friendly exercise (missing letters);
 * once a word has survived a couple of reviews it must be produced in full.
 */
export function exerciseForBox(box: number): "complete" | "gapfill" {
  return box <= 1 ? "complete" : "gapfill";
}

/**
 * Whether the gap-fill game can hide the word in its example (mirrors the
 * word game's matcher). If not, the example would give the answer away.
 */
export function canGapFill(example: string, english: string): boolean {
  const escaped = english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}(s|es|ed|ing|d)?\\b`, "i").test(example);
}
