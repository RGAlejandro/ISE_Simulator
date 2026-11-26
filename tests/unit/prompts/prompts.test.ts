import { describe, expect, it } from "vitest";
import { evaluateGrammarPrompt } from "@/lib/prompts/grammar";
import {
  evaluateRound1Prompt, evaluateRound2Prompt, generateListeningPrompt, getListeningMinWords, modelAnswersPrompt,
} from "@/lib/prompts/listening";
import { officialAnswersPrompt, officialPaperPrompt } from "@/lib/prompts/official";
import * as oral from "@/lib/prompts/oral-exam";
import { buildPaperGradingPrompt } from "@/lib/prompts/paper-exam";
import { getPronunciationFeedbackPrompt, getPronunciationTextPrompt } from "@/lib/prompts/pronunciation";
import { quizCheckPrompt, quizQuestionsPrompt } from "@/lib/prompts/quiz";
import { generateReadingLookupPrompt, generateReadingPrompt, pickReadingTopic, readingTargetCount } from "@/lib/prompts/reading";
import { teacherLessonPrompt, teacherReviewPrompt } from "@/lib/prompts/teacher";
import { getTeamLessonPrompt, sanitizeLesson as sanitizeTeamLesson } from "@/lib/prompts/team-lesson";
import { pickStructures, translationCheckPrompt, translationGeneratePrompt } from "@/lib/prompts/translation";
import { buildTutorConversation, getTutorSystemPrompt } from "@/lib/prompts/tutor";
import {
  exampleTranslationPrompt, generateAdaptiveVocabularyPrompt, generateSingleWordPrompt, generateWordDetailsPrompt,
  getTranslationLang, levelToStartScore, scoreToLevel, translationLocale,
} from "@/lib/prompts/vocabulary";
import {
  feedbackLanguage, getHandwritingTranscriptionPrompt, getSentenceCheckPrompt, getWritingEvaluationPrompt, getWritingTaskPrompt,
} from "@/lib/prompts/writing";
import * as written from "@/lib/prompts/written-exam";
import { getAccent } from "@/lib/pronunciation";
import { LEVEL_STRUCTURES } from "@/lib/translation";
import type { ExamLevel } from "@/types";
import type { TutorSnapshot } from "@/lib/tutor-context";

const LEVELS: ExamLevel[] = ["ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"];
const asksForJson = (p: string) => expect(p).toMatch(/JSON/);

describe("grammar prompt", () => {
  it("lists each answer with its result", () => {
    const p = evaluateGrammarPrompt("B2", "mcq", [{ id: "q1", type: "mcq", question: "Pick", options: ["a", "b"], correctAnswer: 0 } as never], [
      { questionId: "q1", isCorrect: false, userAnswer: "1", correctAnswer: "a" },
      { questionId: "missing", isCorrect: true, userAnswer: "x", correctAnswer: "x" },
    ]);
    expect(p).toContain("B2");
    asksForJson(p);
  });
});

describe("listening prompts", () => {
  it("scales the passage with the level", () => {
    expect(getListeningMinWords("ISE_IV")).toBeGreaterThan(getListeningMinWords("ISE_FOUNDATION"));
    for (const l of LEVELS) asksForJson(generateListeningPrompt(l));
  });

  it("puts the passage and the student's work in the marking prompts", () => {
    expect(modelAnswersPrompt("Bees pollinate crops.", "Bees", "advantages")).toContain("Bees pollinate crops.");
    expect(evaluateRound1Prompt("Passage", "Title", "facts", "My summary")).toContain("My summary");
    expect(evaluateRound2Prompt("Passage", "Title", "facts", "My notes")).toContain("My notes");
  });
});

describe("official paper prompts", () => {
  it("reads the paper and the answer sheet", () => {
    expect(officialPaperPrompt({ hasKeyFile: true })).not.toBe(officialPaperPrompt({ hasKeyFile: false }));
    const paper = {
      title: "P", level: "ISE_III", keySource: "paper", sources: [],
      blocks: [{ task: 1, from: 1, to: 2, type: "match", instructions: "", options: [], items: [], key: ["A", "B"] }],
      task3: { title: "t", genre: "article", prompt: "Write an article", bulletPoints: [], wordLimit: { min: 200, max: 230 }, minutes: 40 },
      task4: null,
    } as const;
    const p = officialAnswersPrompt(paper as never);
    expect(p).toMatch(/1/);
    asksForJson(p);
  });
});

