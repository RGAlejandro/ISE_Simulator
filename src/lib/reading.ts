/**
 * Reading Explorer — pure helpers shared by the API routes and the client.
 * Client and server MUST split text identically: lookups are addressed by
 * (paragraph, sentence) indices, and the server re-derives the sentence from
 * the stored text instead of trusting client-sent text.
 */
import type {
  ReadingAnswer,
  ReadingContent,
  ReadingLookupData,
  ReadingQuestion,
  ReadingTargetWord,
} from "@/types";

const LETTER = "A-Za-zÀ-ÖØ-öø-ÿ";
const WORD_RE = new RegExp(`[${LETTER}]+(?:['’-][${LETTER}]+)*`, "g");

export interface Token {
  text: string;
  isWord: boolean;
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    const i = m.index ?? 0;
    if (i > last) tokens.push({ text: text.slice(last, i), isWord: false });
    tokens.push({ text: m[0], isWord: true });
    last = i + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), isWord: false });
  return tokens;
}

/** Lower-case, straight apostrophes, single spaces. */
export function normalizeWord(s: string): string {
  return s.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

/** Collapse all whitespace so `splitSentences(p).join(" ") === p`. */
export function normalizeParagraph(p: string): string {
  return p.replace(/\s+/g, " ").trim();
}

/**
 * Split a (normalised) paragraph into sentences. Only breaks when the next
 * sentence starts with a capital/digit/opening quote, so "e.g. this" stays whole.
 */
export function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?]["'”’)\]]?)\s+(?=["'“‘(\[]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Token index ranges [start, end] (inclusive) where `phrase` occurs in `tokens`. */
function phraseRanges(tokens: Token[], phrase: string): [number, number][] {
  const words = tokenize(phrase).filter((t) => t.isWord).map((t) => normalizeWord(t.text));
  if (words.length === 0) return [];
  const ranges: [number, number][] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].isWord || normalizeWord(tokens[i].text) !== words[0]) continue;
    let j = i;
    let ok = true;
    for (let k = 1; k < words.length; k++) {
      // Words of a multi-word expression may only be separated by whitespace.
      const gap = tokens[j + 1];
      const next = tokens[j + 2];
      if (!gap || gap.isWord || !/^\s+$/.test(gap.text) || !next?.isWord || normalizeWord(next.text) !== words[k]) {
        ok = false;
        break;
      }
      j += 2;
    }
    if (ok) ranges.push([i, j]);
  }
  return ranges;
}

export function containsPhrase(text: string, phrase: string): boolean {
  return phraseRanges(tokenize(text), phrase).length > 0;
}

/** First (paragraph, sentence) where `phrase` occurs, or null. */
export function locatePhrase(paragraphs: string[], phrase: string): { paragraph: number; sentence: number; text: string } | null {
  for (let p = 0; p < paragraphs.length; p++) {
    const sentences = splitSentences(paragraphs[p]);
    for (let s = 0; s < sentences.length; s++) {
      if (containsPhrase(sentences[s], phrase)) return { paragraph: p, sentence: s, text: sentences[s] };
    }
  }
  return null;
}

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "word"; text: string }
  | { kind: "target"; text: string; target: number };

/**
 * Split a sentence into renderable segments: plain text, tappable words and
 * key-word spans (multi-word expressions become one span). Longer expressions
 * win over shorter ones when they overlap.
 */
export function buildSegments(sentence: string, targetPhrases: string[]): Segment[] {
  const tokens = tokenize(sentence);
  const owner = new Array<number>(tokens.length).fill(-1);
  const rangeEnd = new Map<number, number>();

  const order = targetPhrases
    .map((phrase, idx) => ({ phrase, idx, len: tokenize(phrase).filter((t) => t.isWord).length }))
    .sort((a, b) => b.len - a.len);

  for (const { phrase, idx } of order) {
    for (const [start, end] of phraseRanges(tokens, phrase)) {
      let free = true;
      for (let i = start; i <= end; i++) if (owner[i] !== -1) free = false;
      if (!free) continue;
      for (let i = start; i <= end; i++) owner[i] = idx;
      rangeEnd.set(start, end);
    }
  }

  const segments: Segment[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const end = rangeEnd.get(i);
    if (end !== undefined) {
      segments.push({ kind: "target", text: tokens.slice(i, end + 1).map((t) => t.text).join(""), target: owner[i] });
      i = end;
    } else if (tokens[i].isWord) {
      segments.push({ kind: "word", text: tokens[i].text });
    } else {
      segments.push({ kind: "text", text: tokens[i].text });
    }
  }
  return segments;
}

/** Plain client-safe shape of a ReadingLookup row. */
export function toLookupData(l: ReadingLookupData): ReadingLookupData {
  return {
    word: l.word,
    paragraph: l.paragraph,
    sentence: l.sentence,
    lemma: l.lemma,
    partOfSpeech: l.partOfSpeech,
    translation: l.translation,
    definition: l.definition,
    level: l.level,
  };
}

export function isAnswerCorrect(question: ReadingQuestion, answer: ReadingAnswer): boolean {
  if (question.type === "find") {
    return typeof answer === "string" && normalizeWord(answer) === normalizeWord(question.answer);
  }
  return typeof answer === "number" && answer === question.answer;
}

