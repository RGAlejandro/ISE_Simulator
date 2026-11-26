import { describe, expect, it } from "vitest";
import { CONNECTORS, computeLiveMetrics, movingTTR, words, type LiveTurn } from "@/lib/live-metrics";
import {
  ASSIGNMENT_HREF, ASSIGNMENT_KINDS, aggregateErrorTags, endOfDayUTC, generateJoinCode, histogram, isJoinCode,
} from "@/lib/teams";
import { ACCENTS, getAccent, scorePronunciation } from "@/lib/pronunciation";
import {
  acceptedForms, markReading, overallScore, sanitizeAnswers, sanitizePaper, toWritingTask, type OfficialPaperContent,
} from "@/lib/official";

const turn = (role: LiveTurn["role"], text: string, task = "TOPIC", seconds = 30, id = Math.random().toString()): LiveTurn =>
  ({ id, role, task, text, startedAt: 0, endedAt: seconds * 1000 });

describe("live metrics", () => {
  it("tokenises words with contractions", () => {
    expect(words("I don't KNOW, it's fine!")).toEqual(["i", "don't", "know", "it's", "fine"]);
    expect(words("123 !!")).toEqual([]);
  });

  it("measures lexical range with a moving window", () => {
    expect(movingTTR([])).toBe(0);
    expect(movingTTR(["a", "b", "a", "b"])).toBe(0.5);
    const long = Array.from({ length: 80 }, (_, i) => `w${i % 20}`);
    expect(movingTTR(long, 40)).toBeCloseTo(0.5);
  });

  it("returns zeros and no nudges for an empty exam", () => {
    const m = computeLiveMetrics([]);
    expect(m).toMatchObject({ candidateWords: 0, examinerWords: 0, talkShare: 0, wpm: 0, fillerRate: 0, nudges: [] });
  });

  it("counts fillers, connectors, questions and talk share", () => {
    const cand = "Um, I think that, you know, basically remote work is good. However, on the other hand it can be lonely. What do you think? Moreover, it saves time.";
    const m = computeLiveMetrics([turn("EXAMINER", "Tell me about remote work."), turn("CANDIDATE", cand, "COLLABORATIVE", 20)]);
    expect(m.fillers.map((f) => f.term)).toEqual(expect.arrayContaining(["um / uh / erm", "I think (that)", "you know", "basically"]));
    expect(m.connectors).toEqual(expect.arrayContaining(["on the other hand", "however", "moreover"]));
    expect(m.candidateQuestions).toBe(1);
    expect(m.perTask.COLLABORATIVE.questions).toBe(1);
    expect(m.talkShare).toBeGreaterThan(0.8);
    expect(m.wpm).toBeGreaterThan(0);
    expect(m.longestTurnWords).toBe(words(cand).length);
    expect(CONNECTORS).toContain("on the other hand");
  });

  it("nudges a quiet, slow, filler-heavy candidate who asks no questions", () => {
    const filler = Array.from({ length: 45 }, () => "um").join(" ");
    const m = computeLiveMetrics(
      [turn("EXAMINER", Array.from({ length: 100 }, () => "word").join(" ")), turn("CANDIDATE", filler, "COLLABORATIVE", 120)],
      "COLLABORATIVE",
      90,
    );
    expect(m.nudges.length).toBeLessThanOrEqual(2);
    expect(m.nudges[0]).toBe("speakMore");
    expect(m.nudges[1]).toBe("askQuestions");
  });

  it("flags fast pace, missing connectors and says on track when all is well", () => {
    const fast = Array.from({ length: 160 }, (_, i) => `word${i}`).join(" ");
    const m = computeLiveMetrics([turn("CANDIDATE", fast, "TOPIC", 30)]);
    expect(m.nudges).toEqual(["fastPace", "useConnectors"]);

    const good = Array.from({ length: 50 }, (_, i) => `idea${i}`).join(" ");
    expect(computeLiveMetrics([turn("CANDIDATE", good, "TOPIC", 25)]).nudges).toEqual(["onTrack"]);

    const slow = Array.from({ length: 50 }, (_, i) => `idea${i}`).join(" ");
    expect(computeLiveMetrics([turn("CANDIDATE", slow, "TOPIC", 60)]).nudges).toEqual(["slowPace"]);

    const fillers = `${Array.from({ length: 45 }, (_, i) => `w${i}`).join(" ")} um um um um`;
    expect(computeLiveMetrics([turn("CANDIDATE", fillers, "TOPIC", 20)]).nudges).toContain("fillers");
  });
});

