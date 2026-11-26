/**
 * Quiz of your mistakes: multiple-choice questions built from what the learner
 * got wrong across the app (marked writings, translation drills, Teacher
 * lessons, vocabulary reviews). A mistake answered right twice in a row is
 * "mastered" and stops coming up. Quizzes are GrammarSession rows with
 * exerciseType "quiz": `questions` holds QuizQuestion[], `responses` the
 * chosen option per question.
 */

export const QUIZ_TYPE = "quiz";
export const QUIZ_SIZE = 10;
/** Extra mistakes sent to the question writer, in case it drops some. */
export const QUIZ_SPARES = 4;
/** Fewest questions worth a quiz. */
export const QUIZ_MIN = 5;
export const FREE_QUIZZES_PER_DAY = 1;
/** Right answers in a row that retire a mistake. */
export const MASTERED_AFTER = 2;
/** Most questions from one source (writing has no cap: it's the main one). */
const SOURCE_CAP: Record<QuizSource, number> = { writing: QUIZ_SIZE, translation: 3, teacher: 3, vocab: 3 };
/** Most questions from the same writing / round / lesson. */
const SAME_ORIGIN_CAP = 2;

export const QUIZ_SOURCES = ["writing", "translation", "teacher", "vocab"] as const;
export type QuizSource = (typeof QUIZ_SOURCES)[number];

interface SeedBase {
  /** Stable id of the mistake: "w:<draftId>:<i>", "t:<roundId>:<itemId>", "g:<lessonId>:<exerciseId>", "v:<wordId>". */
  key: string;
  /** When the mistake was made (ISO). */
  date: string;
}

/** One mistake the quiz can ask about. */
export type QuizSeed =
  | (SeedBase & { source: "writing"; sentence: string; quote: string; correction: string; explanation: string; tag: string })
  | (SeedBase & { source: "translation"; spanish: string; answer: string; corrected: string; note: string; structure: string })
  | (SeedBase & { source: "teacher"; topic: string; task: string; given: string; expected: string; explanation: string })
  | (SeedBase & { source: "vocab"; wordId: string; english: string; translation: string; example: string; partOfSpeech: string });

export interface QuizOption {
  text: string;
  /** Why this option is right or wrong, in the learner's language. */
  why: string;
}

export interface QuizQuestion {
  id: string;
  key: string;
  source: QuizSource;
  date: string;
  /** Writing error tag or Teacher topic, for the "from" line. */
  topic: string;
  /** The instruction ("Completa la frase"). */
  prompt: string;
  /** The sentence (with ___) or question. */
  question: string;
  options: QuizOption[];
  answer: number;
  /** What the learner originally wrote, shown after answering. */
  yours: string;
}

/** What the browser gets before answering. */
export interface ClientQuizQuestion {
  id: string;
  source: QuizSource;
  date: string;
  topic: string;
  prompt: string;
  question: string;
  options: string[];
}

/** The correction of one answer. */
export interface QuizReveal {
  id: string;
  choice: number;
  correct: boolean;
  answer: number;
  /** Why the chosen option is wrong (empty when right). */
  why: string;
  /** Why the right option is right. */
  rightWhy: string;
  yours: string;
}

export function toClientQuestion(q: QuizQuestion): ClientQuizQuestion {
  return { id: q.id, source: q.source, date: q.date, topic: q.topic, prompt: q.prompt, question: q.question, options: q.options.map((o) => o.text) };
}

export function reveal(q: QuizQuestion, choice: number): QuizReveal {
  const correct = choice === q.answer;
  return {
    id: q.id,
    choice,
    correct,
    answer: q.answer,
    why: correct ? "" : q.options[choice]?.why ?? "",
    rightWhy: q.options[q.answer]?.why ?? "",
    yours: q.yours,
  };
}

// ─── Mastery ─────────────────────────────────────────────────────────────────

export interface MistakeRecord {
  asked: number;
  /** Right answers in a row, up to the last time it was asked. */
  streak: number;
  lastCorrect: boolean;
}

export interface PastQuiz {
  questions: unknown;
  responses: unknown;
  createdAt: Date;
}

