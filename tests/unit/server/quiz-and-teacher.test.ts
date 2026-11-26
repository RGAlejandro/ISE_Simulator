import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma")).prismaMock }));
vi.mock("@/lib/ai-provider", () => ({ generateJSON: vi.fn() }));

import { db, resetDb } from "../helpers/prisma";
import { generateJSON } from "@/lib/ai-provider";
import { canStartQuiz, checkQuestions, loadMastery, loadQuizSeeds, loadWordPool, vocabQuestion, writeQuestions } from "@/lib/quiz-server";
import { canStartLesson, cefrFor, loadMarkedDrafts } from "@/lib/teacher-server";
import type { QuizQuestion, QuizSeed } from "@/lib/quiz";

const at = new Date("2026-11-20T10:00:00Z");

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
});

describe("quiz: loading mistakes", () => {
  it("collects mistakes from writings, translations, lessons and vocabulary", async () => {
    const text = "I depend of you. She make a research.";
    db("writingDraft", "findMany").mockResolvedValue([
      {
        id: "d1", text, createdAt: at,
        feedback: { issues: [
          { start: 2, end: 11, quote: "depend of", correction: "depend on", tag: "prepositions", explanation: "e" },
          { start: 0, end: 0, quote: "make a research", correction: "does research" },
          { quote: "same", correction: "Same" },
          { quote: "not in the text", correction: "x" },
          { quote: "x".repeat(130), correction: "y" },
          { quote: "", correction: "y" },
        ] },
      },
      { id: "d2", text: "t", createdAt: at, feedback: null },
    ]);
    db("translationSession", "findMany").mockResolvedValue([
      {
        id: "r1", createdAt: at,
        items: [{ id: "t1", source: "Ojalá", reference: "I wish", structure: "wish" }, { id: "t2", source: "Hola", reference: "Hi", structure: "x" }, { id: "t3", source: "s", reference: "r", structure: "x" }],
        answers: { t1: { answer: "I hope", verdict: "almost", corrected: "", note: "n" }, t2: { answer: "Hi", verdict: "correct" }, t3: { answer: "", verdict: "wrong" } },
      },
      { id: "r2", createdAt: at, items: null, answers: null },
    ]);
    db("grammarSession", "findMany").mockResolvedValue([
      {
        id: "g1", focus: "collocation", completedAt: at,
        questions: [
          { id: "e1", kind: "choice", question: "I need to ___ a decision.", options: ["make", "do", "take"], answer: 0, explanation: "" },
          { id: "e2", kind: "gap", sentence: "Good ___ maths.", hint: "", accepted: ["at"], explanation: "" },
          { id: "e3", kind: "choice", question: "q", options: ["a", "b"], answer: 0, explanation: "" },
        ],
        feedback: { results: [
          { id: "e1", given: "1", ok: false, expected: "make", explanation: "base", why: "personal" },
          { id: "e2", given: "in", ok: false, expected: "at", explanation: "base" },
          { id: "e3", given: "9", ok: false, expected: "a", explanation: "" },
          { id: "e4", given: "x", ok: false, expected: "y", explanation: "" },
          { id: "e2", given: " ", ok: false, expected: "at", explanation: "" },
        ] },
      },
      { id: "g2", focus: null, completedAt: null, questions: null, feedback: null },
    ]);
    db("savedWord", "findMany").mockResolvedValue([
      { id: "w1", english: "thrive", spanish: "prosperar", example: "e", partOfSpeech: null, lastReviewedAt: null, createdAt: at },
    ]);
    const seeds = await loadQuizSeeds("u1");
    expect(seeds.map((s) => s.key)).toEqual(["w:d1:0", "w:d1:1", "t:r1:t1", "g:g1:e1", "g:g1:e2", "v:w1"]);
    expect(seeds[0]).toMatchObject({ sentence: "I depend of you.", quote: "depend of" });
    expect(seeds[1]).toMatchObject({ sentence: "She make a research.", tag: "other", explanation: "" });
    expect(seeds[2]).toMatchObject({ corrected: "I wish" });
    expect(seeds[3]).toMatchObject({ given: "do", explanation: "personal", topic: "collocation" });
    expect(seeds[4]).toMatchObject({ given: "in", explanation: "base" });
    expect(seeds[5]).toMatchObject({ english: "thrive", partOfSpeech: "" });
  });

  it("folds past quizzes into mastery and applies the free limit", async () => {
    db("grammarSession", "findMany").mockResolvedValue([
      { createdAt: at, questions: [{ id: "q1", key: "k", answer: 0, options: [] }], responses: { q1: 0 } },
    ]);
    expect((await loadMastery("u1")).get("k")).toEqual({ asked: 1, streak: 1, lastCorrect: true });
    expect(await canStartQuiz("u1", true)).toBe(true);
    db("grammarSession", "count").mockResolvedValue(1);
    expect(await canStartQuiz("u1", false)).toBe(false);
    db("grammarSession", "count").mockResolvedValue(0);
    expect(await canStartQuiz("u1", false)).toBe(true);
    db("savedWord", "findMany").mockResolvedValue([{ english: "a", spanish: "b", partOfSpeech: null }]);
    expect(await loadWordPool("u1")).toHaveLength(1);
  });
});

