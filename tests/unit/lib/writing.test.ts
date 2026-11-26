import { describe, expect, it } from "vitest";
import {
  CRITERIA_FOR_TASK, aggregateErrorTags, bandFromScore, buildAnnotatedSegments, cleanTranscription, countInserted, countStruck,
  countWords, locateQuote, meanScore, reflowLines, sanitizeEvaluation, sanitizeWritingTask, stripStruck,
} from "@/lib/writing";
import type { WritingEvaluation, WritingIssue, WritingUpgrade } from "@/types";

const criteria = (score: unknown) => ({
  readingForWriting: { score, comment: "rfw" }, taskFulfilment: { score, comments: "tf" },
  organisation: { score, comment: "org" }, languageControl: { score, comment: "**lc**" },
});

describe("scores and words", () => {
  it("counts words", () => {
    expect(countWords("  Bees   are vital \n here ")).toBe(4);
    expect(countWords("   ")).toBe(0);
  });

  it("maps the criteria mean to a Trinity band", () => {
    expect([1.9, 2, 2.5, 3.5].map(bandFromScore)).toEqual(["below", "pass", "merit", "distinction"]);
  });

  it("averages only the task's criteria", () => {
    const ev = { criteria: { readingForWriting: { score: 1 }, taskFulfilment: { score: 3 }, organisation: { score: 2 } } } as unknown as WritingEvaluation;
    expect(meanScore(ev, "READING_INTO_WRITING")).toBe(1.5);
    expect(meanScore(ev, "EXTENDED_WRITING")).toBe(1.67);
    expect(CRITERIA_FOR_TASK.EXTENDED_WRITING).not.toContain("readingForWriting");
  });
});

describe("locateQuote", () => {
  const text = "I think that   Bees are “important”. Bees are important too.";

  it("finds exact quotes, skipping taken ranges", () => {
    const first = locateQuote(text, "Bees are")!;
    expect(text.slice(...first)).toBe("Bees are");
    const second = locateQuote(text, "Bees are", [first])!;
    expect(second[0]).toBeGreaterThan(first[0]);
    expect(locateQuote(text, "Bees are", [first, second])).toBeNull();
  });

  it("tolerates whitespace, case and quote style", () => {
    const r = locateQuote(text, 'that bees are "important"')!;
    expect(text.slice(...r)).toBe("that   Bees are “important”");
    // The first, fancy-quoted one is taken: the tolerant match finds the second.
    const again = locateQuote(text, "BEES ARE IMPORTANT", [[0, 36]])!;
    expect(text.slice(...again)).toBe("Bees are important");
  });

  it("returns null for quotes that aren't in the text", () => {
    expect(locateQuote(text, "")).toBeNull();
    expect(locateQuote(text, "   ")).toBeNull();
    expect(locateQuote(text, "wasps")).toBeNull();
  });
});

