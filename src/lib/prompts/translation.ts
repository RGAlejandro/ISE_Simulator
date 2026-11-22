import type { ExamLevel } from "@/types";
import { EXAM_LEVELS } from "@/lib/constants";
import { LEVEL_STRUCTURES, TRANSLATION_ROUND, type SourceLang, type TranslationItem } from "@/lib/translation";
import { feedbackLanguage } from "./writing";

const SOURCE_NAME: Record<SourceLang, string> = { es: "Spanish (Spain)", fr: "French (France)" };

const levelLabel = (level: ExamLevel) => {
  const l = EXAM_LEVELS.find((x) => x.value === level);
  return l ? `${l.label} (CEFR ${l.cefr})` : level;
};

/** Pick `n` structures for a round, shuffled so rounds differ. */
export function pickStructures(level: ExamLevel, n = TRANSLATION_ROUND): string[] {
  const pool = [...LEVEL_STRUCTURES[level]];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export function translationGeneratePrompt(level: ExamLevel, source: SourceLang, structures: string[]): string {
  const lang = SOURCE_NAME[source];
  return `You write translation drills for a learner preparing Trinity ${levelLabel(level)}.

Write ${structures.length} sentences in ${lang} that the learner will translate into English. Sentence i must force the English structure number i:
${structures.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Rules:
- Natural, everyday ${lang} as a native speaker would say it, never a word-for-word calque of English. Topics a Trinity candidate meets: study, work, travel, technology, environment, health, society, personal experiences. Vary topics; no two sentences on the same topic.
- One sentence each (two short clauses at most), 8–22 words, matching the level: simpler vocabulary for Foundation and ISE I, richer for ISE III and IV.
- The ${lang} sentence must be unambiguous, so a good translation clearly needs the target structure.
- "reference": one natural, correct British English translation using the target structure.
- "structure": the target structure as a short English label (e.g. "third conditional").

Return ONLY valid JSON:
{"items":[{"source":"…","reference":"…","structure":"…"}]}`;
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
