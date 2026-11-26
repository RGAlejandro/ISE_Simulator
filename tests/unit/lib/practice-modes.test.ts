import { describe, expect, it } from "vitest";
import {
  QUIZ_SIZE, isMastered, masteryFrom, pickSeeds, reveal, sanitizeQuestions, shuffleOptions, toClientQuestion, topicOf, yoursOf,
  type QuizQuestion, type QuizSeed,
} from "@/lib/quiz";
import {
  checkExercise, describeExercise, diagnose, errorsSince, gapHint, isTeachable, letterHint, normalizeAnswer, readLessonFeedback, sanitizeLesson,
  sentenceAround, toClientExercise, type LessonExercise, type MarkedDraft, type OwnMistake,
} from "@/lib/teacher";
import {
  DEFAULT_ROUND, EXAM_LEVEL_VALUES, LEVEL_STRUCTURES, hintsFor, isRoundSize, matchesReference, roundMinutes, roundScore,
  sanitizeItems, sanitizeResult, sentenceStart,
} from "@/lib/translation";
import type { WritingEvaluation } from "@/types";

// ─── Quiz ────────────────────────────────────────────────────────────────────

const q = (id: string, key: string, answer = 0): QuizQuestion => ({
  id, key, answer, source: "writing", date: "2026-11-20", topic: "prepositions", prompt: "Completa", question: "x ___",
  options: [{ text: "a", why: "A is right" }, { text: "b", why: "B is wrong" }, { text: "c", why: "C is wrong" }], yours: "b",
});
const past = (day: number, qs: QuizQuestion[], responses: Record<string, number>) =>
  ({ createdAt: new Date(`2026-11-${day}T10:00:00Z`), questions: qs, responses });

describe("quiz mastery", () => {
  it("retires a mistake after two right answers in a row", () => {
    const m = masteryFrom([
      past(23, [q("q1", "A"), q("q2", "B"), q("q3", "C")], { q1: 0, q2: 0, q3: 1 }),
      past(22, [q("q1", "A"), q("q2", "B"), q("q3", "C")], { q1: 0, q2: 1, q3: 0 }),
      past(24, [q("q1", "D")], {}),
    ]);
    expect(isMastered(m.get("A"))).toBe(true);
    expect(m.get("B")).toEqual({ asked: 2, streak: 1, lastCorrect: true });
    expect(m.get("C")).toEqual({ asked: 2, streak: 0, lastCorrect: false });
    expect(m.has("D")).toBe(false);
    expect(isMastered(undefined)).toBe(false);
  });

  it("ignores malformed history", () => {
    expect(masteryFrom([{ createdAt: new Date(), questions: null, responses: null }]).size).toBe(0);
  });
});

describe("quiz seed picking", () => {
  const seed = (key: string, source: QuizSeed["source"], date: string) => ({ key, source, date }) as QuizSeed;

  it("leaves out mastered mistakes, mixes sources, and puts never-asked and failed ones first", () => {
    const m = masteryFrom([
      past(22, [q("q1", "A"), q("q2", "B"), q("q3", "C")], { q1: 0, q2: 1, q3: 0 }),
      past(23, [q("q1", "A"), q("q2", "B"), q("q3", "C")], { q1: 0, q2: 0, q3: 1 }),
    ]);
    const seeds = [
      seed("A", "writing", "2026-11-20"), seed("B", "writing", "2026-11-21"), seed("C", "writing", "2026-11-19"),
      seed("w:x:1", "writing", "2026-11-18"), seed("w:x:2", "writing", "2026-11-17"), seed("w:x:3", "writing", "2026-11-16"),
      seed("t:r:1", "translation", "2026-11-10"), seed("v:1", "vocab", "2026-11-01"), seed("g:l:1", "teacher", "2026-11-02"),
    ];
    const picked = pickSeeds(seeds, m, 7).map((s) => s.key);
    expect(picked).not.toContain("A");
    expect(picked.slice(0, 4)).toEqual(["w:x:1", "t:r:1", "g:l:1", "v:1"]);
    // At most two from the same writing while there are other mistakes.
    expect(picked.filter((k) => k.startsWith("w:x:")).length).toBe(2);
    expect(picked.indexOf("C")).toBeLessThan(picked.indexOf("B"));
  });

  it("relaxes the caps when there's nothing else left", () => {
    const only = [1, 2, 3, 4].map((i) => seed(`w:x:${i}`, "writing", `2026-11-1${i}`));
    expect(pickSeeds(only, new Map(), 3)).toHaveLength(3);
    expect(pickSeeds([], new Map(), QUIZ_SIZE)).toEqual([]);
  });
});

