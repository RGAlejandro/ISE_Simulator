import { describe, expect, it } from "vitest";
import {
  QUIZ_KINDS, QUIZ_SENSES, baseType, buildListQuiz, canQuiz, gapSentence, makeQuestion, quizPool,
  type ListQuizQuestion, type QuizWord,
} from "@/lib/vocab-quiz";

/** Seeded random numbers, so every shuffle is repeatable. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const w = (english: string, translation: string, partOfSpeech: string | null = "verb", example = ""): QuizWord & { id: string } =>
  ({ id: english, english, translation, partOfSpeech, example });

const list = [
  w("decipher", "descifrar", "verb", "She finally deciphered the code."),
  w("convey", "transmitir", "verb", "Words can't convey how I feel."),
  w("amplify", "amplificar", "verb · transitive", "The speakers amplify the sound."),
  w("comprehend", "comprender", "verb", "I can't comprehend it."),
  w("ledger", "libro de cuentas", "noun", "He checked the ledger."),
  w("bleak", "sombrío", "adjective", "The future looks bleak."),
];

const right = (q: ListQuizQuestion) => q.options[q.answer];
const texts = (q: ListQuizQuestion) => q.options.map((o) => o.text);

describe("vocab quiz helpers", () => {
  it("takes the base word type", () => {
    expect(baseType("Verb · transitive")).toBe("verb");
    expect(baseType(null)).toBe("");
    expect(baseType(undefined)).toBe("");
  });

  it("gaps the word in its example, also inflected", () => {
    expect(gapSentence("She finally deciphered the code.", "decipher")).toEqual({ sentence: "She finally ______ the code.", found: true });
    expect(gapSentence("Bees thrive here.", "thrive")).toEqual({ sentence: "Bees ______ here.", found: true });
    expect(gapSentence("Nothing here.", "thrive")).toEqual({ sentence: "Nothing here.", found: false });
    expect(gapSentence("Any text.", "  ")).toEqual({ sentence: "Any text.", found: false });
    // Regex characters in the word are taken literally.
    expect(gapSentence("Use c++ daily.", "c++").found).toBe(false);
    expect(gapSentence("A (rare) case.", "(rare").found).toBe(false);
  });

  it("builds a pool of distinct words, the list's own first", () => {
    const pool = quizPool(
      [w("Convey", "transmitir"), w("convey ", "otra"), w("relay", "Transmitir "), w("", "vacío"), w("blank", " ")],
      [w("thrive", "prosperar"), w("convey", "x")],
    );
    expect(pool.map((p) => p.english)).toEqual(["Convey", "thrive"]);
    expect(canQuiz(pool)).toBe(false);
    expect(canQuiz(quizPool(list))).toBe(true);
  });
});

describe("makeQuestion", () => {
  const pool = quizPool(list);
  const inList = new Set(list.map((c) => c.english));

  it("asks for the meaning with three other translations, same type first", () => {
    for (let seed = 1; seed < 20; seed++) {
      const q = makeQuestion(list[0], "meaning", pool, inList, seeded(seed))!;
      expect(q.kind).toBe("meaning");
      expect(q.prompt).toBe("decipher");
      expect(q.options).toHaveLength(4);
      expect(right(q)).toEqual({ text: "descifrar", pair: "decipher" });
      // The three other verbs win over the noun and the adjective.
      expect(texts(q).sort()).toEqual(["amplificar", "comprender", "descifrar", "transmitir"]);
    }
  });

  it("asks for the English word from the translation", () => {
    const q = makeQuestion(list[1], "word", pool, inList, seeded(3))!;
    expect(q.prompt).toBe("transmitir");
    expect(right(q)).toEqual({ text: "convey", pair: "transmitir" });
    expect(texts(q)).not.toContain("transmitir");
  });

  it("plays the word in the listening question", () => {
    const q = makeQuestion(list[2], "listen", pool, inList, seeded(5))!;
    expect(q.prompt).toBe("");
    expect(right(q).text).toBe("amplificar");
  });

  it("fills a gap with other word types first, so only one option fits", () => {
    const q = makeQuestion(list[0], "gap", pool, inList, seeded(7))!;
    expect(q.prompt).toBe("She finally ______ the code.");
    expect(right(q).text).toBe("decipher");
    const wrong = q.options.filter((_, i) => i !== q.answer).map((o) => o.text);
    expect(wrong).toEqual(expect.arrayContaining(["ledger", "bleak"]));
  });

  it("can't make a gap when the word isn't in its example", () => {
    expect(makeQuestion(w("thrive", "prosperar", "verb", "No match."), "gap", pool, inList)).toBeNull();
    expect(makeQuestion(w("thrive", "prosperar", "verb"), "gap", pool, inList)).toBeNull();
    expect(makeQuestion({ english: "thrive", translation: "prosperar", partOfSpeech: "verb" }, "gap", pool, inList)).toBeNull();
  });

  it("prefers words from the list over the learner's other words", () => {
    const extra = [w("thrive", "prosperar"), w("vanish", "desaparecer"), w("yield", "ceder")];
    const small = list.slice(0, 4);
    const q = makeQuestion(small[0], "meaning", quizPool(small, extra), new Set(small.map((c) => c.english)), seeded(2))!;
    expect(texts(q).sort()).toEqual(["amplificar", "comprender", "descifrar", "transmitir"]);
  });

  it("never repeats an option and needs three wrong ones", () => {
    const twins = [w("a", "uno"), w("b", "uno"), w("c", "dos"), w("d", "tres")];
    // Not de-duplicated on purpose: the question itself must skip "uno" twice.
    const q = makeQuestion(w("e", "cuatro"), "meaning", twins, new Set(), seeded(4))!;
    expect(new Set(texts(q)).size).toBe(4);
    expect(makeQuestion(list[0], "meaning", list.slice(0, 3), inList)).toBeNull();
  });
});

describe("buildListQuiz", () => {
  it("gives every card a question and takes turns between the kinds", () => {
    const deck = list.slice(0, 4);
    const quiz = buildListQuiz(deck, { list, rng: () => 0 });
    expect(Object.keys(quiz)).toEqual(deck.map((c) => c.id));
    expect(deck.map((c) => quiz[c.id].kind)).toEqual([...QUIZ_KINDS]);
    for (const c of deck) {
      const q = quiz[c.id];
      expect(q.options).toHaveLength(4);
      expect([c.english, c.translation]).toContain(right(q).text);
    }
  });

  it("moves to the next kind when a card has no gap", () => {
    const deck = [list[0], w("relay", "retransmitir", "verb", "No match here.")];
    const quiz = buildListQuiz(deck, { list, rng: () => 0.3 });
    // Turns start at "word"; "relay" gets "gap", which its example can't take → "listen".
    expect(quiz.decipher.kind).toBe("word");
    expect(quiz.relay.kind).toBe("listen");
  });

  it("asks the missed words with the whole list as options", () => {
    const missed = [list[0]];
    expect(buildListQuiz(missed)).toEqual({});
    const quiz = buildListQuiz(missed, { list, rng: seeded(9) });
    expect(Object.keys(quiz)).toEqual(["decipher"]);
  });

  it("uses the learner's other words when the list is short", () => {
    const short = [w("decipher", "descifrar"), w("convey", "transmitir")];
    expect(buildListQuiz(short)).toEqual({});
    const quiz = buildListQuiz(short, { extra: [w("thrive", "prosperar"), w("vanish", "desaparecer")], rng: seeded(11) });
    expect(Object.keys(quiz).sort()).toEqual(["convey", "decipher"]);
  });

  it("asks only the kinds the learner chose", () => {
    const text = buildListQuiz(list, { kinds: QUIZ_SENSES.text, rng: seeded(13) });
    expect(Object.values(text).map((q) => q.kind)).not.toContain("listen");
    expect(new Set(Object.values(text).map((q) => q.kind))).toEqual(new Set(["meaning", "word", "gap"]));
    const audio = buildListQuiz(list, { kinds: QUIZ_SENSES.audio, rng: seeded(13) });
    expect(Object.keys(audio)).toHaveLength(list.length);
    expect(Object.values(audio).every((q) => q.kind === "listen" && q.prompt === "")).toBe(true);
    expect(QUIZ_SENSES.both).toEqual(QUIZ_KINDS);
  });

  it("works with the default random numbers", () => {
    const quiz = buildListQuiz(list);
    expect(Object.keys(quiz)).toHaveLength(list.length);
  });
});
