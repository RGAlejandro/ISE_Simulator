import type { ExamLevel } from "@/types";

// Word counts target the real Trinity spoken durations at a natural ~140 wpm
// reading pace (verified against official ISE sample listenings).
const levelConfig: Record<ExamLevel, {
  cefr: string;
  wordCount: string;
  minWords: number;
  spokenDuration: string;
  complexity: string;
  topics: string[];
  informationTypes: string[];
}> = {
  ISE_FOUNDATION: {
    cefr: "A2",
    wordCount: "150-200 words",
    minWords: 150,
    spokenDuration: "about 1 to 1.5 minutes",
    complexity: "Simple sentences, common vocabulary, present/past simple, clear structure",
    topics: ["daily routines", "hobbies", "family life", "food and shopping", "local transport"],
    informationTypes: ["likes and dislikes", "two different options", "simple advantages and disadvantages"],
  },
  ISE_I: {
    cefr: "B1",
    wordCount: "210-260 words",
    minWords: 210,
    spokenDuration: "about 1.5 to 2 minutes",
    complexity: "Moderate sentences, varied vocabulary, some opinions and comparisons",
    topics: ["school life", "technology use", "sports and fitness", "travel", "part-time jobs"],
    informationTypes: ["advantages and disadvantages", "two contrasting views", "factual comparison with numbers"],
  },
  ISE_II: {
    cefr: "B2",
    wordCount: "320-380 words",
    minWords: 320,
    spokenDuration: "about 2.5 minutes",
    complexity: "Complex structures, abstract ideas, statistics, cause and effect",
    topics: ["social media impact", "environmental issues", "urban vs rural life", "health and wellbeing", "education systems"],
    informationTypes: ["statistics and data comparison", "pros and cons with evidence", "contrasting research findings", "cause and effect relationships"],
  },
  ISE_III: {
    cefr: "C1",
    wordCount: "400-500 words",
    minWords: 400,
    spokenDuration: "about 2 minutes 45 seconds to 3 minutes",
    complexity: "Sophisticated vocabulary, nuanced arguments, academic register, implicit contrasts",
    // Official Trinity ISE III conversation/subject areas (Guide for Students).
    topics: [
      "independence", "ambitions", "stereotypes", "role models",
      "competitiveness", "young people's rights", "the media", "advertising",
      "lifestyles", "the arts", "the rights of the individual", "economic issues",
    ],
    informationTypes: ["contrasting expert opinions", "statistical trends with interpretation", "advantages vs drawbacks", "competing viewpoints"],
  },
  ISE_IV: {
    cefr: "C2",
    wordCount: "480-580 words",
    minWords: 480,
    spokenDuration: "about 3.5 to 4 minutes",
    complexity: "Near-native complexity, specialised terminology, subtle distinctions, rhetorical sophistication",
    topics: ["bioethics", "geopolitics", "philosophy of mind", "post-humanism", "epistemological debates"],
    informationTypes: ["nuanced opposing arguments", "complex statistical interplay", "academic debate with caveats", "philosophical distinctions with examples"],
  },
};

/** Minimum acceptable word count for a generated passage at this level. */
export function getListeningMinWords(level: ExamLevel): number {
  return levelConfig[level].minWords;
}

export function generateListeningPrompt(level: ExamLevel): string {
  const config = levelConfig[level];
  const topic = config.topics[Math.floor(Math.random() * config.topics.length)];
  const infoType = config.informationTypes[Math.floor(Math.random() * config.informationTypes.length)];

  return `You are creating a Trinity College London ISE ${level.replace("ISE_", "")} (CEFR ${config.cefr}) listening practice passage.

Generate a factual listening passage with these exact specifications:
- Topic area: ${topic}
- Information type: ${infoType} (this must be CLEAR and PROMINENT in the text)
- Length: ${config.wordCount} — this is a STRICT MINIMUM of ${config.minWords} words. Passages shorter than this are unusable.
- Target spoken duration: ${config.spokenDuration} when read aloud at a natural pace. Write enough content to fill that whole time.
- Language complexity: ${config.complexity}
- Style: informative, factual, suitable for academic listening comprehension
- Develop the topic fully: multiple paragraphs, several supporting points, examples and elaboration — do NOT stop early or summarise briefly.
- The passage should be clearly spoken (no complex abbreviations, numbers spelled out)

CRITICAL: The passage MUST be at least ${config.minWords} words AND contain clearly distinguishable information that a student can note down, such as:
- Specific facts, numbers, or statistics
- Named advantages AND disadvantages (at least 2 of each if that is the information type)
- Clear contrasts between two positions, approaches, or options
- Cause and effect relationships with specific examples

Return ONLY valid JSON with this exact structure:
{
  "title": "short descriptive title (max 8 words)",
  "topic": "${topic}",
  "informationType": "${infoType}",
  "passageText": "the full listening passage text here"
}

Do NOT include any text outside the JSON object.`;
}