describe("quiz questions", () => {
  const writing = { key: "w:1:0", source: "writing", date: "d", sentence: "s", quote: "make a research", correction: "do research", explanation: "", tag: "collocation" } as QuizSeed;
  const translation = { key: "t:1:1", source: "translation", date: "d", spanish: "es", answer: "my try", corrected: "fixed", note: "", structure: "x" } as QuizSeed;
  const teacher = { key: "g:1:1", source: "teacher", date: "d", topic: "articles", task: "t", given: "a", expected: "the", explanation: "" } as QuizSeed;
  const vocab = { key: "v:1", source: "vocab", date: "d", wordId: "1", english: "e", translation: "t", example: "x", partOfSpeech: "" } as QuizSeed;

  it("knows what the learner wrote and the topic, per source", () => {
    expect([writing, translation, teacher, vocab].map(yoursOf)).toEqual(["make a research", "my try", "a", ""]);
    expect([writing, translation, teacher, vocab].map(topicOf)).toEqual(["collocation", "", "articles", ""]);
  });

  it("validates the model's questions and keeps the right answer through the shuffle", () => {
    const seeds = new Map<string, QuizSeed>([["s1", writing], ["s2", translation], ["s3", teacher], ["s4", vocab]]);
    const raw = {
      questions: [
        { seed: "s1", prompt: "Completa", question: "I ___ research", options: [{ text: "make a research", why: "Es lo que escribiste" }, { text: "do research", why: "Correcto" }, { text: "do a research", why: "No" }], answer: "1" },
        { seed: "s1", prompt: "dup", question: "again", options: [{ text: "x" }, { text: "y" }, { text: "z" }], answer: 0 },
        { seed: "s2", skip: true },
        { seed: "s3", question: "q", options: [{ text: "a" }, { text: "A." }, { text: "c" }], answer: 0 },
        { seed: "s4", question: "q", options: [{ text: "a" }, { text: "b" }, { text: "c" }], answer: 3 },
        { seed: "nope", question: "q", options: [{ text: "a" }, { text: "b" }, { text: "c" }], answer: 0 },
        null,
      ],
    };
    const out = sanitizeQuestions(raw, seeds);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: "w:1:0", source: "writing", topic: "collocation", yours: "make a research" });
    expect(out[0].options[out[0].answer].text).toBe("do research");
    expect(sanitizeQuestions({}, seeds)).toEqual([]);
  });

  it("shuffles options without losing the answer", () => {
    const opts = [{ text: "a", why: "" }, { text: "b", why: "" }, { text: "c", why: "" }, { text: "d", why: "" }];
    for (let i = 0; i < 20; i++) {
      const s = shuffleOptions(opts, 2);
      expect(s.options[s.answer].text).toBe("c");
      expect(s.options.map((o) => o.text).sort()).toEqual(["a", "b", "c", "d"]);
    }
  });

  it("hides the answer from the browser and reveals it after answering", () => {
    const question = q("q1", "k", 0);
    expect(toClientQuestion(question)).toEqual({ id: "q1", source: "writing", date: "2026-11-20", topic: "prepositions", prompt: "Completa", question: "x ___", options: ["a", "b", "c"] });
    expect(reveal(question, 1)).toEqual({ id: "q1", choice: 1, correct: false, answer: 0, why: "B is wrong", rightWhy: "A is right", yours: "b" });
    expect(reveal(question, 0)).toMatchObject({ correct: true, why: "" });
    expect(reveal({ ...question, options: [] }, 2)).toMatchObject({ why: "", rightWhy: "" });
  });
});

// ─── Teacher ─────────────────────────────────────────────────────────────────