describe("sanitizeEvaluation", () => {
  const text = "Bees is important. They make honey and they pollinate plants. In conclusion bees is good.";
  const raw = {
    criteria: criteria(2.6),
    summary: "Good",
    strengths: ["Clear", "", 4],
    issues: [
      { quote: "Bees is important", correction: "Bees are important", tag: "subject-verb-agreement", category: "grammar", explanation: "Plural" },
      { quote: "bees is good", correction: "bees are good", tag: "SPELLING" },
      { quote: "not in text", correction: "x" },
      { quote: "same", correction: "same" },
      { quote: "In conclusion", correction: "To conclude", tag: "linking" },
      null,
    ],
    upgrades: [
      { quote: "make honey", suggestions: [{ text: "produce honey", translation: "producen miel" }, { text: "make honey" }, null], example: "e", note: "n" },
      { quote: "Bees is", suggestions: [{ text: "Bees are" }] },
      { quote: "pollinate plants", suggestions: [] },
      "nope",
    ],
    improvedVersion: "Bees are important.",
    nextSteps: ["Review agreement"],
  };

  it("clamps scores and keeps only quotes found in the text", () => {
    const ev = sanitizeEvaluation(raw, text, "READING_INTO_WRITING")!;
    expect(ev.criteria.taskFulfilment).toEqual({ score: 3, comment: "tf" });
    expect(ev.criteria.languageControl?.comment).toBe("lc");
    expect(ev.issues.map((i) => i.quote)).toEqual(["Bees is important", "In conclusion", "bees is good"]);
    expect(ev.issues[1]).toMatchObject({ tag: "linking", category: "cohesion" });
    expect(ev.issues[2]).toMatchObject({ tag: "spelling", category: "spelling" });
    // The upgrade overlapping an issue is dropped; the other keeps one real suggestion.
    expect(ev.upgrades).toHaveLength(1);
    expect(ev.upgrades[0].suggestions).toEqual([{ text: "produce honey", translation: "producen miel" }]);
    expect(ev.strengths).toEqual(["Clear"]);
  });

  it("maps unknown tags and categories sensibly", () => {
    const t = "a b c d e f g h";
    const ev = sanitizeEvaluation({
      criteria: criteria(9),
      issues: ["punctuation", "register", "repetition", "collocation", "capitalisation", "made-up"].map((tag, i) => ({ quote: t.split(" ")[i], correction: "z", tag })),
    }, t, "EXTENDED_WRITING")!;
    expect(ev.issues.map((i) => [i.tag, i.category])).toEqual([
      ["punctuation", "punctuation"], ["register", "register"], ["repetition", "cohesion"],
      ["collocation", "vocabulary"], ["capitalisation", "spelling"], ["other", "grammar"],
    ]);
    expect(ev.criteria.organisation?.score).toBe(4);
  });

  it("rejects an evaluation missing a criterion or with a bad score", () => {
    expect(sanitizeEvaluation(null, text, "EXTENDED_WRITING")).toBeNull();
    expect(sanitizeEvaluation({ criteria: { taskFulfilment: { score: 2 } } }, text, "EXTENDED_WRITING")).toBeNull();
    expect(sanitizeEvaluation({ criteria: criteria("high") }, text, "EXTENDED_WRITING")).toBeNull();
  });

  it("cuts long text at a word boundary", () => {
    const ev = sanitizeEvaluation({ criteria: criteria(2), summary: `${"word ".repeat(300)}end` }, text, "EXTENDED_WRITING")!;
    expect(ev.summary.length).toBeLessThanOrEqual(900);
    expect(ev.summary.endsWith("…")).toBe(true);
    const noSpace = sanitizeEvaluation({ criteria: criteria(2), summary: "x".repeat(1000) }, text, "EXTENDED_WRITING")!;
    expect(noSpace.summary).toHaveLength(900);
  });
});

describe("sanitizeWritingTask", () => {
  const long = "Bees pollinate a third of the food we eat. ".repeat(7);
  const opts = { taskType: "READING_INTO_WRITING" as const, wordLimit: { min: 200, max: 230 }, minutes: 35 };
  const base = { title: "Bees", prompt: "Write an article for a science magazine about why bees matter.", bulletPoints: ["why", "what we can do"] };

  it("accepts a Task 3 with four sources, the fourth possibly a graph", () => {
    const raw = {
      ...base,
      sources: [
        { title: "A", content: long, author: "Ana" },
        { content: long, source: "Forum" },
        { content: long },
        { content: "Bee numbers by year, falling fast.", graphData: [{ label: "2000", value: 10 }, { label: "2010", value: "8" }, { label: "2020", value: 5 }, { label: "", value: 1 }, null] },
      ],
    };
    const t = sanitizeWritingTask(raw, opts)!;
    expect(t.sources?.map((s) => s.letter)).toEqual(["A", "B", "C", "D"]);
    expect(t.sources?.[0].author).toBe("Ana");
    expect(t.sources?.[1].title).toBe("Text B");
    expect(t.sources?.[2].source).toBe("Article");
    expect(t.sources?.[3]).toMatchObject({ isGraph: true, graphData: [{ label: "2000", value: 10 }, { label: "2010", value: 8 }, { label: "2020", value: 5 }] });
  });

  it("rejects missing essentials", () => {
    expect(sanitizeWritingTask(null, opts)).toBeNull();
    expect(sanitizeWritingTask({ ...base, prompt: "short" }, opts)).toBeNull();
    expect(sanitizeWritingTask({ ...base, bulletPoints: ["one"] }, opts)).toBeNull();
    expect(sanitizeWritingTask({ ...base, sources: [{ content: long }, { content: "short" }, { content: long }, { content: long }] }, opts)).toBeNull();
    expect(sanitizeWritingTask({ ...base, sources: [{ content: long }, null, { content: long }, { content: long }] }, opts)).toBeNull();
  });

  it("accepts a Task 4 without sources", () => {
    const t = sanitizeWritingTask({ ...base, title: "" }, { ...opts, taskType: "EXTENDED_WRITING" })!;
    expect(t.title).toBe("Writing task");
    expect(t.sources).toBeUndefined();
  });
});

