import type { ExamLevel } from "@/types";

// ═══════════════════════════════════════════════════════════════════════════════
// TRINITY ISE EXAM SPECIFICATIONS PER LEVEL
// Based on official Trinity College London ISE Reading & Writing exam format.
//
// Each level defines: CEFR mapping, reading text lengths, topic pools,
// language complexity requirements, question difficulty, and writing specs.
// ═══════════════════════════════════════════════════════════════════════════════

interface LevelSpec {
  cefr: string;
  examDuration: number; // minutes

  // ── Task 1: Long Reading (5 paragraphs) ──
  task1: {
    totalWords: string;
    wordsPerParagraph: string;
    minSentences: number; // minimum sentences per paragraph
    contentDepth: string; // guidance on how deep the content should be
  };

  // ── Task 2: Multi-text Reading (4 texts) ──
  task2: {
    wordsPerText: string;
    minSentences: number; // minimum sentences per text (A, B, C)
    graphMinWords: number; // minimum words for text D description
    textRegister: string; // style/register guidance
  };

  // ── Topics & Subject Areas ──
  topics: string[];
  subjectAreas: string[];

  // ── Language Complexity ──
  complexity: string;
  vocabularyBand: string;
  grammarFocus: string;
  textRegister: string;

  // ── Question Quality ──
  questionGuidance: string;

  // ── Writing Tasks ──
  writingWordLimit: { riw: { min: number; max: number }; ew: { min: number; max: number } };
  writingTypes: { riw: string[]; ew: string[] };
}