describe("oral exam prompts", () => {
  const prep = { general: "- point one", detailed: "My essay about bees." };

  it("builds every task prompt for every level", () => {
    for (const l of LEVELS) {
      expect(oral.getOralExaminerSystemPrompt(l, null).length).toBeGreaterThan(200);
      expect(oral.getTopicTaskPrompt(l, "Bees", prep)).toContain("Bees");
      expect(oral.getTopicFollowUpPrompt(l, "Examiner: hi", prep).length).toBeGreaterThan(20);
      expect(oral.getCollaborativeTaskPrompt(l).length).toBeGreaterThan(20);
      expect(oral.getCollaborativeFollowUpPrompt(l, "Candidate: hi").length).toBeGreaterThan(20);
      expect(oral.getConversationTaskPrompt(l).length).toBeGreaterThan(20);
      expect(oral.getConversationFollowUpPrompt(l, "Candidate: hi").length).toBeGreaterThan(20);
      expect(oral.getListeningTaskPrompt(l).length).toBeGreaterThan(20);
    }
    expect(oral.getTopicTaskPrompt("ISE_II", "Bees")).toContain("Bees");
    expect(oral.getListeningFollowUpPrompt("ISE_II", "What is it?", "A bee")).toContain("A bee");
  });

  it("marks each task with the transcript", () => {
    for (const t of ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"] as const) {
      const p = oral.getOralEvaluationPrompt("ISE_III", t, "Candidate: I think bees matter.");
      expect(p).toContain("I think bees matter.");
      asksForJson(p);
    }
  });

  it("locks the live examiner to the plan and persona", () => {
    const plan = [{ task: "TOPIC", minutes: 4 }, { task: "CONVERSATION", minutes: 2 }] as never;
    const p = oral.getLiveExaminerPrompt("ISE_III", null, plan, "Bees", prep);
    expect(p).toContain("TOPIC → CONVERSATION");
    expect(p).toContain("Bees");
  });
});

describe("paper exam grading prompt", () => {
  it("includes the questions to grade", () => {
    const gap = { questions: [{ sentence: "Bees ___ crops.", correctAnswer: "pollinate" }] };
    const content = {
      level: "ISE_II",
      reading1: { title: "R1", paragraphMatching: { correctAnswers: ["A", "B"] }, statementSelection: { correctAnswers: ["C"] }, gapFill: gap },
      reading2: { topic: "Bees", texts: [{ letter: "A", title: "Blog" }], textMatching: { correctAnswers: ["A"] }, statementSelection: { correctAnswers: ["B"] }, gapFill: gap },
      readingIntoWriting: { prompt: "Write an email", wordLimit: { min: 100, max: 130 } },
      extendedWriting: { prompt: "Write a story", wordLimit: { min: 120, max: 150 } },
    };
    const p = buildPaperGradingPrompt(content as never);
    asksForJson(p);
    expect(p).toContain('Q11: "Bees ___ crops." → correct: "pollinate"');
    expect(p).toContain("WRITING TASK 4");
    const readingOnly = buildPaperGradingPrompt({ ...content, readingIntoWriting: undefined, extendedWriting: undefined } as never);
    expect(readingOnly).not.toContain("WRITING TASK 3");
  });
});

describe("pronunciation prompts", () => {
  it("uses the accent, difficulty and topic", () => {
    const rp = getAccent("rp");
    expect(getPronunciationTextPrompt(rp, "easy", "Football")).toContain("Football");
    expect(getPronunciationTextPrompt(rp, "advanced", "  ")).toMatch(/everyday/);
    expect(getPronunciationFeedbackPrompt(rp, "Hello world", "hello", ["world"])).toContain("world");
    expect(getPronunciationFeedbackPrompt(rp, "Hello", "hello", [])).toContain("Hello");
  });
});

