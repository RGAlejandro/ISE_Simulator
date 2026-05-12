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

export const FREE_DAILY_LIMIT = {
  written: 1,
  oral: 1,
  listening: 3,
};

export const EXAM_DURATIONS: Record<string, number> = {
  ISE_FOUNDATION: 60,
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
