import type { ExamLevel } from "@/types";

const levelDescriptions: Record<ExamLevel, {
  cefr: string;
  paragraphWords: string;
  textWords: string;
  topics: string[];
  subjectAreas: string[];
  complexity: string;
  writingWordLimit: { riw: { min: number; max: number }; ew: { min: number; max: number } };
  writingTypes: {
    riw: string[];
    ew: string[];
  };
}> = {
  ISE_FOUNDATION: {
    cefr: "A2",
    paragraphWords: "40-60 words per paragraph",
    textWords: "80-120 words per text",
    topics: ["daily life", "hobbies and leisure", "family and friends", "shopping", "travel and holidays"],
    subjectAreas: ["food and drink", "transport", "weather", "entertainment", "home and neighbourhood"],
    complexity: "Simple sentences, common vocabulary, present and past simple tenses",
    writingWordLimit: { riw: { min: 80, max: 100 }, ew: { min: 80, max: 100 } },
    writingTypes: {
      riw: ["informal email", "informal letter", "short message"],
      ew: ["informal email", "informal letter", "description", "short message"],
    },
  },
  ISE_I: {
    cefr: "B1",
    paragraphWords: "60-90 words per paragraph",
    textWords: "120-180 words per text",
    topics: ["education", "work and careers", "health and fitness", "environment", "media and communication"],
    subjectAreas: ["social media", "sports", "music and film", "volunteering", "traditions and customs"],
    complexity: "Some complex sentences, varied tenses, common idiomatic expressions",
    writingWordLimit: { riw: { min: 100, max: 130 }, ew: { min: 100, max: 130 } },
    writingTypes: {
      riw: ["informal email", "informal letter", "article", "description"],
      ew: ["informal email", "informal letter", "article", "review", "description"],
    },
  },
  ISE_II: {
    cefr: "B2",
    paragraphWords: "80-120 words per paragraph",
    textWords: "150-200 words per text",
    topics: ["social issues", "technology and innovation", "culture and identity", "globalisation", "environment and sustainability"],
    subjectAreas: ["ethical consumerism", "digital communication", "urban vs rural life", "equality and diversity", "tourism impact"],
    complexity: "Complex sentence structures, range of tenses, abstract topics, some academic vocabulary",
    writingWordLimit: { riw: { min: 150, max: 180 }, ew: { min: 150, max: 180 } },
    writingTypes: {
      riw: ["article", "review", "essay", "report", "formal email", "formal letter", "informal email", "informal letter"],
      ew: ["article", "review", "essay", "report", "formal email", "formal letter", "informal email", "informal letter"],
    },
  },
  ISE_III: {
    cefr: "C1",
    paragraphWords: "100-150 words per paragraph",
    textWords: "180-250 words per text",
    topics: ["economics and business", "ethics and philosophy", "science and research", "global politics", "arts and literature"],
    subjectAreas: ["artificial intelligence", "mental health", "criminal justice", "censorship", "genetic engineering"],
    complexity: "Sophisticated vocabulary, nuanced arguments, academic register, complex grammatical structures",
    writingWordLimit: { riw: { min: 200, max: 230 }, ew: { min: 200, max: 230 } },
    writingTypes: {
      riw: ["article", "essay", "report", "review", "formal letter", "formal email"],
      ew: ["article", "essay", "report", "review", "formal letter", "formal email", "proposal"],
    },
  },
  ISE_IV: {
    cefr: "C2",
    paragraphWords: "130-180 words per paragraph",
    textWords: "200-300 words per text",
    topics: ["any academic or professional topic", "philosophy of language", "geopolitics", "advanced scientific concepts", "sociolinguistics"],
    subjectAreas: ["post-humanism", "epistemology", "global governance", "bioethics", "quantum mechanics implications"],
    complexity: "Near-native complexity, subtle distinctions, specialized terminology, rhetorical sophistication",
    writingWordLimit: { riw: { min: 200, max: 230 }, ew: { min: 200, max: 230 } },
    writingTypes: {
      riw: ["article", "essay", "report", "review", "formal letter", "formal email", "proposal", "critique"],
      ew: ["article", "essay", "report", "review", "formal letter", "formal email", "proposal", "critique"],
    },
  },
};

