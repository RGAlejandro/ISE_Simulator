import { getTranslationLang, type CefrBand } from "./vocabulary";

/**
 * Reading Explorer topics per CEFR band. B1+ follow the official Trinity ISE
 * subject areas for the matching level (ISE I = B1 … ISE IV = C2), so reading
 * also builds the vocabulary candidates need for the speaking topics.
 */
export const READING_TOPICS: Record<CefrBand, string[]> = {
  A1: ["Family", "My home", "Food and drink", "Daily routine", "Pets", "Weather", "Clothes", "My town"],
  A2: [
    "Holidays", "Shopping", "School and work", "Hobbies and sports", "Food",
    "Weekend and seasonal activities", "Jobs", "Home life", "Weather", "Free time",
  ],
  B1: [
    "Travel", "Money", "Fashion", "Rules and regulations", "Health and fitness",
    "Learning a foreign language", "Festivals", "Means of transport", "Special occasions",
    "Entertainment", "Music", "Recent personal experiences",
  ],
  B2: [
    "Society and living standards", "Personal values and ideals", "The world of work",
    "Natural environmental concerns", "Public figures past and present",
    "Technology in everyday life", "Education", "Health and wellbeing",
  ],
  C1: [
    "Independence", "Ambitions", "Stereotypes", "Role models", "Competitiveness",
    "Young people's rights", "The media", "Advertising", "Lifestyles", "The arts",
    "The rights of the individual", "Economic issues",
  ],
  C2: [
    "Globalisation and its impact", "Ethical dilemmas in modern society", "The role of the state",
    "Cultural identity", "Future of technology", "Science and society",
  ],
};

export function pickReadingTopic(level: CefrBand): string {
  const pool = READING_TOPICS[level];
  return pool[Math.floor(Math.random() * pool.length)];
}

const LEVEL_SPEC: Record<CefrBand, { words: string; paragraphs: string; targets: number; language: string }> = {
  A1: {
    words: "120-160",
    paragraphs: "3",
    targets: 6,
    language: "Very short, simple sentences. Present simple, 'can', 'there is/are'. Only the most common everyday words.",
  },
  A2: {
    words: "160-210",
    paragraphs: "3",
    targets: 6,
    language: "Short sentences joined with and/but/because. Present and past simple, 'going to'. Common everyday vocabulary.",
  },
  B1: {
    words: "220-280",
    paragraphs: "3-4",
    targets: 8,
    language: "Clear connected text. Varied tenses, simple opinions and reasons, common phrasal verbs and collocations.",
  },
  B2: {
    words: "280-340",
    paragraphs: "4",
    targets: 8,
    language: "Well-organised text with arguments and examples. Complex sentences, linking devices, less common collocations.",
  },
  C1: {
    words: "330-400",
    paragraphs: "4-5",
    targets: 8,
    language: "Sophisticated, nuanced text with an academic or journalistic register, implicit attitudes and idiomatic language.",
  },
  C2: {
    words: "360-440",
    paragraphs: "4-5",
    targets: 8,
    language: "Near-native, stylistically rich text: subtle distinctions, rhetorical devices, low-frequency and figurative language.",
  },
};

export function readingTargetCount(level: CefrBand): number {
  return LEVEL_SPEC[level].targets;
}