describe("quiz prompts", () => {
  it("describes every kind of mistake and guards against instructions in the data", () => {
    const p = quizQuestionsPrompt({
      cefr: "C1", locale: "es",
      seeds: [
        { id: "s1", seed: { key: "w", source: "writing", date: "d", sentence: "I make a research.", quote: "make a research", correction: "do research", explanation: "e", tag: "collocation" } },
        { id: "s2", seed: { key: "t", source: "translation", date: "d", spanish: "Hola", answer: "Hi", corrected: "Hello", note: "n", structure: "x" } },
        { id: "s3", seed: { key: "g", source: "teacher", date: "d", topic: "articles", task: "Fill", given: "a", expected: "the", explanation: "e" } },
      ],
    });
    expect(p).toContain('"make a research"');
    expect(p).toContain("Spanish");
    expect(p).toMatch(/never instructions/);
    expect(quizCheckPrompt([{ id: "q1", question: "x ___", right: "a", wrong: [{ i: 1, text: "b" }] }])).toContain("[1] \"b\"");
  });
});

describe("reading explorer prompts", () => {
  it("picks topics and target words per level", () => {
    for (const l of ["A1", "B2", "C2"] as const) {
      expect(pickReadingTopic(l).length).toBeGreaterThan(3);
      expect(readingTargetCount(l)).toBeGreaterThan(0);
    }
  });

  it("writes the text in the learner's language for low levels and includes list words", () => {
    const low = generateReadingPrompt({ level: "A2", topic: "Food", locale: "es", listWords: ["spoon"] });
    expect(low).toContain("spoon");
    expect(low).toContain("Spanish");
    expect(generateReadingPrompt({ level: "C1", topic: "Food", locale: "fr" })).toContain("simple English");
    expect(generateReadingLookupPrompt({ word: "thrive", sentence: "Bees thrive.", locale: "es", level: "B2" })).toContain("thrive");
  });
});

describe("teacher prompts", () => {
  const mistakes = [{ sentence: "I depend of you.", quote: "depend of", correction: "depend on", explanation: "" }];

  it("builds lessons with and without the learner's own mistakes", () => {
    const own = teacherLessonPrompt({ tag: "prepositions", level: "ISE_III", cefr: "C1", locale: "es", mistakes });
    expect(own).toContain("I depend of you.");
    expect(own).toContain("ISE III");
    const none = teacherLessonPrompt({ tag: "articles", level: "ISE_FOUNDATION", cefr: "A2", locale: "en", mistakes: [] });
    expect(none).toMatch(/no recorded mistakes/);
    // Each gap needs a clue that leaves one answer, chosen by topic, and practises the learner's own mistakes.
    expect(own).toMatch(/"hint" is REQUIRED/);
    expect(own).toContain('kind of word is missing, in Spanish');
    expect(own).toMatch(/SAME words, collocations, prepositions/);
    expect(none).not.toMatch(/SAME words/);
    expect(teacherLessonPrompt({ tag: "word-choice", level: "ISE_III", cefr: "C1", locale: "es", mistakes })).toContain("the meaning of the missing word");
    expect(teacherLessonPrompt({ tag: "word-form", level: "ISE_II", cefr: "B2", locale: "es", mistakes })).toContain("base word in capitals");
    expect(teacherLessonPrompt({ tag: "verb-tense", level: "ISE_II", cefr: "B2", locale: "es", mistakes })).toContain("verb in its base form");
  });

  it("reviews wrong answers with the writing mistakes as context", () => {
    const p = teacherReviewPrompt({
      topic: "collocation", locale: "es", score: 3, total: 10, mistakes,
      items: [{ id: "e1", task: "Choose", expected: ["make"], given: "take", why: "" }],
    });
    expect(p).toContain('"take"');
    expect(p).toContain("3/10");
    expect(teacherReviewPrompt({ topic: "articles", locale: "fr", score: 0, total: 1, mistakes: [], items: [] })).toContain("French");
  });
});

describe("team lesson", () => {
  it("prompts with the class's weak points", () => {
    const p = getTeamLessonPrompt({ level: "ISE_II", cefr: "B2", students: 12, criteria: [{ label: "Language control", value: 0.4 }], errors: [{ tag: "articles", students: 5, occurrences: 9 }] });
    expect(p).toContain("articles");
  });

  it("validates the generated lesson", () => {
    const raw = {
      title: "Articles", objective: "o", warmUp: "w", speakingTask: "s", homework: "h",
      points: [{ point: "Use the", example: "e", mistake: "m", fix: "f" }, { point: "" }],
      exercise: { instruction: "Fill", items: [{ prompt: "p", answer: "a" }, { prompt: "no answer" }] },
    };
    const l = sanitizeTeamLesson(raw)!;
    expect(l.points).toHaveLength(1);
    expect(l.exercise.items).toHaveLength(1);
    expect(l.minutes).toBe(10);
    expect(sanitizeTeamLesson({ title: "x" })).toBeNull();
    expect(sanitizeTeamLesson(null)).toBeNull();
  });
});