const draft = (text: string, issues: { quote: string; correction: string; tag: string; explanation?: string }[], day: number): MarkedDraft => ({
  text,
  createdAt: new Date(`2026-11-${day}T10:00:00Z`),
  feedback: { issues: issues.map((i) => ({ start: 0, end: 0, category: "grammar", explanation: "", ...i })) } as unknown as WritingEvaluation,
});

describe("teacher diagnosis", () => {
  it("finds the sentence around an error and cuts runaway sentences", () => {
    const text = "First one. The aim is to reach to all the parts. Last one!";
    const at = text.indexOf("to all the parts");
    expect(sentenceAround(text, at, at + 16)).toBe("The aim is to reach to all the parts.");
    const long = `${"word ".repeat(80)}ERROR${" word".repeat(80)}`;
    const i = long.indexOf("ERROR");
    const cut = sentenceAround(long, i, i + 5);
    expect(cut.startsWith("…") && cut.endsWith("…")).toBe(true);
    expect(cut).toContain("ERROR");
  });

  it("counts errors by tag across writings, newest examples first", () => {
    const drafts = [
      draft("I depend of you. I am interested on it.", [{ quote: "depend of", correction: "depend on", tag: "prepositions" }, { quote: "interested on", correction: "interested in", tag: "prepositions" }], 20),
      draft("She make a research.", [{ quote: "make a research", correction: "do research", tag: "collocation" }, { quote: "missing", correction: "x", tag: "prepositions" }, { quote: "x", correction: "y", tag: "other" }], 22),
    ];
    const d = diagnose(drafts, 1);
    expect(d.map((x) => [x.tag, x.count, x.writings])).toEqual([["prepositions", 3, 2], ["collocation", 1, 1]]);
    expect(d[0].examples).toHaveLength(1);
    expect(d[0].examples[0].quote).toBe("depend of");
    expect(diagnose([draft("t", [], 1)])).toEqual([]);
  });

  it("counts the mistakes made after a lesson", () => {
    const drafts = [
      draft("a", [{ quote: "a", correction: "b", tag: "articles" }], 10),
      draft("b", [{ quote: "a", correction: "b", tag: "articles" }, { quote: "c", correction: "d", tag: "spelling" }], 25),
    ];
    expect(errorsSince(drafts, "articles", new Date("2026-11-20"))).toEqual({ errors: 1, writings: 1 });
  });

  it("only teaches real tags", () => {
    expect(isTeachable("prepositions")).toBe(true);
    expect(isTeachable("other")).toBe(false);
    expect(isTeachable(3)).toBe(false);
  });
});