/**
 * Model answers for both listening tasks, derived from the passage. Used in the
 * admin PDF so a teacher can see the "solution" to each task.
 */
export function modelAnswersPrompt(
  passageText: string,
  passageTitle: string,
  informationType: string
): string {
  return `You are a Trinity ISE listening examiner writing the MODEL ANSWERS (the solution) for a listening exercise, based on the passage below.

PASSAGE (title: "${passageTitle}"):
${passageText}

INFORMATION TYPE: ${informationType}

Produce the ideal answers a top candidate would give:
- Task 1 (General Summary, after first listening): a 2-3 sentence summary stating what the talk is about AND the type of information it contains (${informationType}).
- Task 2 (Detailed Notes, after second listening): the key specific points a candidate should capture — facts, numbers, named advantages/disadvantages, contrasts, cause/effect. Be concrete and faithful to the passage.

Return ONLY valid JSON:
{
  "task1ModelAnswer": "the model general summary (2-3 sentences)",
  "task2KeyPoints": ["specific point 1", "specific point 2", "... up to 10 points"]
}

Do NOT include any text outside the JSON object.`;
}

export function evaluateRound1Prompt(
  passageText: string,
  passageTitle: string,
  informationType: string,
  studentResponse: string
): string {
  return `You are evaluating a student's general comprehension response for a Trinity College London ISE listening practice exercise.

LISTENING PASSAGE (title: "${passageTitle}"):
${passageText}

INFORMATION TYPE in the passage: ${informationType}

STUDENT'S GENERAL SUMMARY (Round 1 — after first listening, no notes allowed):
"${studentResponse}"

EVALUATION CRITERIA:
- Did the student identify the main topic correctly? (not exact words — general understanding)
- Did the student identify the type of information (${informationType})? Even approximately?
- Was the response relevant and coherent?
- Score out of 10: 8-10 = good understanding, 5-7 = partial understanding, 0-4 = poor understanding

Return ONLY valid JSON:
{
  "score": number (0-10),
  "mainIdeaCaptured": boolean,
  "informationTypeIdentified": boolean,
  "comments": "2-3 sentence feedback in English — encouraging but honest",
  "missedPoints": ["list of key points the student missed or got wrong (max 3)"]
}

Do NOT include any text outside the JSON object.`;
}

export function evaluateRound2Prompt(
  passageText: string,
  passageTitle: string,
  informationType: string,
  studentNotes: string
): string {
  return `You are evaluating a student's detailed notes for a Trinity College London ISE listening practice exercise.

LISTENING PASSAGE (title: "${passageTitle}"):
${passageText}

INFORMATION TYPE: ${informationType}

STUDENT'S DETAILED NOTES (Round 2 — written notes after second listening):
"${studentNotes}"

EVALUATION CRITERIA — score out of 15:
- Accuracy (0-5): Are the facts, numbers, and details correct?
- Completeness (0-5): Did they capture the key information points (both sides if contrast/advantages-disadvantages)?
- Organisation (0-5): Are notes structured and clear (even abbreviated)?

Be strict about accuracy — wrong facts score 0 even if present.

Return ONLY valid JSON:
{
  "score": number (0-15),
  "accuracyScore": number (0-5),
  "completenessScore": number (0-5),
  "comments": "3-4 sentence feedback — specific about what was captured and what was missed",
  "capturedDetails": ["list of key details the student got correctly (max 5)"],
  "missedDetails": ["list of important details the student missed or got wrong (max 5)"]
}

Do NOT include any text outside the JSON object.`;
}