describe("teams", () => {
  it("has a page for every assignment kind", () => {
    for (const k of ASSIGNMENT_KINDS) expect(ASSIGNMENT_HREF[k]).toMatch(/^\//);
  });

  it("makes 8-character join codes without ambiguous characters", () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(8);
    expect(isJoinCode(code)).toBe(true);
    expect(generateJoinCode(() => 0)).toBe("AAAAAAAA");
    expect(isJoinCode("ABCD0EFG")).toBe(false);
    expect(isJoinCode("ABC")).toBe(false);
  });

  it("bins chances into a histogram, clamping out-of-range values", () => {
    const h = histogram([0, 0.1, 0.5, 0.99, 1, -0.2, 1.4]);
    expect(h.map((b) => b.count)).toEqual([3, 0, 1, 0, 3]);
    expect(h[0]).toMatchObject({ from: 0, to: 0.2 });
  });

  it("ranks class errors by students, then occurrences, ignoring 'other'", () => {
    const per = new Map([
      ["ana", ["articles", "articles", "prepositions", "other"]],
      ["ben", ["prepositions"]],
      ["cai", ["prepositions", "spelling"]],
    ]);
    const stats = aggregateErrorTags(per, 2);
    expect(stats).toEqual([
      { tag: "prepositions", occurrences: 3, students: 3 },
      { tag: "articles", occurrences: 2, students: 1 },
    ]);
  });

  it("closes an assignment at the end of its day (UTC)", () => {
    expect(endOfDayUTC("2026-12-02").toISOString()).toBe("2026-12-02T23:59:59.999Z");
    expect(Number.isNaN(endOfDayUTC("not a date").getTime())).toBe(true);
  });
});

describe("pronunciation", () => {
  it("falls back to RP for unknown accents", () => {
    expect(getAccent("american").voice).toBe("en-US-GuyNeural");
    expect(getAccent("klingon")).toBe(ACCENTS[0]);
    expect(getAccent(null)).toBe(ACCENTS[0]);
  });

  it("scores a perfect reading at 100", () => {
    const r = scorePronunciation("The cat sat.", "the cat sat");
    expect(r).toMatchObject({ score: 100, matched: 3, total: 3 });
    expect(r.words.every((w) => w.ok)).toBe(true);
  });

  it("marks missed words and keeps word order", () => {
    const r = scorePronunciation("I would like a coffee please", "I like coffee please");
    expect(r.words.map((w) => w.ok)).toEqual([true, false, true, false, true, true]);
    expect(r.score).toBe(67);
    expect(scorePronunciation("one two three", "three two one").matched).toBe(1);
  });

  it("ignores punctuation-only tokens and handles empty input", () => {
    const r = scorePronunciation("Hello — world", "hello world");
    expect(r.total).toBe(2);
    expect(r.words[1]).toEqual({ text: "—", ok: true });
    expect(scorePronunciation("—", "anything").score).toBe(0);
    expect(scorePronunciation("hello world", "").score).toBe(0);
  });
});