export function generateReadingPrompt(opts: {
  level: CefrBand;
  topic: string;
  locale: string;
  listWords?: string[];
}): string {
  const { level, topic, locale, listWords = [] } = opts;
  const spec = LEVEL_SPEC[level];
  const lang = getTranslationLang(locale);
  const lowLevel = level === "A1" || level === "A2";
  const optionsLanguage = lowLevel ? `written in ${lang.name}` : "in simple English";

  const listBlock =
    listWords.length > 0
      ? `\nThe learner is revising these words from their saved list. Use EACH of them naturally somewhere in the text (any inflected form is fine):\n${listWords.map((w) => `- ${w}`).join("\n")}\n`
      : "";
  const newWords = listWords.length > 0 ? Math.max(3, spec.targets - listWords.length) : spec.targets;
  const keyWordsRule =
    listWords.length > 0
      ? `- FIRST, one entry for EACH of the learner's list words above, with "word" = the exact form you used in the text (e.g. "ran out of" for "run out of") and "lemma" = the list word.
- THEN ${newWords} more useful words or expressions FROM THE TEXT that a ${level} learner probably doesn't know yet.`
      : `- Choose ${spec.targets} useful words or expressions FROM THE TEXT that a ${level} learner probably doesn't know yet but should learn for the exam. Mix nouns, verbs and adjectives and, where natural, a phrasal verb or a collocation.`;

  return `You are an expert materials writer creating a graded reading text for a ${lang.name}-speaking learner of English who is preparing for the Trinity College London ISE exams.

LEVEL: CEFR ${level}. ${spec.language}
TOPIC: ${topic}
${listBlock}
TEXT
- Write an engaging text (magazine article, blog post, short report or story) of ${spec.words} words in ${spec.paragraphs} paragraphs.
- Grammar and most of the vocabulary must be comfortable for ${level}; around 5% of the words can be slightly above it — those are the words worth learning.
- British English spelling. No headings inside the paragraphs, no lists, no abbreviations such as "e.g." or "etc.".
- Do not write about real, named living people.

KEY WORDS ("targetWords")
${keyWordsRule}
- "word" must be copied EXACTLY as it appears in the text (same inflection), e.g. "thrived", "came across".
- Never pick proper nouns, numbers or very basic words.

QUIZ ("questions") — exactly 8, in this order:
- Questions 1-4, type "context": each about a DIFFERENT key word${listWords.length > 0 ? " (prefer the learner's list words)" : ""}. "question": "What does '<word>' mean in the text?". 4 "options" ${optionsLanguage}, max 8 words each. Only one option fits the context; the other three must be plausible meanings of the same word in other contexts or of similar-looking words. "explanation": one sentence naming the context clue.
- Questions 5-6, type "find": target a key word NOT used in questions 1-4. "clue": "Find a word that means '<simple meaning>'" (do not mention the paragraph in the clue). "paragraph": the 1-based paragraph where it appears. "answer": the word exactly as it appears in the text.
- Questions 7-8, type "comprehension": Trinity ISE reading style questions about the main ideas, the writer's purpose or specific details. 4 "options" in English, exactly one correct.
- "answer" for questions with options is the 0-based index of the correct option.

Return ONLY valid JSON:
{
  "title": "Short engaging title",
  "paragraphs": ["First paragraph...", "Second paragraph..."],
  "targetWords": [
    {
      "word": "exact form in the text",
      "lemma": "dictionary form, e.g. 'thrive' or 'come across'",
      "partOfSpeech": "noun|verb|adjective|adverb|phrasal verb|phrase|idiom",
      "translation": "${lang.hint}, the meaning in THIS text",
      "definition": "simple English definition, max 12 words"
    }
  ],
  "questions": [
    { "type": "context", "word": "...", "question": "...", "options": ["...", "...", "...", "..."], "answer": 2, "explanation": "..." },
    { "type": "find", "clue": "...", "paragraph": 2, "answer": "...", "explanation": "..." },
    { "type": "comprehension", "question": "...", "options": ["...", "...", "...", "..."], "answer": 1, "explanation": "..." }
  ]
}

No text outside the JSON.`;
}

/**
 * Gloss one tapped word in the sentence it appears in. The sentence always
 * comes from our own stored text (never from the client).
 */
export function generateReadingLookupPrompt(opts: {
  word: string;
  sentence: string;
  locale: string;
  level: CefrBand;
}): string {
  const { word, sentence, locale, level } = opts;
  const lang = getTranslationLang(locale);
  return `You are a bilingual English-${lang.name} learner's dictionary. A ${level} learner reading an English text tapped a word.

Word tapped: "${word}"
Sentence: "${sentence}"

Explain what "${word}" means IN THIS SENTENCE. If it is part of a phrasal verb, idiom or fixed expression in this sentence, explain the whole expression instead and use it as the lemma.

Return ONLY valid JSON:
{
  "lemma": "dictionary form (infinitive for verbs, singular for nouns) or the full expression",
  "partOfSpeech": "noun|verb|adjective|adverb|preposition|conjunction|pronoun|determiner|phrasal verb|phrase|idiom",
  "translation": "${lang.hint} — the meaning in this sentence",
  "definition": "simple English definition of this meaning, max 15 words",
  "level": "A1|A2|B1|B2|C1|C2"
}

No text outside the JSON.`;
}