export function getWrittenExamPrompt(level: ExamLevel): string {
  const desc = levelDescriptions[level];
  const topicChoice = desc.topics[Math.floor(Math.random() * desc.topics.length)];
  const subjectArea = desc.subjectAreas[Math.floor(Math.random() * desc.subjectAreas.length)];
  const riwType = desc.writingTypes.riw[Math.floor(Math.random() * desc.writingTypes.riw.length)];
  const ewType = desc.writingTypes.ew[Math.floor(Math.random() * desc.writingTypes.ew.length)];

  return `You are an expert exam creator for Trinity College London ISE (Integrated Skills in English) exams.
Generate a complete ISE ${level.replace("ISE_", "")} level (CEFR ${desc.cefr}) written exam in STRICT JSON format.
Language complexity: ${desc.complexity}

═══════════════════════════════════════════
TASK 1 — READING (Single long text with 5 paragraphs)
═══════════════════════════════════════════

Generate a reading about "${topicChoice}".
- The text MUST have exactly 5 numbered paragraphs
- Each paragraph: ${desc.paragraphWords}

Then generate 3 question sections:

**Questions 1-5 (Paragraph Matching — Trinity-style):**
- Provide 6 title options (A to F). Each option is a SHORT noun-phrase title (3-8 words MAX, NO full sentences, NO trailing period).
- Examples of valid titles: "The birth of advertising", "The power of words", "The impact of television", "A deep-rooted shift in advertising culture".
- INVALID: full sentences, explanations, statements with subjects + verbs ("Advertising became more visual in the 1900s." ← too long).
- 5 of them are the BEST title for paragraphs 1-5. 1 is a DISTRACTOR (does not match any paragraph).
- The candidate must match each paragraph (1-5) to the correct title (A-F).

**Questions 6-10 (Statement Selection):**
- Provide 8 statements (A to H) related to the text.
- Exactly 5 are TRUE according to the text, and 3 are FALSE.
- The candidate must select the 5 correct statements.

**Questions 11-15 (Gap Fill):**
- Provide 5 sentences with a gap (shown as _______).
- Each answer is 1-3 words that appear in or can be directly inferred from the reading text.

═══════════════════════════════════════════
TASK 2 — READING (4 shorter texts: blogs, forums, chart)
═══════════════════════════════════════════

Generate 4 texts on the topic "${subjectArea}":
- Text A: Blog post (${desc.textWords})
- Text B: Forum post/comment (${desc.textWords})  
- Text C: A short article (${desc.textWords})
- Text D: Description of a graph/chart with data (include graphData array with label+value pairs for rendering)

Then generate 3 question sections:

**Questions 16-20 (Text Matching):**
- 5 statements. The candidate matches each to the text it relates to (A, B, C, or D).
- Since there are 5 questions but only 4 texts, one letter MUST be used twice.

**Questions 21-25 (Statement Selection):**
- Same format as Questions 6-10: 8 statements (A-H), 5 correct, 3 false.

**Questions 26-30 (Gap Fill — Trinity "Notes" style):**
- The 5 questions form a STRUCTURED NOTES sheet (not a flat list).
- Provide a "notesTitle" for the overall topic (e.g., "Technology in homes", "Climate change", "Modern education").
- Group the 5 questions into 2-3 sections using "sectionHeading" (e.g., "Past" / "Now" / "Future", or "Causes" / "Effects" / "Solutions", or "Advantages" / "Disadvantages"). Each consecutive question with the same heading belongs to that group.
- Each question is a sentence with _______ for the gap.
- Answers must be exact words/phrases (max 3 words) from texts A–D.

═══════════════════════════════════════════
TASKS 3 & 4 — WRITING
═══════════════════════════════════════════

**Task 3 (Reading into Writing):** Write a **${riwType}** that requires the candidate to synthesise information from READING 2 ONLY (the four short texts A–D from Task 2).
DO NOT reference Reading 1 (the Long Reading text). Task 3 ALWAYS uses the multi-text reading (texts A–D) as its source material.
The task prompt MUST clearly state the writing type (e.g. "Write an ${riwType}...") and MUST instruct the candidate to use information from texts A–D.
Word limit: ${desc.writingWordLimit.riw.min}-${desc.writingWordLimit.riw.max} words.

**Task 4 (Extended Writing):** Write a **${ewType}** on an independent topic related to the exam theme.
The task prompt MUST clearly state the writing type (e.g. "Write a ${ewType}...").
Word limit: ${desc.writingWordLimit.ew.min}-${desc.writingWordLimit.ew.max} words.

IMPORTANT: The writing type affects tone and format. For formal letters/emails, include appropriate opening/closing. For reports, include headings. For articles, include a catchy title. For essays, require a clear thesis. For reviews, ask for opinions and recommendations.

═══════════════════════════════════════════
OUTPUT JSON SCHEMA (follow EXACTLY):
═══════════════════════════════════════════

{
  "level": "${level}",
  "reading1": {
    "title": "string",
    "paragraphs": [
      { "number": 1, "text": "paragraph text..." },
      { "number": 2, "text": "paragraph text..." },
      { "number": 3, "text": "paragraph text..." },
      { "number": 4, "text": "paragraph text..." },
      { "number": 5, "text": "paragraph text..." }
    ],
    "paragraphMatching": {
      "type": "paragraph_matching",
      "instructions": "Match each paragraph (1-5) to the correct summary (A-F). One option is extra.",
      "options": [
        { "letter": "A", "summary": "..." },
        { "letter": "B", "summary": "..." },
        { "letter": "C", "summary": "..." },
        { "letter": "D", "summary": "..." },
        { "letter": "E", "summary": "..." },
        { "letter": "F", "summary": "..." }
      ],
      "correctAnswers": ["B", "E", "A", "F", "C"]
    },
    "statementSelection": {
      "type": "statement_selection",
      "instructions": "Choose the 5 statements (from A-H) that are TRUE according to the text.",
      "statements": [
        { "letter": "A", "text": "..." },
        { "letter": "B", "text": "..." },
        { "letter": "C", "text": "..." },
        { "letter": "D", "text": "..." },
        { "letter": "E", "text": "..." },
        { "letter": "F", "text": "..." },
        { "letter": "G", "text": "..." },
        { "letter": "H", "text": "..." }
      ],
      "correctAnswers": ["A", "C", "D", "F", "H"]
    },
    "gapFill": {
      "type": "gap_fill",
      "instructions": "Complete each sentence with 1-3 words from the text.",
      "questions": [
        { "id": "r1_gf1", "sentence": "The author argues that _______ is essential.", "correctAnswer": "critical thinking" },
        { "id": "r1_gf2", "sentence": "...", "correctAnswer": "..." },
        { "id": "r1_gf3", "sentence": "...", "correctAnswer": "..." },
        { "id": "r1_gf4", "sentence": "...", "correctAnswer": "..." },
        { "id": "r1_gf5", "sentence": "...", "correctAnswer": "..." }
      ]
    }
  },
  "reading2": {
    "title": "string",
    "topic": "${subjectArea}",
    "texts": [
      { "letter": "A", "title": "...", "author": "User123", "source": "Blog", "content": "...", "isGraph": false },
      { "letter": "B", "title": "...", "author": "ForumUser", "source": "Forum post", "content": "...", "isGraph": false },
      { "letter": "C", "title": "...", "source": "Article", "content": "...", "isGraph": false },
      { "letter": "D", "title": "...", "source": "Graph/Chart", "content": "Description of what the graph shows...", "isGraph": true, "graphData": [{"label": "2020", "value": 45}, {"label": "2021", "value": 52}, {"label": "2022", "value": 61}, {"label": "2023", "value": 73}] }
    ],
    "textMatching": {
      "type": "text_matching",
      "instructions": "Match each statement (16-20) to the text it refers to (A, B, C, or D). One letter will be used twice.",
      "questions": [
        { "id": "r2_tm1", "statement": "..." },
        { "id": "r2_tm2", "statement": "..." },
        { "id": "r2_tm3", "statement": "..." },
        { "id": "r2_tm4", "statement": "..." },
        { "id": "r2_tm5", "statement": "..." }
      ],
      "correctAnswers": ["A", "C", "B", "D", "A"]
    },
    "statementSelection": {
      "type": "statement_selection",
      "instructions": "Choose the 5 statements (from A-H) that are TRUE according to the texts.",
      "statements": [
        { "letter": "A", "text": "..." },
        { "letter": "B", "text": "..." },
        { "letter": "C", "text": "..." },
        { "letter": "D", "text": "..." },
        { "letter": "E", "text": "..." },
        { "letter": "F", "text": "..." },
        { "letter": "G", "text": "..." },
        { "letter": "H", "text": "..." }
      ],
      "correctAnswers": ["B", "C", "E", "F", "G"]
    },
    "gapFill": {
      "type": "gap_fill",
      "instructions": "Complete each sentence with 1-3 words from the texts.",
      "notesTitle": "Overall topic title for the notes (e.g. 'Technology in homes')",
      "questions": [
        { "id": "r2_gf1", "sentence": "Inventions like _______ helped complete domestic tasks.", "correctAnswer": "...", "sectionHeading": "Past" },
        { "id": "r2_gf2", "sentence": "...", "correctAnswer": "...", "sectionHeading": "Past" },
        { "id": "r2_gf3", "sentence": "...", "correctAnswer": "...", "sectionHeading": "Now" },
        { "id": "r2_gf4", "sentence": "...", "correctAnswer": "...", "sectionHeading": "Now" },
        { "id": "r2_gf5", "sentence": "...", "correctAnswer": "...", "sectionHeading": "Future" }
      ]
    }
  },
  "readingIntoWriting": {
    "title": "string",
    "writingType": "${riwType}",
    "prompt": "detailed writing instructions clearly stating to write a ${riwType}, referencing texts A–D from Task 2 (Multi-text reading) ONLY — do NOT mention or reference Reading 1 (the Long Reading text)",
    "wordLimit": { "min": ${desc.writingWordLimit.riw.min}, "max": ${desc.writingWordLimit.riw.max} },
    "bulletPoints": ["point 1", "point 2", "point 3"]
  },
  "extendedWriting": {
    "title": "string",
    "writingType": "${ewType}",
    "prompt": "detailed writing instructions clearly stating to write a ${ewType}",
    "wordLimit": { "min": ${desc.writingWordLimit.ew.min}, "max": ${desc.writingWordLimit.ew.max} },
    "bulletPoints": ["point 1", "point 2", "point 3"]
  }
}

CRITICAL RULES:
- Return ONLY valid JSON. No markdown, no backticks, no explanation.
- All content must be ORIGINAL. Do NOT copy from real Trinity exams.
- Paragraph matching must have EXACTLY 6 options (A-F) with 5 correct and 1 distractor.
- Statement selection must have EXACTLY 8 statements (A-H) with exactly 5 correct.
- Gap fill answers must be 1-3 words that appear in or are directly derivable from the text.
- Text D in reading 2 MUST have isGraph: true and a graphData array.
- Text matching for Q16-20 must repeat exactly one letter since 5 questions map to 4 texts.
- All IDs must be unique.`;
}