describe("official papers", () => {
  const rawPaper = {
    title: "Sample paper 2",
    level: "ISE_III",
    keySource: "paper",
    sources: [
      { letter: "a", title: "Bees", content: "Bees are vital pollinators for many crops around the world." },
      { letter: "B", title: "Too short", content: "Short." },
    ],
    blocks: [
      { task: 1, from: 6, to: 7, type: "select", instructions: "Choose two", options: [{ letter: "a", text: "x" }, { letter: "", text: "no letter" }], key: ["b", "D"] },
      { task: 1, from: 1, to: 2, type: "match", options: [{ letter: "A", text: "Summary A" }], items: [{ num: 1, text: "Para 1" }, { num: 9, text: "out of range" }], key: ["A", "c"] },
      { from: 16, to: 17, type: "gap", key: ["(the) hippocampus", "memory / memories"] },
      { from: 3, to: 2, type: "gap", key: ["bad range"] },
      { from: 1, to: 1, type: "essay", key: ["bad type"] },
    ],
    task3: { title: "Bees article", genre: "Article", prompt: "Write an article about bees using the four texts you have read.", bulletPoints: ["why", "", 3], wordLimit: { min: 200, max: 230 }, minutes: 40 },
    task4: { prompt: "too short" },
  };

  const paper = sanitizePaper(rawPaper, false) as OfficialPaperContent;

  it("validates the paper and drops malformed blocks and sources", () => {
    expect(paper.level).toBe("ISE_III");
    expect(paper.blocks.map((b) => [b.from, b.type, b.task])).toEqual([[1, "match", 1], [6, "select", 1], [16, "gap", 2]]);
    expect(paper.blocks[0].items).toEqual([{ num: 1, text: "Para 1" }]);
    expect(paper.blocks[1].options).toHaveLength(1);
    expect(paper.blocks[1].key).toEqual(["B", "D"]);
    expect(paper.sources).toEqual([{ letter: "A", title: "Bees", content: rawPaper.sources[0].content }]);
    expect(paper.task3).toMatchObject({ genre: "article", wordLimit: { min: 200, max: 230 }, bulletPoints: ["why"] });
    expect(paper.task4).toBeNull();
    expect(paper.keySource).toBe("paper");
  });

  it("rejects something that isn't an ISE paper and picks the key source", () => {
    expect(sanitizePaper({ level: "B2" }, false)).toBeNull();
    expect(sanitizePaper({ level: "ISE_II", blocks: [] }, false)).toBeNull();
    expect(sanitizePaper(null, false)).toBeNull();
    const t = { prompt: "Write an essay about technology in schools today." };
    expect(sanitizePaper({ level: "ISE_II", keySource: "upload", task4: t }, true)?.keySource).toBe("upload");
    expect(sanitizePaper({ level: "ISE_II", keySource: "upload", task4: t }, false)?.keySource).toBe("ai");
    const defaults = sanitizePaper({ level: "ISE_II", task4: { ...t, wordLimit: { min: -1, max: 5 }, minutes: 500 } }, false)!;
    expect(defaults.task4).toMatchObject({ title: t.prompt, genre: "essay", wordLimit: { min: 150, max: 180 }, minutes: 40 });
    expect(defaults.title).toBe("Trinity ISE paper");
  });

  it("expands optional words and alternatives in key answers", () => {
    expect(acceptedForms("(the) hippocampus").sort()).toEqual(["hippocampus", "the hippocampus"]);
    expect(acceptedForms("memory / memories")).toEqual(["memory", "memories"]);
    expect(acceptedForms("A OR B")).toEqual(["a", "b"]);
  });

  it("sanitises transcribed answers to the paper's questions", () => {
    const a = sanitizeAnswers({ reading: { 1: "a)", 2: "c", 6: "b", 7: "d", 16: " The Hippocampus. ", 99: "x" }, task3: "My  article", illegible: 2.4 }, paper);
    expect(a.reading).toMatchObject({ 1: "A", 2: "C", 6: "B", 7: "D", 16: "The Hippocampus." });
    expect(a.reading["99"]).toBeUndefined();
    expect(a.illegible).toBe(2);
    expect(a.task4).toBe("");
    expect(sanitizeAnswers(null, paper).illegible).toBe(0);
  });

  it("marks Reading: letters, select-N without repeats, and gap alternatives", () => {
    const answers = sanitizeAnswers({ reading: { 1: "A", 2: "B", 6: "D", 7: "D", 16: "hippocampus", 17: "Memories!" } }, paper);
    const r = markReading(paper, answers);
    expect(r.questions.map((q) => [q.num, q.ok])).toEqual([[1, true], [2, false], [6, true], [7, false], [16, true], [17, true]]);
    expect(r).toMatchObject({ correct: 4, total: 6, task1: { correct: 2, total: 4 }, task2: { correct: 2, total: 2 } });
  });

  it("combines Reading and Writing like the mock exam", () => {
    const reading = { correct: 15, total: 30, task1: { correct: 0, total: 0 }, task2: { correct: 0, total: 0 }, questions: [] };
    expect(overallScore(reading, [2, 3])).toBe(56);
    expect(overallScore(null, [2])).toBe(50);
    expect(overallScore(reading, [])).toBe(50);
    expect(overallScore(null, [])).toBeNull();
  });

  it("turns an official task into a Writing task, with sources only for Task 3", () => {
    const t3 = toWritingTask(paper.task3!, "READING_INTO_WRITING", paper.sources);
    expect(t3.sources?.[0]).toMatchObject({ letter: "A", title: "Bees" });
    expect(toWritingTask(paper.task3!, "EXTENDED_WRITING", paper.sources).sources).toBeUndefined();
  });
});
