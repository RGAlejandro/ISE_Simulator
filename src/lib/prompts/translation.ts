import type { ExamLevel } from "@/types";
import { EXAM_LEVELS } from "@/lib/constants";
import { DEFAULT_ROUND, LEVEL_STRUCTURES, type SourceLang, type TranslationItem } from "@/lib/translation";
import { feedbackLanguage } from "./writing";

const SOURCE_NAME: Record<SourceLang, string> = { es: "Spanish (Spain)", fr: "French (France)" };

const levelLabel = (level: ExamLevel) => {
  const l = EXAM_LEVELS.find((x) => x.value === level);
  return l ? `${l.label} (CEFR ${l.cefr})` : level;
};

function shuffled<T>(list: readonly T[]): T[] {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** Pick `n` structures for a round, shuffled so rounds differ. Past the level's list, it goes round again in a new order. */
export function pickStructures(level: ExamLevel, n: number = DEFAULT_ROUND): string[] {
  const out: string[] = [];
  while (out.length < n) {
    let next = shuffled(LEVEL_STRUCTURES[level]);
    // Never the same structure twice in a row across the seam.
    if (out.length > 0 && next[0] === out[out.length - 1]) next = [...next.slice(1), next[0]];
    out.push(...next.slice(0, n - out.length));
  }
  return out;
}

export function translationGeneratePrompt(level: ExamLevel, source: SourceLang, structures: string[], locale: string): string {
  const lang = SOURCE_NAME[source];
  const hintLang = feedbackLanguage(locale);
  return `You write translation drills for a learner preparing Trinity ${levelLabel(level)}.

Write ${structures.length} sentences in ${lang} that the learner will translate into English. Sentence i must force the English structure number i:
${structures.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Rules:
- Natural, everyday ${lang} as a native speaker would say it, never a word-for-word calque of English. Topics a Trinity candidate meets: study, work, travel, technology, environment, health, society, personal experiences. Vary topics as much as you can, and never two sentences in a row on the same topic; when a structure repeats, use it in a clearly different situation.
- One sentence each (two short clauses at most), 8–22 words, matching the level: simpler vocabulary for Foundation and ISE I, richer for ISE III and IV.
- The ${lang} sentence must be unambiguous, so a good translation clearly needs the target structure.
- "reference": one natural, correct British English translation using the target structure.
- "structure": the target structure as a short English label (e.g. "third conditional").
- Two hints for a learner who is stuck, written in ${hintLang}; they help without giving the sentence away:
  - "pattern": max 90 characters, how the structure is built, as a formula with English words (e.g. "If + past perfect, … would have + participle"). Never the translated sentence itself.
  - "words": 1-3 words or short phrases from the ${lang} sentence a learner at this level may not know, each with its English equivalent in this sentence: [{"from":"plazo","to":"deadline"}]. Content words only (nouns, verbs, adjectives), never the words that form the target structure, and never words that are nearly the same in English (aurora → aurora, fiscal → fiscal).
- Before answering, re-read every ${lang} sentence: it must make complete sense to a native speaker on its own, and the reference must mean exactly the same. Rewrite any that doesn't.

Return ONLY valid JSON:
{"items":[{"source":"…","reference":"…","structure":"…","pattern":"…","words":[{"from":"…","to":"…"}]}]}`;
}

export function translationCheckPrompt(opts: {
  level: ExamLevel;
  source: SourceLang;
  item: TranslationItem;
  answer: string;
  locale: string;
}): string {
  const { level, source, item, answer, locale } = opts;
  const fb = feedbackLanguage(locale);
  return `You are a Trinity ISE examiner checking a translation drill at ${levelLabel(level)}.

Original (${SOURCE_NAME[source]}): ${JSON.stringify(item.source)}
Target structure: ${item.structure}
One valid reference: ${JSON.stringify(item.reference)}
Learner's English: ${JSON.stringify(answer)}

Judge the learner's sentence on its own merits. Many translations are valid; never penalise a correct one just for differing from the reference.
- "correct": accurate meaning and grammatically correct English (minor punctuation or capitalisation slips don't count).
- "almost": meaning is right but there is one small error (an article, preposition, word order, a tense slip) or it avoids the target structure while still being correct English.
- "wrong": meaning is lost or changed, there are several errors, or the main structure is broken.

Return ONLY valid JSON:
{
  "verdict": "correct" | "almost" | "wrong",
  "corrected": "the learner's own sentence with only the fixes it needs (identical to the answer if correct)",
  "note": "${fb}, max 25 words: the single most useful point (the main error and the rule). If correct, a brief note on what they did well, or an empty string",
  "natural": "a higher-band English version with exactly the same meaning and tense as the original. If the learner avoided the target structure, this version must use it. Only if it teaches something; otherwise empty string"
}`;
}
