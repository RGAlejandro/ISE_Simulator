export type ExamLevel = "ISE_FOUNDATION" | "ISE_I" | "ISE_II" | "ISE_III" | "ISE_IV";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type GrammarExerciseType = "gap_fill" | "mcq" | "error_correction";
export type WrittenTaskType = "READING_1" | "READING_2" | "READING_INTO_WRITING" | "EXTENDED_WRITING";
export type OralTaskType = "TOPIC" | "COLLABORATIVE" | "CONVERSATION" | "LISTENING";
export type Plan = "FREE" | "PRO";

// ═══════════════════════════════════════════
// READING TASK 1 — Single long text, 5 paragraphs
// ═══════════════════════════════════════════

/** Q1-5: Match each paragraph to a summary. Options A-F (6 options, 5 correct — 1 distractor) */
export interface ParagraphMatchingSection {
  type: "paragraph_matching";
  instructions: string;
  /** 6 options (A-F), each is a summary sentence. 5 match the paragraphs, 1 is a distractor */
  options: { letter: string; summary: string }[];
  /** correctAnswers[0] = letter for paragraph 1, etc. */
  correctAnswers: string[];
}

/** Q6-10: 8 statements A-H, select the 5 that are correct according to the text */
export interface StatementSelectionSection {
  type: "statement_selection";
  instructions: string;
  /** 8 statements (A-H) */
  statements: { letter: string; text: string }[];
  /** The 5 correct letters */
  correctAnswers: string[];
}

/** Q11-15 / Q26-30: Gap-fill sentences, answer is 1-3 words from the reading */
export interface GapFillSection {
  type: "gap_fill";
  instructions: string;
  /** Optional notes title (e.g., "Technology in homes") shown above the bullets. Trinity uses this for Q26-30. */
  notesTitle?: string;
  questions: {
    id: string;
    sentence: string; // sentence with _______ for the gap
    correctAnswer: string; // 1-3 words from the text
    /** Optional group heading (e.g., "Past", "Now", "Future"). Consecutive questions sharing the heading form a group. */
    sectionHeading?: string;
  }[];
}

export interface ReadingTask1 {
  title: string;
  paragraphs: { number: number; text: string }[];
  /** Q1-5 */
  paragraphMatching: ParagraphMatchingSection;
  /** Q6-10 */
  statementSelection: StatementSelectionSection;
  /** Q11-15 */
  gapFill: GapFillSection;
}

// ═══════════════════════════════════════════
// READING TASK 2 — 4 shorter texts (blogs, forums, graph)
// ═══════════════════════════════════════════

/** Q16-20: Match each statement to a text (A-D). One letter must be repeated since 5 questions, 4 texts */
export interface TextMatchingSection {
  type: "text_matching";
  instructions: string;
  questions: {
    id: string;
    statement: string;
  }[];
  /** correctAnswers[0] = letter for Q16, etc. One letter appears twice. */
  correctAnswers: string[];
}

export interface ReadingText {
  letter: string; // A, B, C, D
  title: string;
  author?: string;
  source: string; // "Blog", "Forum post", "Article", "Graph/Chart"
  content: string; // text content, or description of graph/chart
  isGraph?: boolean;
  graphData?: { label: string; value: number }[]; // for charts
}

export interface ReadingTask2 {
  title: string;
  topic: string;
  texts: ReadingText[];
  /** Q16-20 */
  textMatching: TextMatchingSection;
  /** Q21-25 */
  statementSelection: StatementSelectionSection;
  /** Q26-30 */
  gapFill: GapFillSection;
}

// ═══════════════════════════════════════════
// WRITING TASKS — Same as before
// ═══════════════════════════════════════════

export interface WritingTask {
  title: string;
  prompt: string;
  wordLimit: { min: number; max: number };
  bulletPoints?: string[];
  writingType?: string;
}

export interface WrittenExamContent {
  level: ExamLevel;
  reading1: ReadingTask1;
  reading2: ReadingTask2;
  readingIntoWriting: WritingTask;
  extendedWriting: WritingTask;
}

export interface WritingFeedback {
  score: number;
  band: string;
  taskFulfillment: { score: number; comments: string };
  grammar: { score: number; comments: string };
  vocabulary: { score: number; comments: string };
  organization: { score: number; comments: string };
  suggestions: string[];
}

export interface OralFeedbackData {
  score: number;
  pronunciation: { score: number; comments: string };
  grammar: { score: number; comments: string };
  vocabulary: { score: number; comments: string };
  fluency: { score: number; comments: string };
  taskFulfillment: { score: number; comments: string };
  suggestions: string[];
}

export interface UserUsage {
  writtenCount: number;
  oralCount: number;
  listeningCount: number;
  canTakeWritten: boolean;
  canTakeOral: boolean;
  canTakeListening: boolean;
}

export interface VocabCard {
  english: string;
  partOfSpeech: string;
  spanish: string;
  example: string;
}

export interface SavedWordData {
  id: string;
  english: string;
  spanish: string;
  example: string;
  partOfSpeech: string | null;
  level: string;
  notes: string | null;
  listId: string | null;
  createdAt: string;
}

export interface VocabularyListData {
  id: string;
  name: string;
  emoji: string;
  color: string;
  wordCount: number;
}

export interface WordDetails {
  ipa: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
  collocations: string[];
  register: string;
}

export interface GapFillQuestion {
  id: string;
  type: "gap_fill";
  sentence: string;
  hint?: string;
  correctAnswer: string;
  grammarPoint?: string;
}

export interface McqQuestion {
  id: string;
  type: "mcq";
  question: string;
  options: string[];
  correctAnswer: number;
  grammarPoint?: string;
}

export interface ErrorCorrectionQuestion {
  id: string;
  type: "error_correction";
  sentence: string;
  correctAnswer: string;
  grammarPoint?: string;
}

export type GrammarQuestion = GapFillQuestion | McqQuestion | ErrorCorrectionQuestion;

export interface GrammarQuestionResult {
  questionId: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export interface ListeningRound1Feedback {
  score: number;
  mainIdeaCaptured: boolean;
  informationTypeIdentified: boolean;
  comments: string;
  missedPoints: string[];
}

export interface ListeningRound2Feedback {
  score: number;
  accuracyScore: number;
  completenessScore: number;
  comments: string;
  capturedDetails: string[];
  missedDetails: string[];
}