export function gradeAnswers(questions: ReadingQuestion[], answers: ReadingAnswer[]): number {
  return questions.reduce((n, q, i) => n + (isAnswerCorrect(q, answers[i] ?? null) ? 1 : 0), 0);
}

// ── Sanitising AI output ────────────────────────────────────────────────────

const MAX_TARGETS = 12;
const MAX_PER_TYPE = { context: 4, find: 2, comprehension: 2 } as const;

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function shuffleOptions(options: string[], answer: number): { options: string[]; answer: number } {
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { options: order.map((i) => options[i]), answer: order.indexOf(answer) };
}

function cleanOptions(raw: unknown, answer: unknown): { options: string[]; answer: number } | null {
  if (!Array.isArray(raw) || typeof answer !== "number" || !Number.isInteger(answer)) return null;
  const options = raw.map((o) => str(o, 160));
  if (options.length < 3 || options.length > 5 || options.some((o) => !o)) return null;
  if (new Set(options.map(normalizeWord)).size !== options.length) return null;
  if (answer < 0 || answer >= options.length) return null;
  // Models put the right answer first far too often — shuffle server-side.
  return shuffleOptions(options, answer);
}

/**
 * Validate and repair the model's JSON. Drops key words that don't occur in the
 * text and questions that can't be answered from it. Returns null when what's
 * left isn't enough for a session.
 */
export function sanitizeReadingContent(
  raw: unknown,
  minTargets = 4,
): { title: string; content: ReadingContent } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;

  const title = str(data.title, 120);
  const paragraphs = Array.isArray(data.paragraphs)
    ? data.paragraphs.map((p) => (typeof p === "string" ? normalizeParagraph(p).slice(0, 2000) : "")).filter(Boolean)
    : [];
  if (!title || paragraphs.length < 2) return null;
  const fullText = paragraphs.join(" ");

  const targetWords: ReadingTargetWord[] = [];
  const seen = new Set<string>();
  for (const t of Array.isArray(data.targetWords) ? data.targetWords : []) {
    if (typeof t !== "object" || t === null) continue;
    const r = t as Record<string, unknown>;
    let word = str(r.word, 60);
    const lemma = str(r.lemma, 60) || word;
    const translation = str(r.translation, 80);
    const definition = str(r.definition, 200);
    if (!translation || !definition) continue;
    // The model sometimes returns the lemma instead of the inflected form.
    if (!word || !containsPhrase(fullText, word)) {
      if (lemma && containsPhrase(fullText, lemma)) word = lemma;
      else continue;
    }
    const key = normalizeWord(word);
    if (seen.has(key)) continue;
    seen.add(key);
    targetWords.push({ word, lemma, partOfSpeech: str(r.partOfSpeech, 30) || "word", translation, definition });
    if (targetWords.length >= MAX_TARGETS) break;
  }
  if (targetWords.length < minTargets) return null;

  const buckets: Record<ReadingQuestion["type"], ReadingQuestion[]> = { context: [], find: [], comprehension: [] };
  for (const q of Array.isArray(data.questions) ? data.questions : []) {
    if (typeof q !== "object" || q === null) continue;
    const r = q as Record<string, unknown>;
    const explanation = str(r.explanation, 300);

    if (r.type === "context") {
      const word = str(r.word, 60);
      const where = word ? locatePhrase(paragraphs, word) : null;
      const opts = cleanOptions(r.options, r.answer);
      if (!where || !opts) continue;
      if (buckets.context.some((x) => x.type === "context" && normalizeWord(x.word) === normalizeWord(word))) continue;
      buckets.context.push({
        type: "context",
        word,
        sentence: where.text,
        question: str(r.question, 200) || `What does "${word}" mean in the text?`,
        ...opts,
        explanation,
      });
    } else if (r.type === "find") {
      const answer = str(r.answer, 60);
      // The paragraph is shown separately, so drop it from the clue if the model added it.
      const clue = str(r.clue, 200).replace(/\s*\(?\bin paragraph \d+\)?/i, "");
      const where = answer ? locatePhrase(paragraphs, answer) : null;
      if (!clue || !where) continue;
      // A word already explained by a "context" question would give the answer away.
      if (buckets.context.some((x) => x.type === "context" && normalizeWord(x.word) === normalizeWord(answer))) continue;
      const hinted = typeof r.paragraph === "number" ? r.paragraph - 1 : -1;
      const paragraph =
        hinted >= 0 && hinted < paragraphs.length && containsPhrase(paragraphs[hinted], answer) ? hinted : where.paragraph;
      buckets.find.push({ type: "find", clue, paragraph: paragraph + 1, answer, explanation });
    } else if (r.type === "comprehension") {
      const question = str(r.question, 300);
      const opts = cleanOptions(r.options, r.answer);
      if (!question || !opts) continue;
      buckets.comprehension.push({ type: "comprehension", question, ...opts, explanation });
    }
  }

  const questions = [
    ...buckets.context.slice(0, MAX_PER_TYPE.context),
    ...buckets.find.slice(0, MAX_PER_TYPE.find),
    ...buckets.comprehension.slice(0, MAX_PER_TYPE.comprehension),
  ];
  if (questions.length < 4) return null;

  return { title, content: { paragraphs, targetWords, questions } };
}
