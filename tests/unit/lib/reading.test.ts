import { describe, expect, it } from "vitest";
import {
  buildSegments, containsPhrase, gradeAnswers, isAnswerCorrect, locatePhrase, normalizeParagraph, normalizeWord,
  sanitizeReadingContent, splitSentences, toLookupData, tokenize,
} from "@/lib/reading";
import type { ReadingQuestion } from "@/types";

describe("tokenising and sentences", () => {
  it("splits words (with apostrophes, hyphens and accents) from the rest", () => {
    expect(tokenize("It's a well-known café!").map((t) => [t.text, t.isWord])).toEqual([
      ["It's", true], [" ", false], ["a", true], [" ", false], ["well-known", true], [" ", false], ["café", true], ["!", false],
    ]);
    expect(tokenize("")).toEqual([]);
  });

  it("normalises words and paragraphs", () => {
    expect(normalizeWord("  Don’t  Stop ")).toBe("don't stop");
    expect(normalizeParagraph(" a \n\n b  c ")).toBe("a b c");
  });

  it("splits sentences only before a capital, digit or quote", () => {
    const p = "Bees matter, e.g. for apples. They pollinate. \"Really?\" she asked. 3 hives died.";
    expect(splitSentences(p)).toEqual(["Bees matter, e.g. for apples.", "They pollinate.", "\"Really?\" she asked.", "3 hives died."]);
    expect(splitSentences(p).join(" ")).toBe(p);
  });
});

describe("phrases", () => {
  const paragraphs = ["Bees are vital. They carry on working all day.", "Farmers rely on them. Carry on reading."];

  it("finds multi-word phrases separated only by spaces", () => {
    expect(containsPhrase("They carry  on working", "carry on")).toBe(true);
    expect(containsPhrase("They carry, on working", "carry on")).toBe(false);
    expect(containsPhrase("Bees", "")).toBe(false);
    expect(containsPhrase("carry", "carry on")).toBe(false);
  });

  it("locates the first sentence with a phrase", () => {
    expect(locatePhrase(paragraphs, "carry on")).toEqual({ paragraph: 0, sentence: 1, text: "They carry on working all day." });
    expect(locatePhrase(paragraphs, "rely on")).toMatchObject({ paragraph: 1, sentence: 0 });
    expect(locatePhrase(paragraphs, "wasps")).toBeNull();
  });

  it("builds segments where longer key phrases win", () => {
    const segs = buildSegments("They carry on working.", ["carry", "carry on"]);
    expect(segs).toEqual([
      { kind: "word", text: "They" }, { kind: "text", text: " " },
      { kind: "target", text: "carry on", target: 1 },
      { kind: "text", text: " " }, { kind: "word", text: "working" }, { kind: "text", text: "." },
    ]);
  });
});

describe("answers", () => {
  const find: ReadingQuestion = { type: "find", clue: "a word meaning 'important'", paragraph: 1, answer: "vital", explanation: "" };
  const choice: ReadingQuestion = { type: "comprehension", question: "Why?", options: ["a", "b", "c"], answer: 2, explanation: "" };

  it("checks find answers by text and choices by index", () => {
    expect(isAnswerCorrect(find, " Vital ")).toBe(true);
    expect(isAnswerCorrect(find, 2)).toBe(false);
    expect(isAnswerCorrect(choice, 2)).toBe(true);
    expect(isAnswerCorrect(choice, "2")).toBe(false);
    expect(gradeAnswers([find, choice], ["vital"])).toBe(1);
  });

  it("copies only the lookup fields the client needs", () => {
    const l = { word: "w", paragraph: 0, sentence: 1, lemma: "w", partOfSpeech: "noun", translation: "t", definition: "d", level: "B1", secret: 1 };
    expect(toLookupData(l as never)).not.toHaveProperty("secret");
  });
});

describe("sanitizeReadingContent", () => {
  const paragraphs = [
    "Bees are vital for farming. They pollinate crops and thrive in warm places.",
    "Farmers rely on bees. Some farmers carry on despite losses.",
  ];
  const target = (word: string, extra: Record<string, unknown> = {}) => ({ word, translation: "t", definition: "d", ...extra });
  const raw = {
    title: "Bees",
    paragraphs,
    targetWords: [
      target("vital"), target("pollinate"), target("thrived", { lemma: "thrive" }), target("rely on"),
      target("VITAL"), target("absent"), target("carry on", { translation: "" }), null,
      target("despite"),
    ],
    questions: [
      { type: "context", word: "vital", options: ["essential", "dangerous", "small"], answer: 0, explanation: "e" },
      { type: "context", word: "vital", options: ["a", "b", "c"], answer: 0 },
      { type: "context", word: "missing", options: ["a", "b", "c"], answer: 0 },
      { type: "context", word: "pollinate", options: ["a", "A", "c"], answer: 0 },
      { type: "context", word: "rely on", options: ["depend on", "ignore", "pay"], answer: 9 },
      { type: "find", clue: "a word meaning 'continue' (in paragraph 2)", answer: "carry on", paragraph: 2 },
      { type: "find", clue: "a word meaning important", answer: "vital" },
      { type: "find", clue: "", answer: "farmers" },
      { type: "find", clue: "grow well", answer: "thrive", paragraph: 9 },
      { type: "comprehension", question: "Why do farmers need bees?", options: ["pollination", "honey only", "nothing"], answer: 0 },
      { type: "comprehension", question: "", options: ["a", "b", "c"], answer: 0 },
      { type: "other" },
      null,
    ],
  };

  it("keeps key words that occur in the text (falling back to the lemma) and valid questions", () => {
    const r = sanitizeReadingContent(raw)!;
    expect(r.title).toBe("Bees");
    expect(r.content.targetWords.map((t) => t.word)).toEqual(["vital", "pollinate", "thrive", "rely on", "despite"]);
    const types = r.content.questions.map((q) => q.type);
    expect(types).toEqual(["context", "find", "find", "comprehension"]);
    const ctx = r.content.questions[0] as Extract<ReadingQuestion, { type: "context" }>;
    expect(ctx.sentence).toBe("Bees are vital for farming.");
    expect(ctx.options[ctx.answer]).toBe("essential");
    const find = r.content.questions[1] as Extract<ReadingQuestion, { type: "find" }>;
    expect(find).toMatchObject({ clue: "a word meaning 'continue'", paragraph: 2, answer: "carry on" });
    expect((r.content.questions[2] as Extract<ReadingQuestion, { type: "find" }>).paragraph).toBe(1);
  });

  it("returns null when there isn't enough for a session", () => {
    expect(sanitizeReadingContent(null)).toBeNull();
    expect(sanitizeReadingContent({ title: "x", paragraphs: ["only one"] })).toBeNull();
    expect(sanitizeReadingContent({ ...raw, targetWords: [target("vital")] })).toBeNull();
    expect(sanitizeReadingContent({ ...raw, questions: raw.questions.slice(0, 2) })).toBeNull();
    expect(sanitizeReadingContent({ ...raw, paragraphs: [3, ...paragraphs] })).not.toBeNull();
  });
});