describe("quiz: vocabulary questions", () => {
  const seed = { key: "v:1", source: "vocab", date: "d", wordId: "1", english: "decipher", translation: "descifrar", example: "He deciphered it.", partOfSpeech: "verb" } as Extract<QuizSeed, { source: "vocab" }>;
  const pool = [
    { english: "decipher", spanish: "descifrar", partOfSpeech: "verb" },
    { english: "convey", spanish: "transmitir", partOfSpeech: "verb" },
    { english: "amplify", spanish: "amplificar", partOfSpeech: "verb" },
    { english: "comprehend", spanish: "comprender", partOfSpeech: "verb · transitive" },
    { english: "ledger", spanish: "libro de cuentas", partOfSpeech: "noun" },
    { english: "convey again", spanish: "transmitir", partOfSpeech: "noun" },
  ];

  it("uses the learner's other words as options, either direction", () => {
    for (let i = 0; i < 10; i++) {
      const q = vocabQuestion(seed, pool, "es")!;
      const texts = q.options.map((o) => o.text);
      expect(texts).toHaveLength(4);
      expect(new Set(texts).size).toBe(4);
      const right = q.options[q.answer];
      expect(["descifrar", "decipher"]).toContain(right.text);
      expect(right.why).toContain("He deciphered it.");
      expect(q.options.filter((_, j) => j !== q.answer).every((o) => /«.+» es «.+»/.test(o.why))).toBe(true);
      expect(["¿Qué significa?", "¿Cómo se dice en inglés?"]).toContain(q.prompt);
    }
    expect(vocabQuestion(seed, pool, "zz")!.prompt).toMatch(/¿/);
    expect(vocabQuestion(seed, pool, "en")!.prompt).toMatch(/mean|say/);
  });

  it("needs three other words", () => {
    expect(vocabQuestion(seed, pool.slice(0, 3), "es")).toBeNull();
  });
});

describe("quiz: writing and checking questions", () => {
  const seed = (i: number): Exclude<QuizSeed, { source: "vocab" }> =>
    ({ key: `w:d:${i}`, source: "writing", date: "d", sentence: `I depend of you ${i}.`, quote: "depend of", correction: "depend on", explanation: "", tag: "prepositions" });
  const answerFor = (ids: string[]) => ({
    questions: ids.map((id) => ({ seed: id, prompt: "Completa", question: "I ___ you.", options: [{ text: "depend on", why: "ok" }, { text: "depend of", why: "tuyo" }, { text: "depend at", why: "no" }], answer: 0 })),
  });
  const idsIn = (prompt: string) => [...prompt.matchAll(/^(s\d+) \[/gm)].map((m) => m[1]);

  it("writes two halves in parallel and keeps the checked questions", async () => {
    vi.mocked(generateJSON).mockImplementation(async (prompt: string) =>
      prompt.startsWith("Check these") ? { checks: [] } : answerFor(idsIn(prompt)));
    const qs = await writeQuestions([1, 2, 3, 4, 5, 6].map(seed), "C1", "es");
    expect(qs).toHaveLength(6);
    const writes = vi.mocked(generateJSON).mock.calls.filter((c) => !String(c[0]).startsWith("Check these"));
    expect(writes).toHaveLength(2);
    expect(writes[0][1]).toMatchObject({ prefer: "gemini" });
  });

  it("falls back to the fast provider when Gemini gives too little", async () => {
    vi.mocked(generateJSON).mockImplementation(async (prompt: string, opts?: { prefer?: string }) => {
      if (prompt.startsWith("Check these")) throw new Error("checker down");
      return opts?.prefer === "gemini" ? { questions: [] } : answerFor(idsIn(prompt));
    });
    const qs = await writeQuestions([1, 2].map(seed), "C1", "es");
    expect(qs).toHaveLength(2);
  });

  const question = (options: string[], answer = 0): Omit<QuizQuestion, "id"> => ({
    key: "k", source: "writing", date: "d", topic: "", prompt: "p", question: "q ___", yours: "",
    options: options.map((text) => ({ text, why: text })), answer,
  });

  it("drops options that are also right, and questions whose answer is doubtful", async () => {
    vi.mocked(generateJSON).mockResolvedValue({ checks: [
      { id: "q1", alsoRight: [2], rightIsWrong: false },
      { id: "q2", alsoRight: [1], rightIsWrong: false },
      { id: "q3", alsoRight: [], rightIsWrong: true },
      { id: "q4", alsoRight: [0, "x"] },
    ] });
    const out = await checkQuestions([
      question(["make", "do", "take", "create"]),
      question(["raise", "create", "arise"]),
      question(["a", "b", "c"]),
      question(["a", "b", "c"]),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].options.map((o) => o.text)).toEqual(["make", "do", "create"]);
    expect(out[0].options[out[0].answer].text).toBe("make");
    expect(out[1].options).toHaveLength(3);
    expect(await checkQuestions([])).toEqual([]);
  });

  it("gives up on a slow checker and keeps the questions as they are", async () => {
    vi.useFakeTimers();
    vi.mocked(generateJSON).mockReturnValue(new Promise(() => {}));
    const pending = checkQuestions([question(["a", "b", "c"])]);
    await vi.advanceTimersByTimeAsync(20_001);
    expect(await pending).toHaveLength(1);
    vi.useRealTimers();
  });
});

describe("teacher server", () => {
  it("loads marked first drafts only", async () => {
    db("writingDraft", "findMany").mockResolvedValue([
      { text: "a", feedback: { issues: [] }, createdAt: at },
      { text: "b", feedback: null, createdAt: at },
      { text: "c", feedback: { summary: "no issues" }, createdAt: at },
    ]);
    expect((await loadMarkedDrafts("u1")).map((d) => d.text)).toEqual(["a"]);
  });

  it("limits free lessons and maps levels to CEFR", async () => {
    expect(await canStartLesson("u1", true)).toBe(true);
    db("grammarSession", "count").mockResolvedValue(1);
    expect(await canStartLesson("u1", false)).toBe(false);
    expect(cefrFor("ISE_III")).toBe("C1");
    expect(cefrFor(null)).toBe("B2");
  });
});