describe("teacher lessons", () => {
  const mistakes: OwnMistake[] = [{ sentence: "I depend of you.", quote: "depend of", correction: "depend on", explanation: "" }];
  const good = {
    title: "Preposiciones", intro: "Intro", tip: "Tip",
    rules: [{ title: "Rule", explanation: "Explained", examples: [{ wrong: "depend of", right: "depend on" }, { wrong: "x" }] }, { title: "", explanation: "no title" }],
    exercises: [
      { kind: "fix", sentence: "I depend of you.", highlight: "depend of", accepted: ["depend on"], explanation: "e" },
      { kind: "fix", sentence: "No highlight here.", highlight: "missing", accepted: ["x"] },
      { kind: "fix", sentence: "Same as highlight.", highlight: "Same", accepted: ["same"] },
      { kind: "gap", sentence: "She is good ___ maths.", hint: "preposition", accepted: "at / in", explanation: "e" },
      { kind: "gap", sentence: "It depends ___ (on) you.", accepted: ["on"] },
      { kind: "gap", sentence: "No gap here.", accepted: ["x"] },
      { type: "choice", question: "I'm interested ___ art.", options: ["in", "on", "at"], answer: 0, explanation: "e" },
      { kind: "choice", question: "Dup", options: ["in", "In", "at"], answer: 0 },
      { kind: "choice", question: "Bad index", options: ["in", "on"], answer: 5 },
      { kind: "choice", question: "Married ___ him.", options: ["to", "with", "for"], answer: "0" },
      { kind: "gap", sentence: "Arrive ___ the airport.", accepted: ["at"] },
      { kind: "gap", sentence: "Afraid ___ dogs.", accepted: ["of"] },
      { kind: "essay" },
    ],
  };

  it("keeps the valid parts of a generated lesson", () => {
    const made = sanitizeLesson(good, mistakes)!;
    expect(made.lesson.rules).toHaveLength(1);
    expect(made.lesson.rules[0].examples).toEqual([{ wrong: "depend of", right: "depend on" }]);
    expect(made.exercises.map((e) => e.kind)).toEqual(["fix", "gap", "choice", "choice", "gap", "gap"]);
    expect(made.exercises[0]).toMatchObject({ id: "e1", own: true });
    expect((made.exercises[1] as Extract<LessonExercise, { kind: "gap" }>).accepted).toEqual(["at", "in"]);
    expect(made.lesson.mistakes).toBe(mistakes);
  });

  it("gives every vocabulary gap a clue that pins the answer down", () => {
    // Regression: "It is vital that we ___ the root causes (verb)" fitted several verbs.
    expect(gapHint("verb", "address")).toBe("verb · a______");
    expect(gapHint("Verbo", "carry out")).toBe("Verbo · c____ ___");
    expect(gapHint("", "enhance")).toBe("e______");
    expect(gapHint("verbo: abordar, hacer frente a", "address")).toBe("verbo: abordar, hacer frente a");
    expect(gapHint("SUCCESS", "successful")).toBe("SUCCESS");
    // Short answers are decided by the grammar; a letter would give them away.
    expect(gapHint("preposition", "at")).toBe("preposition");
    expect(gapHint("", "the")).toBe("");
    expect(gapHint("noun", "news")).toBe("noun");
    expect(letterHint("well-being")).toBe("w___-_____");

    const made = sanitizeLesson({ ...good, exercises: [...good.exercises.slice(0, 3), { kind: "gap", sentence: "We must ___ the root causes.", hint: "verb", accepted: ["address", "tackle"] }, ...good.exercises.slice(3)] }, mistakes)!;
    const gap = made.exercises.find((e) => e.kind === "gap" && e.sentence.startsWith("We must"));
    expect(gap).toMatchObject({ hint: "verb · a______" });
    expect(toClientExercise(gap!)).toMatchObject({ hint: "verb · a______" });
  });

  it("rejects lessons that can't be used", () => {
    expect(sanitizeLesson(null, [])).toBeNull();
    expect(sanitizeLesson({ ...good, title: "" }, [])).toBeNull();
    expect(sanitizeLesson({ ...good, exercises: good.exercises.slice(0, 3) }, [])).toBeNull();
  });

  it("checks answers: normalised, alternatives, the whole corrected sentence, and choice indexes", () => {
    const made = sanitizeLesson(good, mistakes)!;
    const [fix, gap, choice] = made.exercises;
    expect(checkExercise(fix, "  Depend On. ").ok).toBe(true);
    expect(checkExercise(fix, "I depend on you").ok).toBe(true);
    expect(checkExercise(fix, "").ok).toBe(false);
    expect(checkExercise(gap, "in").ok).toBe(true);
    expect(checkExercise(gap, "on")).toMatchObject({ ok: false, expected: "at" });
    expect(checkExercise(choice, "0")).toMatchObject({ ok: true, expected: "in" });
    expect(checkExercise(choice, "abc").ok).toBe(false);
    expect(normalizeAnswer("“Don’t”!")).toBe("don't");
    // Regression: a quote followed by punctuation used to leave the quote behind.
    expect(normalizeAnswer('"on".')).toBe("on");
    expect(checkExercise(gap, '"at".').ok).toBe(true);
  });

  it("describes exercises for the AI and strips answers for the browser", () => {
    const made = sanitizeLesson(good, mistakes)!;
    const [fix, gap, choice] = made.exercises;
    expect(describeExercise(fix)).toMatch(/Correct the part "depend of"/);
    expect(describeExercise(gap)).toMatch(/hint: preposition/);
    expect(describeExercise(choice)).toMatch(/Options: "in", "on", "at"/);
    expect(toClientExercise(fix)).toEqual({ id: "e1", kind: "fix", sentence: "I depend of you.", highlight: "depend of", own: true });
    expect(toClientExercise(gap)).not.toHaveProperty("accepted");
    expect(toClientExercise(choice)).not.toHaveProperty("answer");
  });

  it("reads old (array) and new (object) stored feedback", () => {
    const results = [{ id: "e1", given: "x", ok: false, expected: "y", explanation: "" }];
    expect(readLessonFeedback(results)).toEqual({ results, comment: "" });
    expect(readLessonFeedback({ results, comment: "Bien" })).toEqual({ results, comment: "Bien" });
    expect(readLessonFeedback({ results, comment: 3 })).toEqual({ results, comment: "" });
    expect(readLessonFeedback("nope")).toBeNull();
  });
});

