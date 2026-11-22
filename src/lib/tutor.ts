/**
 * Personal tutor (Pro chat): shared types and pure helpers.
 * The AI only *proposes* actions; the learner confirms each one in the UI,
 * and every field is re-validated here and again on the server that saves it.
 */

export const TUTOR_DATA_KEYS = ["readiness", "attempts", "writingErrors", "vocabulary", "photos"] as const;
export type TutorDataKey = (typeof TUTOR_DATA_KEYS)[number];

export const PRACTICE_MODULES = [
  "written", "oral", "live", "listening", "writing", "reading", "grammar", "translation", "review", "vocabulary",
] as const;
export type PracticeModule = (typeof PRACTICE_MODULES)[number];

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Words the tutor may propose in one list. */
export const MAX_TUTOR_LIST_WORDS = 40;
/** Words read from one photo (a full page of vocabulary). */
export const MAX_PHOTO_LIST_WORDS = 60;
/** Words the bulk-save endpoint accepts in one request (several photos merged into one list). */
export const MAX_BULK_WORDS = 150;
export const MAX_LIST_NAME = 60;
const MAX_REPLY_CHARS = 4000;
const MAX_ACTIONS = 3;
const MAX_PRACTICE_ACTIONS = 2;

export interface TutorWord {
  english: string;
  spanish: string;
  example: string;
  partOfSpeech: string | null;
  level: CefrLevel;
}

export const GOAL_MODULES = ["BOTH", "READING_WRITING", "SPEAKING_LISTENING"] as const;
export const GOAL_TARGETS = ["PASS", "MERIT", "DISTINCTION"] as const;
const GOAL_LEVELS = ["ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"] as const;

export interface GoalChange {
  examModules?: (typeof GOAL_MODULES)[number];
  targetBand?: (typeof GOAL_TARGETS)[number];
  examLevel?: (typeof GOAL_LEVELS)[number];
  examDate?: string;
}

export type TutorAction =
  | { type: "create_vocab_list"; name: string; words: TutorWord[] }
  | { type: "practice"; module: PracticeModule; label: string; href: string }
  | ({ type: "set_goal" } & GoalChange);

export interface TutorResponse {
  reply: string;
  actions: TutorAction[];
  usedData: TutorDataKey[];
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Validate one proposed word. Returns null when it can't be saved as a flashcard. */
export function sanitizeWord(raw: unknown): TutorWord | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  const english = str(w.english, 60);
  const spanish = str(w.spanish ?? w.translation, 80);
  if (!english || !spanish || !/[a-z]/i.test(english)) return null;
  const level = typeof w.level === "string" && (CEFR_LEVELS as readonly string[]).includes(w.level.toUpperCase())
    ? (w.level.toUpperCase() as CefrLevel)
    : "B1";
  return {
    english,
    spanish,
    example: str(w.example, 240),
    partOfSpeech: str(w.partOfSpeech, 30) || null,
    level,
  };
}

/** Validate a list of words, dropping invalid ones and case-insensitive duplicates. */
export function sanitizeWords(raw: unknown, max: number): TutorWord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TutorWord[] = [];
  for (const item of raw) {
    const w = sanitizeWord(item);
    if (!w) continue;
    const key = w.english.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

/** Map a practice module to an in-app route. The AI never chooses URLs. */
export function practiceHref(module: PracticeModule, params?: { writingType?: string }): string {
  switch (module) {
    case "written": return "/practice?start=written";
    case "listening": return "/practice?start=listening";
    case "oral": return "/exam/oral/setup";
    case "live": return "/exam/oral/setup?mode=live";
    case "writing": {
      const t = params?.writingType;
      return t === "READING_INTO_WRITING" || t === "EXTENDED_WRITING" ? `/writing?type=${t}` : "/writing";
    }
    case "reading": return "/practice?start=reading";
    case "grammar": return "/grammar";
    case "translation": return "/translation";
    case "review": return "/vocabulary/review";
    case "vocabulary": return "/vocabulary";
  }
}

function sanitizeAction(raw: unknown): TutorAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (a.type === "create_vocab_list") {
    const words = sanitizeWords(a.words, MAX_TUTOR_LIST_WORDS);
    if (words.length === 0) return null;
    return { type: "create_vocab_list", name: str(a.name, MAX_LIST_NAME) || "My word list", words };
  }
  if (a.type === "set_goal") {
    const goal: GoalChange = {};
    if ((GOAL_MODULES as readonly unknown[]).includes(a.examModules)) goal.examModules = a.examModules as GoalChange["examModules"];
    if ((GOAL_TARGETS as readonly unknown[]).includes(a.targetBand)) goal.targetBand = a.targetBand as GoalChange["targetBand"];
    if ((GOAL_LEVELS as readonly unknown[]).includes(a.examLevel)) goal.examLevel = a.examLevel as GoalChange["examLevel"];
    if (typeof a.examDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.examDate)) goal.examDate = a.examDate;
    return Object.keys(goal).length > 0 ? { type: "set_goal", ...goal } : null;
  }
  if (a.type === "practice") {
    const mod = a.module as PracticeModule;
    if (!(PRACTICE_MODULES as readonly string[]).includes(mod)) return null;
    const params = a.params && typeof a.params === "object" ? (a.params as Record<string, unknown>) : {};
    const label = str(a.label, 60);
    if (!label) return null;
    return { type: "practice", module: mod, label, href: practiceHref(mod, { writingType: str(params.writingType, 40) }) };
  }
  return null;
}

/** Turn whatever the model returned into a safe, bounded response. */
export function sanitizeTutorResponse(raw: unknown): TutorResponse {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const reply = typeof obj.reply === "string" ? obj.reply.trim().slice(0, MAX_REPLY_CHARS) : "";

  const actions: TutorAction[] = [];
  let hasList = false;
  let hasGoal = false;
  let practices = 0;
  const seenHrefs = new Set<string>();
  for (const item of Array.isArray(obj.actions) ? obj.actions : []) {
    const action = sanitizeAction(item);
    if (!action) continue;
    if (action.type === "create_vocab_list") {
      if (hasList) continue; // one list per answer keeps the confirmation step simple
      hasList = true;
    } else if (action.type === "set_goal") {
      if (hasGoal) continue;
      hasGoal = true;
    } else {
      if (practices >= MAX_PRACTICE_ACTIONS || seenHrefs.has(action.href)) continue;
      practices++;
      seenHrefs.add(action.href);
    }
    actions.push(action);
    if (actions.length >= MAX_ACTIONS) break;
  }

  const usedData = [...new Set(
    (Array.isArray(obj.usedData) ? obj.usedData : []).filter(
      (k): k is TutorDataKey => typeof k === "string" && (TUTOR_DATA_KEYS as readonly string[]).includes(k),
    ),
  )];

  return { reply, actions, usedData };
}