export function getEvaluateWritingPrompt(level: ExamLevel, taskType: string, prompt: string, response: string): string {
  const desc = levelDescriptions[level];

  return `You are a senior Trinity ISE examiner evaluating a ${desc.cefr} level writing response.

TASK TYPE: ${taskType}
TASK PROMPT: ${prompt}

CANDIDATE'S RESPONSE:
${response}

Evaluate this response using the official ISE marking criteria. Be fair but rigorous.

Score each area from 0-5 where:
0 = No evidence
1 = Very limited
2 = Limited
3 = Adequate
4 = Good
5 = Excellent

Consider the expected level is ${desc.cefr}. A score of 3 means meeting the standard for this level.

OUTPUT FORMAT (strict JSON):
{
  "score": number (overall 0-20),
  "band": "Distinction" | "Merit" | "Pass" | "Fail",
  "taskFulfillment": {
    "score": number (0-5),
    "comments": "string (specific feedback on how well the task was addressed)"
  },
  "grammar": {
    "score": number (0-5),
    "comments": "string (specific grammar feedback with examples from the text)"
  },
  "vocabulary": {
    "score": number (0-5),
    "comments": "string (specific vocabulary feedback with suggestions)"
  },
  "organization": {
    "score": number (0-5),
    "comments": "string (feedback on structure, coherence, cohesion)"
  },
  "suggestions": [
    "string (actionable improvement suggestion 1)",
    "string (actionable improvement suggestion 2)",
    "string (actionable improvement suggestion 3)"
  ]
}

Return ONLY the JSON object.`;
}
