export const EXAM_LEVELS = [
  { value: "ISE_FOUNDATION", label: "ISE Foundation", cefr: "A2", color: "bg-green-500" },
  { value: "ISE_I", label: "ISE I", cefr: "B1", color: "bg-blue-500" },
  { value: "ISE_II", label: "ISE II", cefr: "B2", color: "bg-yellow-500" },
  { value: "ISE_III", label: "ISE III", cefr: "C1", color: "bg-orange-500" },
  { value: "ISE_IV", label: "ISE IV", cefr: "C2", color: "bg-red-500" },
] as const;

export const WRITTEN_TASKS = [
  { type: "READING_1", label: "Reading Task 1", description: "Long reading with comprehension questions" },
  { type: "READING_2", label: "Reading Task 2", description: "Multi-text reading with comparative questions" },
  { type: "READING_INTO_WRITING", label: "Reading into Writing", description: "Writing task based on the reading texts" },
  { type: "EXTENDED_WRITING", label: "Extended Writing", description: "Independent essay or article" },
] as const;

export const ORAL_TASKS = [
  { type: "TOPIC", label: "Topic Task", description: "Present your prepared topic + follow-up questions" },
  { type: "COLLABORATIVE", label: "Collaborative Task", description: "Discussion based on a visual prompt" },
  { type: "CONVERSATION", label: "Conversation Task", description: "General conversation on subject area" },
  { type: "LISTENING", label: "Listening Task", description: "Listen to audio and answer questions" },
] as const;

/**
 * Official Trinity ISE Speaking & Listening per-task durations in minutes
 * (Trinity "Guide for Students" per level). Tasks absent at a level are omitted.
 * ISE IV uses the distinct Interview format (25 min total); values are adapted
 * to the app's 4-task model.
 */
export const ORAL_TASK_MINUTES: Record<string, Partial<Record<string, number>>> = {
  ISE_FOUNDATION: { TOPIC: 4, CONVERSATION: 2, LISTENING: 6 },
  ISE_I:          { TOPIC: 4, CONVERSATION: 2, LISTENING: 7 },
  ISE_II:         { TOPIC: 4, COLLABORATIVE: 4, CONVERSATION: 2, LISTENING: 8 },
  ISE_III:        { TOPIC: 8, COLLABORATIVE: 4, CONVERSATION: 3, LISTENING: 8 },
  ISE_IV:         { TOPIC: 10, COLLABORATIVE: 5, CONVERSATION: 4, LISTENING: 6 },
};

/** Oral tasks available per level (Trinity spec: Collaborative only from ISE II / B2). */
export const ORAL_TASKS_BY_LEVEL: Record<string, readonly ("TOPIC" | "COLLABORATIVE" | "CONVERSATION" | "LISTENING")[]> = {
  ISE_FOUNDATION: ["TOPIC", "CONVERSATION", "LISTENING"],
  ISE_I:          ["TOPIC", "CONVERSATION", "LISTENING"],
  ISE_II:         ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"],
  ISE_III:        ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"],
  ISE_IV:         ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"],
};

/**
 * Live Examiner (Gemini Live, full-duplex audio). Tried in order: if a model
 * fails to connect, the client asks for a token for the next one.
 * Measured 2026-11-16 (time to first audio): 3.8-live 565 ms, 3.1-flash-live 620 ms, 2.5-native-audio 2.2 s.
 */
export const LIVE_MODELS = [
  "gemini-3.8-live",
  "gemini-3.1-flash-live-preview",
  "gemini-2.5-flash-native-audio-latest",
] as const;

/** Spoken tasks the live examiner can run (Independent Listening stays in classic mode). */
export const LIVE_TASKS = ["TOPIC", "COLLABORATIVE", "CONVERSATION"] as const;

/** Prefix for exam-software control messages the live examiner must follow silently (never read aloud). */
export const LIVE_CONTROL_PREFIX = "[EXAM CONTROL]";

/** Hard cap on a live session; task timings are scaled down to fit if the level's total exceeds it. */
export const LIVE_MAX_MINUTES = 14;

export const FREE_DAILY_LIMIT = {
  written: 1,
  oral: 1,
  listening: 3,
  reading: 2,
  writing: 1,
  translation: 1,
};

/** Daily cap on small AI helpers (handwriting transcription, sentence checks). */
export const AI_ASSIST_DAILY_LIMIT = { free: 10, pro: 80 };

export const FREE_CHAT_DAILY_LIMIT = 20;

export const EXAM_DURATIONS: Record<string, number> = {
  ISE_FOUNDATION: 120,
  ISE_I: 120,
  ISE_II: 120,
  ISE_III: 120,
  ISE_IV: 120,
};

export const PRICING = {
  monthly: {
    price: 9.99,
    priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
  },
  yearly: {
    price: 89.99,
    priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
  },
};