describe("translation prompts", () => {
  it("picks n structures, repeating in a new order past the level's list", () => {
    expect(pickStructures("ISE_III", 5)).toHaveLength(5);
    const many = pickStructures("ISE_III", 15);
    expect(many).toHaveLength(15);
    for (let i = 1; i < many.length; i++) expect(many[i]).not.toBe(many[i - 1]);
    expect(new Set(pickStructures("ISE_II")).size).toBe(8);
    for (const s of many) expect(LEVEL_STRUCTURES.ISE_III).toContain(s);
  });

  it("asks for sentences with hints in the learner's language, and checks answers", () => {
    const g = translationGeneratePrompt("ISE_II", "fr", ["second conditional"], "es");
    expect(g).toContain("French (France)");
    expect(g).toContain("second conditional");
    expect(g).toMatch(/"pattern"/);
    const c = translationCheckPrompt({ level: "ISE_II", source: "es", item: { id: "t1", source: "Hola", reference: "Hello", structure: "greeting" }, answer: "Hi", locale: "es" });
    expect(c).toContain('"Hi"');
    asksForJson(c);
    expect(translationGeneratePrompt("ISE_FOUNDATION", "es", ["past simple"], "en")).toContain("Spanish (Spain)");
  });
});

describe("tutor prompts", () => {
  const snapshot: TutorSnapshot = {
    today: "2026-11-25", firstName: "Ana",
    goal: { level: "ISE_III", examDate: "2026-12-02", daysLeft: 7, phase: "simulate", modulesToPass: "READING_WRITING", targetBand: "MERIT" },
    readiness: null, recentAttempts: [],
    writingErrors: { textsAnalysed: 0, top: [] },
    vocabulary: { lists: [], saved: 0, dueForReviewToday: 0, notStartedYet: 0, learned: 0, struggling: [], alreadySaved: [] },
  };

  it("builds the system prompt with the learner's data and attachments", () => {
    const p = getTutorSystemPrompt(snapshot, { locale: "es", photoCount: 0 });
    expect(p).toContain("Ana");
    expect(p).toContain("Spanish");
    expect(p).toMatch(/"quiz"/);
    const withPhotos = getTutorSystemPrompt(snapshot, { locale: "xx", photoCount: 2, photoSummary: "A worksheet", videoSummary: "A talk" });
    expect(withPhotos).toContain("A worksheet");
    // All the photos go into one list unless the learner asks for one per photo.
    expect(withPhotos).toContain('"single" (the default)');
    expect(withPhotos).toMatch(/"per_photo".*ONLY when they explicitly ask/);
    expect(withPhotos).toContain("A talk");
  });

  it("turns the chat into a transcript and mentions attached photos", () => {
    const msgs = [{ role: "user" as const, content: "Hola" }, { role: "assistant" as const, content: "Hi!" }];
    expect(buildTutorConversation(msgs, 0)).toBe("Student: Hola\n\nTutor: Hi!");
    expect(buildTutorConversation(msgs, 2)).toMatch(/attached 2 photo/);
  });
});

describe("vocabulary prompts", () => {
  it("maps scores and levels both ways", () => {
    expect(scoreToLevel(0).cefr).toBe("A1");
    expect(scoreToLevel(100).cefr).toBe("C2");
    for (const c of ["A1", "A2", "B1", "B2", "C1", "C2"] as const) expect(scoreToLevel(levelToStartScore(c)).cefr).toBe(c);
  });

  it("falls back to Spanish for the translation language", () => {
    expect(getTranslationLang("fr").name).toBe("French");
    expect(getTranslationLang("en").name).toBe("Spanish");
    expect(translationLocale("fr")).toBe("fr");
    expect(translationLocale("de")).toBe("es");
  });

  it("asks for words, a single word, details and an example translation", () => {
    const p = generateAdaptiveVocabularyPrompt(70, ["dog"], "es", "phrasal_verbs");
    expect(p).toContain("dog");
    expect(generateAdaptiveVocabularyPrompt(10, [], "fr", "idioms")).toContain("French");
    expect(generateAdaptiveVocabularyPrompt(40, [])).toMatch(/JSON/);
    expect(generateSingleWordPrompt("thrive", "fr")).toContain("thrive");
    expect(generateSingleWordPrompt("thrive")).toContain("Spanish");
    expect(generateWordDetailsPrompt("thrive", "B2")).toContain("thrive");
    const ex = exampleTranslationPrompt({ example: "Bees thrive here.", english: "thrive", translation: "prosperar", locale: "es" });
    expect(ex).toContain("(Spain)");
    expect(ex).toContain('"prosperar"');
    expect(exampleTranslationPrompt({ example: "x", english: "y", translation: "z", locale: "fr" })).toContain("(France)");
  });
});

