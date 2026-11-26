/**
 * Multiple-choice quiz over a vocabulary list. No AI: the wrong options are
 * the learner's other words (from the same list first), so every question is
 * instant and free.
 */

export type ListQuizKind = "meaning" | "word" | "gap" | "listen";

export interface QuizWord {
  english: string;
  translation: string;
  partOfSpeech: string | null;
  /** Only needed for the gap question. */
  example?: string;
}

export interface ListQuizOption {
  text: string;
  /** The same word on the other side, shown after a wrong pick ("convey" → "transmitir"). */
  pair: string;
}

export interface ListQuizQuestion {
  kind: ListQuizKind;
  /** The English word, the translation or the sentence with a gap. Empty for "listen" (the word is played). */
  prompt: string;
  options: ListQuizOption[];
  answer: number;
}

export const QUIZ_OPTIONS = 4;
export const QUIZ_KINDS: readonly ListQuizKind[] = ["meaning", "word", "gap", "listen"];

/** What the learner wants to practise: reading and spelling, listening, or both. */
export type QuizSense = "text" | "audio" | "both";
export const QUIZ_SENSES: Record<QuizSense, readonly ListQuizKind[]> = {
  text: ["meaning", "word", "gap"],
  audio: ["listen"],
  both: QUIZ_KINDS,
};

type Rng = () => number;

const norm = (s: string) => s.trim().toLowerCase();

/** "verb · transitive" → "verb". */
export const baseType = (pos: string | null | undefined) => (pos ?? "").split("·")[0].trim().toLowerCase();

/** Replace the word in its example (case-insensitive, with -s/-es/-ed/-ing/-d) by a gap. */
export function gapSentence(example: string, word: string): { sentence: string; found: boolean } {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return { sentence: example, found: false };
  const re = new RegExp(`\\b${escaped}(s|es|ed|ing|d)?\\b`, "i");
  if (re.test(example)) return { sentence: example.replace(re, "______"), found: true };
  return { sentence: example, found: false };
}

/** Distinct words (by English and by translation), the list's own first. */
export function quizPool(cards: QuizWord[], extra: QuizWord[] = []): QuizWord[] {
  const en = new Set<string>();
  const tr = new Set<string>();
  const out: QuizWord[] = [];
  for (const w of [...cards, ...extra]) {
    const e = norm(w.english);
    const t = norm(w.translation);
    if (!e || !t || en.has(e) || tr.has(t)) continue;
    en.add(e);
    tr.add(t);
    out.push(w);
  }
  return out;
}

/** The quiz needs one right and three wrong options. */
export const canQuiz = (pool: QuizWord[]) => pool.length >= QUIZ_OPTIONS;

function shuffled<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Three wrong options. Same word type first ("decipher" against other verbs is
 * a real choice), except in a gap, where a different type keeps the sentence
 * from having two right answers. Inside each group, the list's own words first.
 */
function distractors(card: QuizWord, pool: QuizWord[], inList: Set<string>, kind: ListQuizKind, rng: Rng): QuizWord[] {
  const side = kind === "meaning" || kind === "listen" ? "translation" : "english";
  const type = baseType(card.partOfSpeech);
  const others = pool.filter((w) => norm(w.english) !== norm(card.english) && norm(w.translation) !== norm(card.translation));
  const sameType = (w: QuizWord) => baseType(w.partOfSpeech) === type;
  const preferred = kind === "gap" ? (w: QuizWord) => !sameType(w) : sameType;
  const group = (typeMatch: boolean, listMatch: boolean) =>
    shuffled(others.filter((w) => preferred(w) === typeMatch && inList.has(norm(w.english)) === listMatch), rng);
  const ranked = [...group(true, true), ...group(true, false), ...group(false, true), ...group(false, false)];

  const picks: QuizWord[] = [];
  for (const w of ranked) {
    if (picks.some((p) => norm(p[side]) === norm(w[side]))) continue;
    picks.push(w);
    if (picks.length === QUIZ_OPTIONS - 1) break;
  }
  return picks;
}

/** One question of the given kind, or null when it can't be asked (no gap in the example, too few words). */
export function makeQuestion(card: QuizWord, kind: ListQuizKind, pool: QuizWord[], inList: Set<string>, rng: Rng = Math.random): ListQuizQuestion | null {
  let prompt = "";
  if (kind === "meaning") prompt = card.english;
  else if (kind === "word") prompt = card.translation;
  else if (kind === "gap") {
    const gap = gapSentence(card.example ?? "", card.english);
    if (!gap.found) return null;
    prompt = gap.sentence;
  }

  const picks = distractors(card, pool, inList, kind, rng);
  if (picks.length < QUIZ_OPTIONS - 1) return null;

  const english = kind === "word" || kind === "gap";
  const options = [card, ...picks].map((w) => ({
    text: english ? w.english : w.translation,
    pair: english ? w.translation : w.english,
  }));
  const order = shuffled(options.map((_, i) => i), rng);
  return { kind, prompt, options: order.map((i) => options[i]), answer: order.indexOf(0) };
}

/**
 * One question per card of `deck`. The chosen `kinds` take turns (by default
 * meaning, word, gap, listen) so a round never feels the same; a card that
 * can't take its turn's kind gets the next one. Cards with no possible
 * question are left out.
 * Wrong options come from the whole `list` (also when the deck is only the
 * missed words), then from the learner's `extra` words.
 */
export function buildListQuiz<T extends QuizWord & { id: string }>(
  deck: T[],
  {
    list = deck,
    extra = [],
    kinds = QUIZ_KINDS,
    rng = Math.random,
  }: { list?: QuizWord[]; extra?: QuizWord[]; kinds?: readonly ListQuizKind[]; rng?: Rng } = {},
): Record<string, ListQuizQuestion> {
  const pool = quizPool([...deck, ...list], extra);
  const inList = new Set([...deck, ...list].map((c) => norm(c.english)));
  const start = Math.floor(rng() * kinds.length);
  const out: Record<string, ListQuizQuestion> = {};
  deck.forEach((card, i) => {
    for (let k = 0; k < kinds.length; k++) {
      const q = makeQuestion(card, kinds[(start + i + k) % kinds.length], pool, inList, rng);
      if (q) {
        out[card.id] = q;
        break;
      }
    }
  });
  return out;
}