/** How each mistake went in past quizzes (oldest first so streaks add up). */
export function masteryFrom(quizzes: PastQuiz[]): Map<string, MistakeRecord> {
  const out = new Map<string, MistakeRecord>();
  for (const s of [...quizzes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const questions = Array.isArray(s.questions) ? (s.questions as QuizQuestion[]) : [];
    const responses = (s.responses ?? {}) as Record<string, number>;
    for (const q of questions) {
      if (typeof responses[q.id] !== "number") continue;
      const ok = responses[q.id] === q.answer;
      const r = out.get(q.key) ?? { asked: 0, streak: 0, lastCorrect: false };
      out.set(q.key, { asked: r.asked + 1, streak: ok ? r.streak + 1 : 0, lastCorrect: ok });
    }
  }
  return out;
}

export const isMastered = (r: MistakeRecord | undefined) => !!r && r.streak >= MASTERED_AFTER;

/** Where a mistake comes from (a writing, a round, a lesson), to spread questions out. */
const originOf = (key: string) => key.split(":").slice(0, 2).join(":");

/**
 * Choose the mistakes for a quiz: never-asked first, then the ones failed last
 * time, then the ones right once; newest first inside each group, mixed across
 * sources so a quiz isn't all one kind.
 */
export function pickSeeds(seeds: QuizSeed[], mastery: Map<string, MistakeRecord>, count: number): QuizSeed[] {
  const tier = (s: QuizSeed) => {
    const r = mastery.get(s.key);
    if (!r) return 0;
    return r.lastCorrect ? 2 : 1;
  };
  const bySource = new Map<QuizSource, QuizSeed[]>();
  for (const s of seeds) {
    if (isMastered(mastery.get(s.key))) continue;
    bySource.set(s.source, [...(bySource.get(s.source) ?? []), s]);
  }
  for (const list of bySource.values()) {
    list.sort((a, b) => tier(a) - tier(b) || b.date.localeCompare(a.date));
  }

  const picked: QuizSeed[] = [];
  const perSource = new Map<QuizSource, number>();
  const perOrigin = new Map<string, number>();
  const take = (respectCaps: boolean) => {
    let progress = true;
    while (picked.length < count && progress) {
      progress = false;
      for (const source of QUIZ_SOURCES) {
        if (picked.length >= count) break;
        if (respectCaps && (perSource.get(source) ?? 0) >= SOURCE_CAP[source]) continue;
        const list = bySource.get(source) ?? [];
        const i = list.findIndex((s) => !respectCaps || (perOrigin.get(originOf(s.key)) ?? 0) < SAME_ORIGIN_CAP);
        if (i < 0) continue;
        const [s] = list.splice(i, 1);
        picked.push(s);
        perSource.set(source, (perSource.get(source) ?? 0) + 1);
        perOrigin.set(originOf(s.key), (perOrigin.get(originOf(s.key)) ?? 0) + 1);
        progress = true;
      }
    }
  };
  take(true);
  // Few mistakes of other kinds: fill up from whatever is left.
  take(false);
  return picked;
}

// ─── Questions from the model ────────────────────────────────────────────────

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const norm = (s: string) => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[.!?,;:"“”]/g, "").replace(/\s+/g, " ").trim();

export function shuffleOptions(options: QuizOption[], answer: number): { options: QuizOption[]; answer: number } {
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { options: order.map((i) => options[i]), answer: order.indexOf(answer) };
}

/** What the learner wrote for a mistake. */
export function yoursOf(seed: QuizSeed): string {
  if (seed.source === "writing") return seed.quote;
  if (seed.source === "translation") return seed.answer;
  if (seed.source === "teacher") return seed.given;
  return "";
}

export function topicOf(seed: QuizSeed): string {
  if (seed.source === "writing") return seed.tag;
  if (seed.source === "teacher") return seed.topic;
  return "";
}

/** Validate the model's questions; the ones it skipped or got malformed are dropped. */
export function sanitizeQuestions(raw: unknown, seeds: Map<string, QuizSeed>): Omit<QuizQuestion, "id">[] {
  const list = Array.isArray((raw as { questions?: unknown })?.questions) ? (raw as { questions: unknown[] }).questions : [];
  const out: Omit<QuizQuestion, "id">[] = [];
  const used = new Set<string>();
  for (const item of list) {
    const o = (item ?? {}) as Record<string, unknown>;
    const seed = seeds.get(str(o.seed, 12));
    if (!seed || used.has(seed.key) || o.skip === true) continue;
    const question = str(o.question, 400);
    const prompt = str(o.prompt, 80);
    const options = (Array.isArray(o.options) ? o.options : [])
      .map((x) => {
        const y = (x ?? {}) as Record<string, unknown>;
        return { text: str(y.text, 200), why: str(y.why, 320) };
      })
      .filter((x) => x.text)
      .slice(0, 4);
    const answer = typeof o.answer === "number" ? o.answer : Number(o.answer);
    if (!question || options.length < 3 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
    if (new Set(options.map((x) => norm(x.text))).size !== options.length) continue;
    used.add(seed.key);
    out.push({
      key: seed.key,
      source: seed.source,
      date: seed.date,
      topic: topicOf(seed),
      prompt,
      question,
      ...shuffleOptions(options, answer),
      yours: yoursOf(seed),
    });
  }
  return out;
}