describe("writing prompts", () => {
  const task = { title: "Bees", prompt: "Write an article about bees.", bulletPoints: ["why"], wordLimit: { min: 200, max: 230 }, minutes: 40, sources: [{ letter: "A", title: "T", source: "S", content: "Bees are vital." }] };

  it("names the feedback language", () => {
    expect(feedbackLanguage("fr")).toBe("French");
    expect(feedbackLanguage("zz")).toBe("Spanish");
  });

  it("writes Task 3 and Task 4 items", () => {
    expect(getWritingTaskPrompt({ level: "ISE_III", taskType: "READING_INTO_WRITING", genre: "article", topic: "Bees" })).toContain("Task 3");
    expect(getWritingTaskPrompt({ level: "ISE_I", taskType: "EXTENDED_WRITING", genre: "email", topic: "Holidays" })).toContain("Task 4");
  });

  it("marks with the register guide, the text and the previous scores", () => {
    const p = getWritingEvaluationPrompt({
      level: "ISE_III", taskType: "READING_INTO_WRITING", genre: "article", task: task as never, text: "Bees are important.", wordCount: 3,
      locale: "es", criteria: ["readingForWriting", "taskFulfilment", "organisation", "languageControl"],
      previous: { version: 1, scores: { languageControl: 1 } },
    });
    expect(p).toContain("Bees are important.");
    expect(p).toContain("Bees are vital.");
    asksForJson(p);
    const t4 = getWritingEvaluationPrompt({ level: "ISE_II", taskType: "EXTENDED_WRITING", genre: "review", task: { ...task, sources: undefined } as never, text: "Good film.", wordCount: 2, locale: "en", criteria: ["taskFulfilment", "organisation", "languageControl"] });
    expect(t4).toContain("Good film.");
  });

  it("transcribes handwriting and checks example sentences", () => {
    expect(getHandwritingTranscriptionPrompt()).toMatch(/transcri/i);
    expect(getSentenceCheckPrompt([{ word: "thrive", sentence: "Bees thrive." }], "es")).toContain("Bees thrive.");
  });
});

describe("written exam prompts", () => {
  it("has a spec and prompts for every level", () => {
    for (const l of LEVELS) {
      expect(written.getLevelSpec(l).cefr).toMatch(/^[ABC][12]$/);
      asksForJson(written.getReadingTextsPrompt(l));
      asksForJson(written.getWrittenExamPrompt(l));
    }
  });

  it("grounds the questions on the generated texts", () => {
    const r1 = { title: "Remote work", paragraphs: [{ number: 1, text: "Working from home is common." }] };
    const r2 = { title: "Bees", topic: "bees", texts: [{ letter: "A", source: "Blog", content: "Bees matter.", isGraph: false }] };
    const full = written.getQuestionsPrompt("ISE_III", r1, r2);
    expect(full).toContain("Working from home is common.");
    expect(full).toContain("Bees matter.");
    const readingOnly = written.getQuestionsPrompt("ISE_I", r1, r2, { readingOnly: true });
    expect(readingOnly.length).toBeLessThan(full.length);
  });

  it("marks writing and explains wrong reading answers", () => {
    expect(written.getEvaluateWritingPrompt("ISE_II", "reading_into_writing", "Write an email", "Dear Sir")).toContain("Dear Sir");
    const p = written.getReadingExplanationsPrompt("ISE_II", [{ num: 3, type: "gap", context: "Bees ___ crops.", userAnswer: "eat", correctAnswer: "pollinate" }]);
    expect(p).toContain("pollinate");
  });
});