// ─── Translation ─────────────────────────────────────────────────────────────

describe("translation drill", () => {
  it("offers fixed round sizes with a time estimate", () => {
    expect(isRoundSize(12)).toBe(true);
    expect(isRoundSize(7)).toBe(false);
    expect(isRoundSize("8")).toBe(false);
    expect(DEFAULT_ROUND).toBe(8);
    expect(roundMinutes(5)).toBe(3);
    expect(roundMinutes(15)).toBe(10);
    expect(roundMinutes(1)).toBe(3);
  });

  it("has structures for every level", () => {
    for (const l of EXAM_LEVEL_VALUES) expect(LEVEL_STRUCTURES[l].length).toBeGreaterThanOrEqual(8);
  });

  it("gives hints from least to most revealing", () => {
    const item = { id: "t1", source: "Ojalá…", reference: "I wish the government would invest more in renewable energy.", structure: "wish + would", pattern: "wish + would + verb", words: [{ from: "invirtiera", to: "invest" }] };
    expect(hintsFor(item).map((h) => h.kind)).toEqual(["pattern", "words", "start"]);
    // First third of 11 words → 4.
    expect(sentenceStart(item.reference)).toBe("I wish the government…");
    expect(sentenceStart("Go now")).toBe("Go…");
    const old = { id: "t2", source: "x", reference: "It is said that it works.", structure: "impersonal passive" };
    expect(hintsFor(old)).toEqual([{ kind: "pattern", text: "impersonal passive" }, { kind: "start", text: "It is said…" }]);
  });

  it("validates generated items and their hints", () => {
    const raw = {
      items: [
        { source: "Si hubiera sabido la verdad…", reference: "If I had known the truth…", structure: "third conditional", pattern: "If + past perfect", words: [{ from: "verdad", to: "truth" }, { from: "x", to: "a b c d e" }, { from: "", to: "y" }] },
        { source: "short", reference: "short" },
        { source: "Otra frase bastante larga", reference: "Another long enough sentence" },
        { source: "Una tercera frase larga", reference: "A third long sentence here" },
      ],
    };
    const items = sanitizeItems(raw, 2);
    expect(items.map((i) => i.id)).toEqual(["t1", "t2"]);
    expect(items[0].words).toEqual([{ from: "verdad", to: "truth" }]);
    expect(items[1]).not.toHaveProperty("pattern");
    expect(sanitizeItems(null, 8)).toEqual([]);
  });

  it("validates the checker's verdict and drops a 'natural' version that adds nothing", () => {
    expect(sanitizeResult({ verdict: "almost", corrected: "I went.", note: "Tense", natural: "I went" }, "I go.")).toEqual({ answer: "I go.", verdict: "almost", corrected: "I went.", note: "Tense", natural: "" });
    expect(sanitizeResult({ verdict: "great" }, "Hi")).toMatchObject({ verdict: "wrong", corrected: "Hi" });
    expect(sanitizeResult(null, "Hi").verdict).toBe("wrong");
    expect(sanitizeResult({ verdict: "correct", corrected: "Hi.", natural: "Hello there." }, "Hi.").natural).toBe("Hello there.");
  });

  it("matches the reference ignoring case and punctuation, and scores the round", () => {
    expect(matchesReference("i wish it would STOP", "I wish it would stop.")).toBe(true);
    expect(matchesReference("I wish it stops", "I wish it would stop.")).toBe(false);
    const r = (verdict: "correct" | "almost" | "wrong") => ({ answer: "", verdict, corrected: "", note: "", natural: "" });
    expect(roundScore([r("correct"), r("almost"), r("wrong"), r("correct")], 4)).toBe(63);
    expect(roundScore([], 0)).toBe(0);
  });
});