const levelSpecs: Record<ExamLevel, LevelSpec> = {
  // ─────────────────────────────────────────────────────────────────────────
  // ISE FOUNDATION — CEFR A2 (Elementary)
  // ─────────────────────────────────────────────────────────────────────────
  ISE_FOUNDATION: {
    cefr: "A2",
    examDuration: 60,
    task1: {
      totalWords: "200-300 words total",
      wordsPerParagraph: "40-60 words",
      minSentences: 3,
      contentDepth: "Simple factual descriptions using everyday language. Each paragraph covers one clear, concrete idea with short, direct sentences. No abstract concepts. Use familiar, real-world examples (daily routines, common places, simple descriptions of people or events).",
    },
    task2: {
      wordsPerText: "50-80 words",
      minSentences: 3,
      graphMinWords: 30,
      textRegister: "Very informal, conversational. Use simple everyday language as if written by a young person or casual blogger. Short sentences, simple connectors (and, but, because, so).",
    },
    topics: [
      "daily life and routines", "hobbies and free time", "family and friends",
      "shopping and money", "travel and holidays", "food and eating out",
      "school and learning", "my town or city", "sports and games",
      "animals and pets", "celebrations and festivals", "clothes and fashion",
    ],
    subjectAreas: [
      "food and drink", "transport and getting around", "weather and seasons",
      "entertainment and TV", "home and neighbourhood", "parks and outdoor spaces",
      "music and singing", "birthdays and parties", "weekend activities",
      "favourite places", "pocket money and saving", "school subjects",
    ],
    complexity: "Simple sentences only. Present simple, past simple, 'going to' future. High-frequency vocabulary (most common 1,500 words). No idioms, no phrasal verbs, no complex connectors.",
    vocabularyBand: "A1-A2 core vocabulary. Words like: interesting, important, favourite, usually, sometimes, because, different, popular, enjoy, prefer.",
    grammarFocus: "Present simple, past simple, 'going to' for future, basic modals (can, must), comparatives/superlatives (bigger, the best), simple connectors (and, but, because, so, then).",
    textRegister: "Informal, friendly, personal tone. Written as if for a school project or a message to a friend.",
    questionGuidance: "Questions should test basic comprehension. True statements should be clearly supported by the text. False statements should be obviously wrong (contradicted by the text). Gap fill answers should be single common words.",
    writingWordLimit: { riw: { min: 80, max: 100 }, ew: { min: 80, max: 100 } },
    writingTypes: {
      riw: ["informal email", "informal letter", "short message"],
      ew: ["informal email", "informal letter", "description", "short message"],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ISE I — CEFR B1 (Intermediate)
  // ─────────────────────────────────────────────────────────────────────────
  ISE_I: {
    cefr: "B1",
    examDuration: 120,
    task1: {
      totalWords: "300-450 words total",
      wordsPerParagraph: "60-90 words",
      minSentences: 4,
      contentDepth: "Clear factual text with some opinion or explanation. Each paragraph develops one main idea with supporting detail and at least one example. Mix simple and compound sentences. The text should be informative and accessible to an intermediate reader.",
    },
    task2: {
      wordsPerText: "80-120 words",
      minSentences: 4,
      graphMinWords: 40,
      textRegister: "Mix of informal and semi-formal. Blogs and forum posts should sound natural and personal. The article should be slightly more formal. Use varied connectors (however, although, for example, in addition).",
    },
    topics: [
      "education and studying", "work and future careers", "health and fitness",
      "the environment", "media and social media", "travel and tourism",
      "technology in daily life", "music and entertainment", "money and budgets",
      "friendship and relationships", "volunteering and community", "food and healthy eating",
    ],
    subjectAreas: [
      "social media and online life", "sports and competition", "music and film",
      "volunteering and charity", "traditions and customs", "studying abroad",
      "recycling and waste", "online shopping", "keeping fit",
      "pocket money and part-time jobs", "festivals around the world", "learning languages",
    ],
    complexity: "Mix of simple and compound sentences. Some complex sentences with 'although', 'while', 'if'. Intermediate vocabulary with common collocations. Occasional idiomatic expressions. Text should be clear but not oversimplified.",
    vocabularyBand: "B1 intermediate vocabulary. Words like: advantage, disadvantage, opportunity, experience, recommend, improve, contribute, participate, benefit, significant, effective, influence.",
    grammarFocus: "Present perfect, past continuous, first conditional (if + present, will), passive voice (simple), relative clauses (who, which, that), modals of advice/obligation (should, have to, need to), comparisons, linking words (however, although, therefore, for example).",
    textRegister: "Semi-formal to informal. Accessible and engaging. The text should feel like a well-written magazine article or educational blog post.",
    questionGuidance: "Questions test understanding of main ideas and some detail. False statements should be plausible but subtly wrong (twisted facts, wrong attribution). Gap fill answers can be 1-2 words, testing specific vocabulary from the text.",
    writingWordLimit: { riw: { min: 100, max: 130 }, ew: { min: 100, max: 130 } },
    writingTypes: {
      riw: ["informal email", "informal letter", "article", "description"],
      ew: ["informal email", "informal letter", "article", "review", "description"],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ISE II — CEFR B2 (Upper-Intermediate)
  // ─────────────────────────────────────────────────────────────────────────
  ISE_II: {
    cefr: "B2",
    examDuration: 120,
    task1: {
      totalWords: "400-550 words total",
      wordsPerParagraph: "80-110 words",
      minSentences: 5,
      contentDepth: "Detailed, well-developed text that presents different perspectives on a topic. Each paragraph should have a clear topic sentence, supporting evidence or examples, and a concluding thought. Include some cause-and-effect reasoning, comparisons, or contrasting viewpoints. The text should challenge an upper-intermediate reader with some abstract ideas.",
    },
    task2: {
      wordsPerText: "100-160 words",
      minSentences: 5,
      graphMinWords: 50,
      textRegister: "Varied registers: Blog (semi-formal, opinionated), Forum post (personal experience, conversational), Article (formal, objective), Graph (data-driven, analytical). Each text should feel authentic to its format.",
    },
    topics: [
      "social issues and inequality", "technology and innovation", "culture and identity",
      "globalisation and its effects", "environment and sustainability", "media influence and fake news",
      "urbanisation and city life", "work-life balance", "education reform",
      "immigration and multiculturalism", "consumer culture", "mental health and wellbeing",
    ],
    subjectAreas: [
      "ethical consumerism", "digital communication", "urban vs rural life",
      "equality and diversity", "tourism impact on local communities", "renewable energy",
      "fast fashion and sustainability", "online privacy", "youth unemployment",
      "cultural heritage preservation", "food waste", "remote working",
    ],
    complexity: "Complex sentence structures with subordination (although, despite, whereas, provided that). Abstract topics discussed with nuance. Some academic vocabulary. Arguments should present multiple sides. Include cause-effect, comparison, and conditional reasoning.",
    vocabularyBand: "B2 upper-intermediate vocabulary. Words like: controversy, perspective, consequence, sustainable, infrastructure, innovation, discriminate, predominantly, whereas, substantial, implement, advocate, furthermore, underlying.",
    grammarFocus: "Mixed conditionals, reported speech, passive constructions (complex), relative clauses (defining/non-defining), inversion for emphasis, wish/if only, modals of speculation (might have, could have), cleft sentences (It is X that...), discourse markers (nevertheless, on the other hand, in contrast).",
    textRegister: "Semi-formal to formal. Academic but accessible. The text should feel like a quality newspaper article, a university textbook excerpt, or a well-researched blog post.",
    questionGuidance: "Questions require inference and careful reading. False statements should be cleverly constructed — plausible and related to the text but with subtle inaccuracies (wrong degree, overgeneralisations, reversed cause-effect). Gap fill answers should test specific vocabulary or phrases, including 2-word answers.",
    writingWordLimit: { riw: { min: 150, max: 180 }, ew: { min: 150, max: 180 } },
    writingTypes: {
      riw: ["article", "review", "essay", "report", "formal email", "formal letter", "informal email", "informal letter"],
      ew: ["article", "review", "essay", "report", "formal email", "formal letter", "informal email", "informal letter"],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ISE III — CEFR C1 (Advanced)
  // ─────────────────────────────────────────────────────────────────────────
  ISE_III: {
    cefr: "C1",
    examDuration: 120,
    task1: {
      totalWords: "500-700 words total",
      wordsPerParagraph: "100-140 words",
      minSentences: 5,
      contentDepth: "Dense, academic-quality text that develops a sophisticated argument. Each paragraph must present a clear thesis point with evidence, analysis, and nuance. Include expert references ('researchers suggest...', 'studies indicate...'), counterarguments, cause-effect chains, and evaluative commentary. The text should challenge an advanced reader and require careful reading to distinguish between similar ideas. Avoid superficial treatment — each paragraph should say something substantive that cannot be summarised in a single sentence.",
    },
    task2: {
      wordsPerText: "120-200 words",
      minSentences: 5,
      graphMinWords: 60,
      textRegister: "Distinctly varied registers to test register awareness: Blog (informed opinion with personal stance and some informal markers), Forum post (personal experience with anecdotal evidence, slightly informal but thoughtful), Article (formal journalistic or academic tone, objective analysis), Graph/Chart (analytical description with data interpretation and trends). Each text should have enough depth to support multiple comprehension questions.",
    },
    topics: [
      "economics and global markets", "ethics and moral philosophy", "science and technological research",
      "global politics and diplomacy", "arts, literature and cultural criticism", "law and justice systems",
      "psychology and human behaviour", "media ethics and press freedom", "education policy and reform",
      "public health and medical ethics", "urbanisation and smart cities", "energy policy and climate action",
      "artificial intelligence and society", "international development", "linguistic diversity and language policy",
    ],
    subjectAreas: [
      "artificial intelligence and automation", "mental health in modern society", "criminal justice reform",
      "censorship and freedom of expression", "genetic engineering and bioethics", "sustainable development goals",
      "wealth inequality and social mobility", "digital surveillance and privacy", "migration and refugee policy",
      "space exploration and investment", "pharmaceutical industry ethics", "cultural appropriation vs appreciation",
      "deforestation and biodiversity loss", "nuclear energy debate", "social media regulation",
    ],
    complexity: "Sophisticated, academic prose. Long complex sentences with multiple clauses. Hedging language (tends to, it could be argued that, arguably). Formal cohesive devices (notwithstanding, furthermore, in light of, consequently). Abstract concepts discussed with precision. The text must feel like it belongs in a quality broadsheet newspaper, an academic journal, or a university lecture.",
    vocabularyBand: "C1 advanced vocabulary. Words like: paradigm, unprecedented, intrinsic, exacerbate, proliferation, dichotomy, juxtaposition, ramification, contentious, pragmatic, epistemological, commodification, stratification, nuanced, multifaceted, concomitant, pervasive, mitigate, reconcile, underpin.",
    grammarFocus: "Inversion (Not only... but also, Rarely do..., Had it not been for...), cleft sentences, nominalisation (the proliferation of X rather than X has proliferated), complex passive (is said to have been), subjunctive (It is essential that X be...), participle clauses (Having considered..., Given the evidence...), ellipsis, advanced conditionals (Were it not for..., Should this prove true...), hedging (appears to, is likely to, it has been suggested that).",
    textRegister: "Formal academic register. Dense but clear prose. The writing style should resemble The Economist, The Guardian long-reads, or university-level textbooks.",
    questionGuidance: "Questions demand close reading, inference, and the ability to distinguish nuance. FALSE statements must be sophisticated distractors — paraphrasing the text but subtly distorting meaning (e.g., overstating a claim, confusing correlation with causation, attributing an idea to the wrong source). Gap fill answers should test precise vocabulary and collocations, including 2-3 word phrases.",
    writingWordLimit: { riw: { min: 200, max: 230 }, ew: { min: 200, max: 230 } },
    writingTypes: {
      riw: ["article", "essay", "report", "review", "formal letter", "formal email"],
      ew: ["article", "essay", "report", "review", "formal letter", "formal email", "proposal"],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ISE IV — CEFR C2 (Proficiency / Mastery)
  // ─────────────────────────────────────────────────────────────────────────
  ISE_IV: {
    cefr: "C2",
    examDuration: 120,
    task1: {
      totalWords: "600-900 words total",
      wordsPerParagraph: "120-180 words",
      minSentences: 6,
      contentDepth: "Highly dense, scholarly-quality text suitable for a near-native reader. Each paragraph must develop a complex argument with multiple layers of reasoning, evidence, and critical evaluation. Include references to theoretical frameworks, scholarly debate, historical context, and forward-looking analysis. Use rhetorical devices (irony, understatement, rhetorical questions). The text should require multiple readings to fully appreciate the nuances and implicit arguments.",
    },
    task2: {
      wordsPerText: "150-250 words",
      minSentences: 6,
      graphMinWords: 80,
      textRegister: "Highly varied and sophisticated registers: Blog (expert opinion piece with rhetorical sophistication), Forum (thoughtful academic discussion with nuanced personal experience), Article (scholarly or investigative journalism with depth), Graph (expert analytical interpretation with trend analysis, projections, and implications). Each text must be substantive enough for deep comprehension questions.",
    },
    topics: [
      "philosophy of language and meaning", "geopolitics and power dynamics",
      "advanced scientific research and ethics", "sociolinguistics and language change",
      "epistemology and the nature of knowledge", "post-colonial studies",
      "economic theory and market failures", "constitutional law and human rights",
      "cognitive science and consciousness", "environmental philosophy",
      "historiography and the writing of history", "aesthetics and art theory",
      "political philosophy and governance", "anthropology and cultural evolution",
      "mathematics and its philosophical foundations",
    ],
    subjectAreas: [
      "post-humanism and transhumanism", "epistemology and scientific method",
      "global governance and sovereignty", "bioethics and gene editing",
      "quantum mechanics and its implications", "artificial general intelligence",
      "neuroethics and brain-computer interfaces", "degrowth economics",
      "linguistic relativity and the Sapir-Whorf hypothesis", "restorative justice",
      "posthumous rights and digital legacy", "the ethics of autonomous weapons",
      "deep-sea mining and environmental law", "the philosophy of time",
      "information asymmetry in democratic systems",
    ],
    complexity: "Near-native complexity. Elegant, precise prose with subtle distinctions and implicit meaning. Rhetorical sophistication (understatement, litotes, irony). Specialised terminology used naturally. Dense argumentation requiring inference. The text should be indistinguishable from a published academic article or quality intellectual journalism.",
    vocabularyBand: "C2 proficiency vocabulary. Words like: epistemological, ontological, hegemony, intersubjectivity, apotheosis, antithetical, reification, hermeneutic, dialectical, semiotic, teleological, axiological, neoliberal, posthumous, liminal, praxis, symbiotic, incommensurable, heuristic, phenomenological.",
    grammarFocus: "Full mastery of all structures used flexibly and naturally. Fronting for emphasis, complex nominalisations, garden-path sentences resolved through context, subjunctive in all forms, multiple embedding (The fact that what had been assumed to be... turned out to...), rhetorical inversion, elegant use of the passive for impersonal academic style, discourse-level cohesion across paragraphs.",
    textRegister: "Formal scholarly register. The prose should read like The London Review of Books, Foreign Affairs, or Nature. Authoritative, nuanced, and intellectually demanding.",
    questionGuidance: "Questions test sophisticated reading skills: identifying implicit arguments, distinguishing between what is stated and what is implied, recognising rhetorical strategies, and evaluating the strength of evidence. FALSE statements should be near-paraphrases with one critical distortion (shifted emphasis, false equivalence, straw man). Gap fill answers should test precise academic collocations and technical phrases.",
    writingWordLimit: { riw: { min: 200, max: 230 }, ew: { min: 200, max: 230 } },
    writingTypes: {
      riw: ["article", "essay", "report", "review", "formal letter", "formal email", "proposal", "critique"],
      ew: ["article", "essay", "report", "review", "formal letter", "formal email", "proposal", "critique"],
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS (two-step generation to avoid token limits)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Step 1: Generate only the reading texts (no questions, no writing tasks).
 * Keeps the prompt+output well within provider token limits.
 */
export function getReadingTextsPrompt(level: ExamLevel): string {
  const spec = levelSpecs[level];
  const topicChoice = spec.topics[Math.floor(Math.random() * spec.topics.length)];
  const subjectArea = spec.subjectAreas[Math.floor(Math.random() * spec.subjectAreas.length)];

  return `You are an expert exam writer for Trinity College London ISE ${level.replace("ISE_", "")} (CEFR ${spec.cefr}).
Generate TWO reading texts for an ISE exam. Return ONLY valid JSON — no markdown, no explanation.

LANGUAGE LEVEL ${spec.cefr}:
- Complexity: ${spec.complexity}
- Vocabulary: ${spec.vocabularyBand}
- Grammar: ${spec.grammarFocus}
- Register: ${spec.textRegister}

TEXT 1 — Long Reading — Topic: "${topicChoice}"
Write a ${spec.task1.totalWords} passage divided into exactly 5 paragraphs.
Each paragraph MUST be ${spec.task1.wordsPerParagraph} words and contain at least ${spec.task1.minSentences} sentences.
${spec.task1.contentDepth}
Structure: Para 1 = introduction/context; Para 2 = first argument with evidence; Para 3 = contrasting or complementary perspective; Para 4 = implications or in-depth case study; Para 5 = synthesis and forward look.

TEXT 2 — Multi-text Reading — Topic: "${subjectArea}"
Write 4 texts, each covering a different aspect of the topic:
- Text A (Blog post): personal opinion with author name. ${spec.task2.wordsPerText} words. Opinions and personal examples.
- Text B (Forum post): online discussion reply. ${spec.task2.wordsPerText} words. Personal experience, conversational.
- Text C (Article): formal newspaper/website article. ${spec.task2.wordsPerText} words. Objective, with data or expert references.
- Text D (Graph/Chart): analytical description ${spec.task2.graphMinWords}+ words explaining trends and specific numbers, PLUS a graphData array with at least 4 data points.
Register: ${spec.task2.textRegister}

MANDATORY: Every paragraph must reach ${spec.task1.wordsPerParagraph} words. Every text (A/B/C) must reach ${spec.task2.wordsPerText} words. Do NOT truncate or shorten any text.

Return exactly this JSON structure:
{
  "reading1": {
    "title": "string",
    "paragraphs": [
      {"number": 1, "text": "string"},
      {"number": 2, "text": "string"},
      {"number": 3, "text": "string"},
      {"number": 4, "text": "string"},
      {"number": 5, "text": "string"}
    ]
  },
  "reading2": {
    "title": "string",
    "topic": "${subjectArea}",
    "texts": [
      {"letter": "A", "title": "string", "author": "string", "source": "Blog", "content": "string", "isGraph": false},
      {"letter": "B", "title": "string", "author": "string", "source": "Forum post", "content": "string", "isGraph": false},
      {"letter": "C", "title": "string", "source": "Article", "content": "string", "isGraph": false},
      {"letter": "D", "title": "string", "source": "Graph/Chart", "content": "string", "isGraph": true, "graphData": [{"label": "string", "value": 0}]}
    ]
  }
}`;
}

// ── Types for Step 2 ──────────────────────────────────────────────────────────
interface Reading1Result {
  title: string;
  paragraphs: Array<{ number: number; text: string }>;
}
interface Reading2Result {
  title: string;
  topic: string;
  texts: Array<{ letter: string; title?: string; author?: string; source: string; content: string; isGraph: boolean }>;
}

/**
 * Step 2: Given the actual reading texts, generate all questions + writing tasks.
 * Including the real texts ensures questions are grounded in the generated content.
 */
export function getQuestionsPrompt(
  level: ExamLevel,
  reading1: Reading1Result,
  reading2: Reading2Result
): string {
  const spec = levelSpecs[level];
  const riwType = spec.writingTypes.riw[Math.floor(Math.random() * spec.writingTypes.riw.length)];
  const ewType = spec.writingTypes.ew[Math.floor(Math.random() * spec.writingTypes.ew.length)];

  const paragraphsText = reading1.paragraphs
    .map((p) => `[Paragraph ${p.number}]\n${p.text}`)
    .join("\n\n");
  const textsContent = reading2.texts
    .map((t) => `[Text ${t.letter} — ${t.source}]\n${t.content}`)
    .join("\n\n");

  return `You are an ISE exam question writer for Trinity College London ISE ${level.replace("ISE_", "")} (CEFR ${spec.cefr}).
Using the reading texts below, generate all exam questions and writing task prompts. Return ONLY valid JSON.

═══ READING 1: ${reading1.title} ═══
${paragraphsText}

═══ READING 2: ${reading2.title} (Topic: ${reading2.topic}) ═══
${textsContent}

═══ GENERATE THE FOLLOWING: ═══

READING 1 QUESTIONS:
1. Paragraph Matching (Q1-5): Provide 6 options (A-F). Each option is a SHORT noun phrase (3-8 words, NO full sentences, NO verbs). 5 options match the 5 paragraphs; 1 is a plausible distractor. ${spec.questionGuidance}
2. Statement Selection (Q6-10): 8 statements (A-H) about Reading 1. Exactly 5 TRUE + 3 FALSE. FALSE statements must be plausible but subtly wrong (distorted facts, wrong attribution, overgeneralisation).
3. Gap Fill (Q11-15): 5 sentences with a _______ gap. Each answer = 1-3 words taken VERBATIM from Reading 1. Cover different paragraphs.

READING 2 QUESTIONS:
4. Text Matching (Q16-20): 5 statements, each matched to Text A, B, C, or D. Exactly one letter must appear twice.
5. Statement Selection (Q21-25): 8 statements (A-H) about all four texts. Exactly 5 TRUE + 3 FALSE. Cover all texts.
6. Gap Fill — Notes style (Q26-30): 5 sentences with _______ gaps forming structured notes. Include notesTitle and a sectionHeading per question (use 2-3 section groups). Answers = 1-3 words verbatim from texts A-D.

WRITING TASKS:
7. Task 3 (Reading into Writing): A ${riwType} prompt (${spec.writingWordLimit.riw.min}-${spec.writingWordLimit.riw.max} words) asking the candidate to synthesise ideas from texts A-D ONLY. Include 3 bullet points. The prompt MUST instruct the candidate to use the texts.
8. Task 4 (Extended Writing): A COMPLETELY INDEPENDENT ${ewType} prompt (${spec.writingWordLimit.ew.min}-${spec.writingWordLimit.ew.max} words) on a topic related to the general theme. NEVER mention texts, readings, or any previous task. The candidate writes entirely from their own knowledge. Include 3 bullet points.

Return exactly this JSON:
{
  "reading1Questions": {
    "paragraphMatching": {
      "type": "paragraph_matching",
      "instructions": "Match each paragraph (1-5) to the correct summary (A-F). One option is extra.",
      "options": [
        {"letter": "A", "summary": "string"},
        {"letter": "B", "summary": "string"},
        {"letter": "C", "summary": "string"},
        {"letter": "D", "summary": "string"},
        {"letter": "E", "summary": "string"},
        {"letter": "F", "summary": "string"}
      ],
      "correctAnswers": ["B", "E", "A", "F", "C"]
    },
    "statementSelection": {
      "type": "statement_selection",
      "instructions": "Choose the 5 statements (A-H) that are TRUE according to the text.",
      "statements": [
        {"letter": "A", "text": "string"},
        {"letter": "B", "text": "string"},
        {"letter": "C", "text": "string"},
        {"letter": "D", "text": "string"},
        {"letter": "E", "text": "string"},
        {"letter": "F", "text": "string"},
        {"letter": "G", "text": "string"},
        {"letter": "H", "text": "string"}
      ],
      "correctAnswers": ["A", "C", "D", "F", "H"]
    },
    "gapFill": {
      "type": "gap_fill",
      "instructions": "Complete each sentence with 1-3 words from the text.",
      "questions": [
        {"id": "r1_gf1", "sentence": "..._______...", "correctAnswer": "string"},
        {"id": "r1_gf2", "sentence": "..._______...", "correctAnswer": "string"},
        {"id": "r1_gf3", "sentence": "..._______...", "correctAnswer": "string"},
        {"id": "r1_gf4", "sentence": "..._______...", "correctAnswer": "string"},
        {"id": "r1_gf5", "sentence": "..._______...", "correctAnswer": "string"}
      ]
    }
  },
  "reading2Questions": {
    "textMatching": {
      "type": "text_matching",
      "instructions": "Match each statement (16-20) to the text it refers to (A, B, C, or D). One letter is used twice.",
      "questions": [
        {"id": "r2_tm1", "statement": "string"},
        {"id": "r2_tm2", "statement": "string"},
        {"id": "r2_tm3", "statement": "string"},
        {"id": "r2_tm4", "statement": "string"},
        {"id": "r2_tm5", "statement": "string"}
      ],
      "correctAnswers": ["A", "C", "B", "D", "A"]
    },
    "statementSelection": {
      "type": "statement_selection",
      "instructions": "Choose the 5 statements (A-H) that are TRUE according to the texts.",
      "statements": [
        {"letter": "A", "text": "string"},
        {"letter": "B", "text": "string"},
        {"letter": "C", "text": "string"},
        {"letter": "D", "text": "string"},
        {"letter": "E", "text": "string"},
        {"letter": "F", "text": "string"},
        {"letter": "G", "text": "string"},
        {"letter": "H", "text": "string"}
      ],
      "correctAnswers": ["B", "C", "E", "F", "G"]
    },
    "gapFill": {
      "type": "gap_fill",
      "instructions": "Complete each sentence with 1-3 words from the texts.",
      "notesTitle": "string",
      "questions": [
        {"id": "r2_gf1", "sentence": "..._______...", "correctAnswer": "string", "sectionHeading": "string"},
        {"id": "r2_gf2", "sentence": "..._______...", "correctAnswer": "string", "sectionHeading": "string"},
        {"id": "r2_gf3", "sentence": "..._______...", "correctAnswer": "string", "sectionHeading": "string"},
        {"id": "r2_gf4", "sentence": "..._______...", "correctAnswer": "string", "sectionHeading": "string"},
        {"id": "r2_gf5", "sentence": "..._______...", "correctAnswer": "string", "sectionHeading": "string"}
      ]
    }
  },
  "readingIntoWriting": {
    "title": "string",
    "writingType": "${riwType}",
    "prompt": "string",
    "wordLimit": {"min": ${spec.writingWordLimit.riw.min}, "max": ${spec.writingWordLimit.riw.max}},
    "bulletPoints": ["string", "string", "string"]
  },
  "extendedWriting": {
    "title": "string",
    "writingType": "${ewType}",
    "prompt": "INDEPENDENT writing prompt — NO reference to any texts, readings, or previous tasks",
    "wordLimit": {"min": ${spec.writingWordLimit.ew.min}, "max": ${spec.writingWordLimit.ew.max}},
    "bulletPoints": ["string", "string", "string"]
  }
}
Rules: Return ONLY valid JSON. Paragraph matching options = noun phrases only (no full sentences). Exactly 6 options (A-F). Exactly 8 statements (A-H) per selection set. All gap-fill answers must be verbatim from the texts. Close all JSON arrays and objects correctly. CRITICAL: Task 4 (extendedWriting) prompt must NEVER mention texts A-D, readings, or any other task — it is always a standalone writing task from the candidate's own knowledge.`;
}

/** @deprecated Use getReadingTextsPrompt + getQuestionsPrompt instead */
export function getWrittenExamPrompt(level: ExamLevel): string {
  const spec = levelSpecs[level];
  const topicChoice = spec.topics[Math.floor(Math.random() * spec.topics.length)];
  const subjectArea = spec.subjectAreas[Math.floor(Math.random() * spec.subjectAreas.length)];
  const riwType = spec.writingTypes.riw[Math.floor(Math.random() * spec.writingTypes.riw.length)];
  const ewType = spec.writingTypes.ew[Math.floor(Math.random() * spec.writingTypes.ew.length)];

  return `You are an expert exam creator for Trinity College London ISE (Integrated Skills in English) exams.
Generate a complete ISE ${level.replace("ISE_", "")} level (CEFR ${spec.cefr}) Reading & Writing exam in STRICT JSON format.

═══════════════════════════════════════════
LEVEL: ${level.replace("ISE_", "ISE ")} (CEFR ${spec.cefr})
═══════════════════════════════════════════

LANGUAGE REQUIREMENTS FOR THIS LEVEL:
- Complexity: ${spec.complexity}
- Vocabulary: ${spec.vocabularyBand}
- Grammar: ${spec.grammarFocus}
- Register: ${spec.textRegister}

═══════════════════════════════════════════
TASK 1 — LONG READING (single text, 5 paragraphs)
═══════════════════════════════════════════

Generate a reading passage about "${topicChoice}".

CONTENT REQUIREMENTS (MANDATORY — do NOT generate shorter text):
- The FULL text must be ${spec.task1.totalWords}.
- Each of the 5 paragraphs: MINIMUM ${spec.task1.wordsPerParagraph} words AND at least ${spec.task1.minSentences} sentences.
- ${spec.task1.contentDepth}

PARAGRAPH STRUCTURE:
- Paragraph 1: Introduce the topic and establish context. Define key terms if needed.
- Paragraph 2: Develop the first main argument or perspective with evidence/examples.
- Paragraph 3: Present a contrasting or complementary perspective, or a different aspect of the topic.
- Paragraph 4: Explore implications, consequences, or a specific case study in depth.
- Paragraph 5: Synthesise the discussion, evaluate the arguments, and look forward.

Then generate 3 question sections:

**Questions 1-5 (Paragraph Matching — Trinity-style):**
- Provide 6 title options (A to F). Each option is a SHORT noun-phrase title (3-8 words MAX, NO full sentences, NO trailing period).
- Examples of valid titles: "The birth of advertising", "The power of words", "A deep-rooted shift in culture".
- INVALID: full sentences, explanations, statements with verbs ("Advertising became more visual" ← too long).
- 5 match paragraphs 1-5, and 1 is a DISTRACTOR (plausible but wrong).
- ${spec.questionGuidance}

**Questions 6-10 (Statement Selection):**
- Provide 8 statements (A to H) related to the text.
- Exactly 5 are TRUE according to the text, and 3 are FALSE.
- FALSE statements must be plausible distractors — related to the text but factually incorrect or distorted.
- The candidate must select the 5 correct statements.

**Questions 11-15 (Gap Fill):**
- Provide 5 sentences with a gap (shown as _______).
- Each answer is 1-3 words that appear VERBATIM in the reading text.
- Questions should test different paragraphs (not all from the same paragraph).

═══════════════════════════════════════════
TASK 2 — MULTI-TEXT READING (4 shorter texts)
═══════════════════════════════════════════

Generate 4 texts on the topic "${subjectArea}".

CONTENT REQUIREMENTS (MANDATORY — do NOT generate shorter text):
- Texts A, B, C: MINIMUM ${spec.task2.wordsPerText} words each AND at least ${spec.task2.minSentences} sentences each.
- Text D (Graph/Chart): MINIMUM ${spec.task2.graphMinWords} words of description + a graphData array with at least 4 data points.
- ${spec.task2.textRegister}

TEXT FORMATS:
- Text A — Blog post: A personal blog entry with the author's name. ${spec.task2.wordsPerText} words. Must contain opinions, examples, and personal experience.
- Text B — Forum post: A reply in an online discussion. ${spec.task2.wordsPerText} words. Must feel like a real person sharing their thoughts or experience.
- Text C — Article: A factual article from a newspaper or website. ${spec.task2.wordsPerText} words. More formal, objective, with data or expert references.
- Text D — Graph/Chart: A graph with at least 4 data points showing a trend, PLUS a descriptive analysis paragraph (${spec.task2.graphMinWords}+ words) explaining what the data shows, including specific numbers.

Then generate 3 question sections:

**Questions 16-20 (Text Matching):**
- 5 statements. The candidate matches each to the text it relates to (A, B, C, or D).
- Since there are 5 questions but only 4 texts, one letter MUST be used twice.

**Questions 21-25 (Statement Selection):**
- Same format as Questions 6-10: 8 statements (A-H), 5 TRUE, 3 FALSE.
- All 4 texts should be covered by the questions.

**Questions 26-30 (Gap Fill — Trinity "Notes" style):**
- The 5 questions form a STRUCTURED NOTES sheet.
- Provide a "notesTitle" for the overall topic.
- Group the 5 questions into 2-3 sections using "sectionHeading" (e.g., "Past" / "Now" / "Future", or "Causes" / "Effects" / "Solutions", or "Advantages" / "Disadvantages").
- Each consecutive question with the same heading belongs to that group.
- Each question is a sentence with _______ for the gap.
- Answers must be EXACT words/phrases (max 3 words) from texts A–D.

═══════════════════════════════════════════
TASKS 3 & 4 — WRITING
═══════════════════════════════════════════

**Task 3 (Reading into Writing):** Write a **${riwType}** prompt that requires the candidate to synthesise information from READING 2 ONLY (texts A–D from Task 2).
- DO NOT reference Reading 1 (Long Reading). Task 3 ALWAYS uses texts A–D.
- The prompt MUST clearly state the writing type ("Write a ${riwType}...").
- Provide 3 bullet points guiding what to cover.
- Word limit: ${spec.writingWordLimit.riw.min}-${spec.writingWordLimit.riw.max} words.

**Task 4 (Extended Writing):** Write a **${ewType}** prompt on an independent topic related to the exam theme.
- The prompt MUST clearly state the writing type ("Write a ${ewType}...").
- Provide 3 bullet points guiding what to cover.
- Word limit: ${spec.writingWordLimit.ew.min}-${spec.writingWordLimit.ew.max} words.

WRITING FORMAT RULES: For formal letters/emails, include appropriate opening/closing. For reports, use headings. For articles, require a catchy title. For essays, require a clear thesis. For reviews, ask for opinions and recommendations. For proposals, require a clear objective and action steps.

═══════════════════════════════════════════
OUTPUT JSON SCHEMA (follow EXACTLY)
═══════════════════════════════════════════

{
  "level": "${level}",
  "reading1": {
    "title": "string",
    "paragraphs": [
      { "number": 1, "text": "Full paragraph text here, ${spec.task1.wordsPerParagraph} words, ${spec.task1.minSentences}+ sentences..." },
      { "number": 2, "text": "Full paragraph text here..." },
      { "number": 3, "text": "Full paragraph text here..." },
      { "number": 4, "text": "Full paragraph text here..." },
      { "number": 5, "text": "Full paragraph text here..." }
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
        { "id": "r1_gf1", "sentence": "..._______...", "correctAnswer": "..." },
        { "id": "r1_gf2", "sentence": "..._______...", "correctAnswer": "..." },
        { "id": "r1_gf3", "sentence": "..._______...", "correctAnswer": "..." },
        { "id": "r1_gf4", "sentence": "..._______...", "correctAnswer": "..." },
        { "id": "r1_gf5", "sentence": "..._______...", "correctAnswer": "..." }
      ]
    }
  },
  "reading2": {
    "title": "string",
    "topic": "${subjectArea}",
    "texts": [
      { "letter": "A", "title": "...", "author": "...", "source": "Blog", "content": "Full blog text, ${spec.task2.wordsPerText} words...", "isGraph": false },
      { "letter": "B", "title": "...", "author": "...", "source": "Forum post", "content": "Full forum post, ${spec.task2.wordsPerText} words...", "isGraph": false },
      { "letter": "C", "title": "...", "source": "Article", "content": "Full article, ${spec.task2.wordsPerText} words...", "isGraph": false },
      { "letter": "D", "title": "...", "source": "Graph/Chart", "content": "Graph description with data analysis, ${spec.task2.graphMinWords}+ words...", "isGraph": true, "graphData": [{"label": "2020", "value": 45}, {"label": "2021", "value": 52}, {"label": "2022", "value": 61}, {"label": "2023", "value": 73}] }
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
      "notesTitle": "Topic title for the notes",
      "questions": [
        { "id": "r2_gf1", "sentence": "..._______...", "correctAnswer": "...", "sectionHeading": "Section 1" },
        { "id": "r2_gf2", "sentence": "..._______...", "correctAnswer": "...", "sectionHeading": "Section 1" },
        { "id": "r2_gf3", "sentence": "..._______...", "correctAnswer": "...", "sectionHeading": "Section 2" },
        { "id": "r2_gf4", "sentence": "..._______...", "correctAnswer": "...", "sectionHeading": "Section 2" },
        { "id": "r2_gf5", "sentence": "..._______...", "correctAnswer": "...", "sectionHeading": "Section 3" }
      ]
    }
  },
  "readingIntoWriting": {
    "title": "string",
    "writingType": "${riwType}",
    "prompt": "detailed writing instructions clearly stating to write a ${riwType}, referencing texts A-D from Task 2 ONLY",
    "wordLimit": { "min": ${spec.writingWordLimit.riw.min}, "max": ${spec.writingWordLimit.riw.max} },
    "bulletPoints": ["point 1", "point 2", "point 3"]
  },
  "extendedWriting": {
    "title": "string",
    "writingType": "${ewType}",
    "prompt": "detailed writing instructions clearly stating to write a ${ewType}",
    "wordLimit": { "min": ${spec.writingWordLimit.ew.min}, "max": ${spec.writingWordLimit.ew.max} },
    "bulletPoints": ["point 1", "point 2", "point 3"]
  }
}

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown, no backticks, no explanation before or after.
2. All content must be ORIGINAL. Do NOT copy from real Trinity exams.
3. MINIMUM WORD COUNTS ARE MANDATORY. Each Task 1 paragraph: ${spec.task1.wordsPerParagraph} words. Each Task 2 text: ${spec.task2.wordsPerText} words. DO NOT write shorter paragraphs or texts.
4. Paragraph matching: EXACTLY 6 options (A-F), 5 correct + 1 distractor.
5. Statement selection: EXACTLY 8 statements (A-H), exactly 5 TRUE + 3 FALSE.
6. Gap fill answers: 1-3 words that appear VERBATIM in the text.
7. Text D: MUST have isGraph: true and a graphData array with at least 4 data points.
8. Text matching Q16-20: one letter MUST be used twice (5 questions, 4 texts).
9. All IDs must be unique (r1_gf1, r1_gf2, ... r2_tm1, r2_tm2, ... r2_gf1, etc.).
10. Close all JSON objects and arrays properly. Every { must have a matching }.`;
}

export function getEvaluateWritingPrompt(level: ExamLevel, taskType: string, prompt: string, response: string): string {
  const desc = levelSpecs[level];

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