describe("annotated text", () => {
  it("splits the draft into plain text and highlights, ignoring bad spans", () => {
    const text = "Bees is good and make honey.";
    const issues = [{ start: 5, end: 7 }, { start: 50, end: 60 }] as WritingIssue[];
    const upgrades = [{ start: 17, end: 27 }, { start: 6, end: 9 }] as WritingUpgrade[];
    expect(buildAnnotatedSegments(text, issues, upgrades)).toEqual([
      { kind: "text", text: "Bees " },
      { kind: "issue", text: "is", index: 0 },
      { kind: "text", text: " good and " },
      { kind: "upgrade", text: "make honey", index: 0 },
      { kind: "text", text: "." },
    ]);
    expect(buildAnnotatedSegments("abc", [], [])).toEqual([{ kind: "text", text: "abc" }]);
  });
});

describe("error notebook", () => {
  it("counts tags across writings with recent examples", () => {
    const ev = (tags: string[]) => ({ issues: tags.map((tag) => ({ tag, quote: tag, correction: "c", explanation: "e" })) }) as unknown as WritingEvaluation;
    const stats = aggregateErrorTags([ev(["articles", "articles", "weird"]), ev(["articles"]), { issues: undefined } as unknown as WritingEvaluation], 2);
    expect(stats.map((s) => [s.tag, s.count])).toEqual([["articles", 3], ["other", 1]]);
    expect(stats[0].examples).toHaveLength(2);
  });
});

describe("handwriting transcriptions", () => {
  it("counts and strips crossed-out and inserted words", () => {
    const t = "I ⟦goed⟧ went to ⟨the⟩ park ⟦yesterday⟧ .";
    expect(countStruck(t)).toBe(2);
    expect(countInserted(t)).toBe(1);
    expect(stripStruck(t)).toBe("I went to the park.");
    expect(countStruck("clean")).toBe(0);
    expect(countInserted("clean")).toBe(0);
  });

  it("tidies a fresh transcription and joins page wraps", () => {
    expect(cleanTranscription("I  like^ bees ,and\r\nthey are\nvital .")).toBe("I like bees,and they are vital.");
  });

  it("keeps greetings, list items, headings and paragraphs on their own lines", () => {
    expect(reflowLines("Dear Sir,\nI am writing to\ncomplain.")).toBe("Dear Sir,\nI am writing to complain.");
    expect(reflowLines("Reasons:\n- cost\n- time")).toBe("Reasons:\n- cost\n- time");
    expect(reflowLines("Why Bees Matter\nBees pollinate crops.")).toBe("Why Bees Matter\nBees pollinate crops.");
    expect(reflowLines("First paragraph.\n\nSecond one.")).toBe("First paragraph.\n\nSecond one.");
    expect(reflowLines("Thanks for reading\nBest wishes,\nAna")).toBe("Thanks for reading\nBest wishes,\nAna");
    expect(reflowLines("\nLeading break")).toBe("\nLeading break");
  });
});
