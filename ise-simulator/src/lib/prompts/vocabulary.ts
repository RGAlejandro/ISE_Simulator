export const SCORE_TO_LEVEL = [
  { min: 0,  max: 16,  cefr: "A1", label: "Beginner" },
  { min: 17, max: 33,  cefr: "A2", label: "Elementary" },
  { min: 34, max: 50,  cefr: "B1", label: "Intermediate" },
  { min: 51, max: 67,  cefr: "B2", label: "Upper-Intermediate" },
  { min: 68, max: 84,  cefr: "C1", label: "Advanced" },
  { min: 85, max: 100, cefr: "C2", label: "Mastery" },
] as const;

export type CefrBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export function scoreToLevel(score: number): { cefr: CefrBand; label: string } {
  const band = SCORE_TO_LEVEL.find((b) => score >= b.min && score <= b.max);
  return band ?? { cefr: "B1", label: "Intermediate" };
}

export function levelToStartScore(cefr: CefrBand): number {
  const band = SCORE_TO_LEVEL.find((b) => b.cefr === cefr);
  if (!band) return 42;
  return Math.round((band.min + band.max) / 2);
}

const SCORE_DESCRIPTORS: Record<CefrBand, { complexity: string; examples: string }> = {
  A1: {
    complexity: "Most basic everyday words only. Simple nouns, basic verbs, common adjectives. Words a total beginner needs on day 1.",
    examples: "house, eat, happy, go, small, family, water, Monday",
  },
  A2: {
    complexity: "Common everyday vocabulary. Simple phrases, routine actions, familiar topics. Words for basic survival communication.",
    examples: "appointment, suggest, nervous, prefer, neighbourhood, unfortunately, improve, describe",
  },
  B1: {
    complexity: "Intermediate vocabulary. Concrete and abstract topics. Collocations and common idioms. Words for expressing opinions.",
    examples: "argue, evidence, contribute, barely, outcome, on the other hand, meanwhile, highlight",
  },
  B2: {
    complexity: "Upper-intermediate vocabulary. More abstract and nuanced. Academic collocations. Less common phrasal verbs and idioms.",
    examples: "undermine, consequently, acknowledge, scrutinise, advocate, in spite of, nevertheless, shed light on",
  },
  C1: {
    complexity: "Advanced vocabulary. Sophisticated collocations, formal register, nuanced distinctions, academic and professional terms.",
    examples: "paramount, ostensibly, incline towards, substantiate, unprecedented, contentious, intrinsic, exemplify",
  },
  C2: {
    complexity: "Near-native vocabulary. Rare words, subtle connotations, rhetorical devices, highly specialised terms across domains.",
    examples: "obfuscate, solipsistic, perspicacious, anachronistic, enervate, epistemological, equivocate, verisimilitude",
  },
};

export function generateAdaptiveVocabularyPrompt(
  score: number,
  alreadySeen: string[]
): string {
  const { cefr } = scoreToLevel(score);
  const desc = SCORE_DESCRIPTORS[cefr];

  // Within the band, position affects word selection: lower = simpler end, higher = harder end
  const band = SCORE_TO_LEVEL.find((b) => b.cefr === cefr)!;
  const positionInBand = (score - band.min) / (band.max - band.min); // 0-1
  const positionHint =
    positionInBand < 0.35
      ? "Focus on the simpler/more common end of this level."
      : positionInBand > 0.65
      ? "Focus on the harder/less common end of this level, approaching the next level up."
      : "Focus on typical, representative words for this level.";

  const exclusionNote =
    alreadySeen.length > 0
      ? `\n\nDo NOT use any of these words (already shown this session): ${alreadySeen.slice(-60).join(", ")}`
      : "";

  return `You are generating vocabulary flashcards for an adaptive English learning app for Spanish speakers.

Current difficulty level: ${cefr} (${desc.complexity})
${positionHint}

Word complexity reference for ${cefr}: ${desc.examples}${exclusionNote}

Generate exactly 5 vocabulary items appropriate for ${cefr} level. Each must be:
- A single word or very short phrase (1-3 words)
- Useful and natural in real English
- At the difficulty level described above
- NOT a proper noun, abbreviation, or ultra-technical jargon

Return ONLY valid JSON:
{
  "cards": [
    {
      "english": "the word or phrase",
      "partOfSpeech": "noun|verb|adjective|adverb|phrase|idiom",
      "spanish": "traducción en español (1-4 palabras)",
      "example": "Natural English sentence showing how to use this word correctly"
    }
  ]
}

Rules:
- "english": base form (infinitive for verbs, singular for nouns)
- "spanish": most common Spanish translation, concise
- "example": clear real usage — NOT a definition, NOT a translation
- Do NOT put the Spanish word inside the example
- Exactly 5 items in the array
- No text outside the JSON`;
}

export function generateWordDetailsPrompt(english: string, level: CefrBand): string {
  return `You are a British English lexicographer producing a vocabulary detail card for an English learner at CEFR level ${level}.

Word: "${english}"

Generate a structured profile of this word. Use British English spellings and conventions.

Return ONLY valid JSON:
{
  "ipa": "/səbˈstænʃieɪt/",
  "synonyms": ["confirm", "verify", "corroborate"],
  "antonyms": ["refute", "disprove"],
  "examples": [
    "A real, natural sentence using the word.",
    "Another distinct, realistic example.",
    "A third example showing different context."
  ],
  "collocations": ["substantiate a claim", "substantiate an allegation"],
  "register": "formal"
}

Rules:
- "ipa": British English IPA transcription wrapped in slashes
- "synonyms": 3-5 close-meaning words at or near the same CEFR level
- "antonyms": 2-3 opposing-meaning words (empty array if no clear antonym)
- "examples": exactly 3 distinct, natural sentences using the word — NOT definitions
- "collocations": 2-4 common multi-word patterns the word appears in
- "register": one of "formal" | "neutral" | "informal" | "literary" | "technical"
- All content in British English, natural and idiomatic
- No text outside the JSON`;
}
