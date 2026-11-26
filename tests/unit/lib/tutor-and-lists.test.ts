import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gemini", () => ({ geminiGenerateChatJSONWithFiles: vi.fn(), geminiVideoJSON: vi.fn() }));
vi.mock("@/lib/groq", () => ({ groqReadImageJSON: vi.fn() }));

import { geminiGenerateChatJSONWithFiles, geminiVideoJSON } from "@/lib/gemini";
import { groqReadImageJSON } from "@/lib/groq";
import {
  MAX_BULK_WORDS, MAX_PHOTO_LIST_WORDS, MAX_TUTOR_PHOTOS, PRACTICE_MODULES, cleanHeadword, practiceHref, sanitizeTutorResponse, sanitizeWord, sanitizeWords,
} from "@/lib/tutor";
import { extractPhotoLists, photoListActions, photoListSummary, sanitizePhotoListMode, unreadableNote, type PhotoList } from "@/lib/photo-lists";
import { asksForList, readYouTubeVideo, videoListAction, videoMessage, videoSummaryForTutor, type VideoRead } from "@/lib/video-lists";

const word = (english: string, extra: Record<string, unknown> = {}) => ({ english, spanish: "es", example: "ex", partOfSpeech: "verb", level: "b2", ...extra });

describe("tutor: headwords", () => {
  it("moves grammar notes and the infinitive 'to' out of the headword", () => {
    expect(cleanHeadword("to tell off (t)", "phrasal verb")).toEqual({ english: "tell off", partOfSpeech: "phrasal verb · transitive" });
    expect(cleanHeadword("get on (with/behind)", "phrasal verb")).toEqual({ english: "get on", partOfSpeech: "phrasal verb · + with/behind" });
    expect(cleanHeadword("put up with sth.", "")).toEqual({ english: "put up with", partOfSpeech: "" });
    expect(cleanHeadword("look after [i, sep]", "verb").partOfSpeech).toBe("verb · intransitive & separable");
    expect(cleanHeadword("to be honest", "phrase").english).toBe("to be honest");
    expect(cleanHeadword("to some extent", "phrase").english).toBe("to some extent");
    expect(cleanHeadword("()", "x").english).toBe("()");
  });

  it("validates words: level, translation, duplicates and the cap", () => {
    expect(sanitizeWord(word("give up"))).toMatchObject({ english: "give up", level: "B2" });
    expect(sanitizeWord(word("x", { level: "Z9" }))?.level).toBe("B1");
    expect(sanitizeWord({ english: "dog", translation: "perro" })).toMatchObject({ spanish: "perro", partOfSpeech: null });
    expect(sanitizeWord(word("123"))).toBeNull();
    expect(sanitizeWord(word("dog", { spanish: "" }))).toBeNull();
    expect(sanitizeWord(null)).toBeNull();
    expect(sanitizeWords([word("Dog"), word("dog"), word("cat"), null, word("owl")], 2).map((w) => w.english)).toEqual(["Dog", "cat"]);
    expect(sanitizeWords("nope", 5)).toEqual([]);
  });
});

describe("tutor: actions", () => {
  it("maps every practice module to an in-app route", () => {
    for (const m of PRACTICE_MODULES) expect(practiceHref(m)).toMatch(/^\//);
    expect(practiceHref("writing", { writingType: "EXTENDED_WRITING" })).toBe("/writing?type=EXTENDED_WRITING");
    expect(practiceHref("writing", { writingType: "hack" })).toBe("/writing");
    expect(practiceHref("quiz")).toBe("/quiz");
  });

  it("keeps a safe, bounded response", () => {
    const r = sanitizeTutorResponse({
      reply: `  ${"x".repeat(5000)} `,
      actions: [
        { type: "create_vocab_list", name: "", words: [word("give up")] },
        { type: "create_vocab_list", name: "Second", words: [word("carry on")] },
        { type: "practice", module: "writing", label: "Write", params: { writingType: "READING_INTO_WRITING" } },
        { type: "practice", module: "writing", label: "Again", params: { writingType: "READING_INTO_WRITING" } },
        { type: "practice", module: "hacker", label: "x" },
        { type: "practice", module: "quiz", label: "" },
        { type: "set_goal", examModules: "READING_WRITING", targetBand: "MERIT", examLevel: "ISE_III", examDate: "2026-12-02" },
        { type: "evil" },
      ],
      usedData: ["readiness", "readiness", "secrets", 3],
    });
    expect(r.reply).toHaveLength(4000);
    expect(r.actions.map((a) => a.type)).toEqual(["create_vocab_list", "practice", "set_goal"]);
    expect(r.actions[0]).toMatchObject({ name: "My word list" });
    expect(r.actions[1]).toMatchObject({ href: "/writing?type=READING_INTO_WRITING" });
    expect(r.actions[2]).toEqual({ type: "set_goal", examModules: "READING_WRITING", targetBand: "MERIT", examLevel: "ISE_III", examDate: "2026-12-02" });
    expect(r.usedData).toEqual(["readiness"]);
  });

  it("drops empty or invalid actions", () => {
    const r = sanitizeTutorResponse({
      actions: [
        { type: "create_vocab_list", words: [] },
        { type: "set_goal", examDate: "2 Dec", targetBand: "A+" },
        { type: "set_goal", examDate: "2026-12-02" },
        { type: "set_goal", targetBand: "PASS" },
        { type: "practice", module: "oral", label: "Speak" },
        { type: "practice", module: "live", label: "Live" },
        { type: "practice", module: "review", label: "Review" },
      ],
    });
    expect(r.actions.map((a) => a.type)).toEqual(["set_goal", "practice", "practice"]);
    expect(sanitizeTutorResponse(null)).toEqual({ reply: "", actions: [], usedData: [] });
  });
});

describe("photo lists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads each photo with Gemini and falls back to Groq", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(geminiGenerateChatJSONWithFiles)
      .mockResolvedValueOnce({ title: " Unit 4 ", words: [word("give up")], skipped: 2.4 })
      .mockRejectedValueOnce(new Error("bad image"));
    vi.mocked(groqReadImageJSON).mockResolvedValueOnce({ title: "", words: [], skipped: 0 });
    const lists = await extractPhotoLists([{ data: "a", mimeType: "image/png" }, { data: "b", mimeType: "image/png" }], { instruction: "all", level: "ISE_III" });
    expect(lists[0]).toMatchObject({ index: 0, title: "Unit 4", skipped: 2, failed: false });
    expect(lists[1]).toMatchObject({ failed: true, busy: false });
  });

  it("retries photos that hit a rate limit, and reports busy failures", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(geminiGenerateChatJSONWithFiles).mockRejectedValue(new Error("429 quota"));
    vi.mocked(groqReadImageJSON).mockRejectedValue(new Error("rate_limit"));
    const lists = await extractPhotoLists([{ data: "a", mimeType: "image/png" }], { instruction: "", level: null });
    expect(lists[0]).toMatchObject({ failed: true, busy: true });
    expect(groqReadImageJSON).toHaveBeenCalledTimes(2);
  });

  const list = (index: number, title: string, words: string[], extra: Partial<PhotoList> = {}): PhotoList =>
    ({ index, title, words: words.map((w) => sanitizeWord(word(w))!), skipped: 0, failed: false, busy: false, ...extra });

  it("groups words per photo or in one list, as the tutor chose", () => {
    const lists = [list(0, "Unit 4", ["give up", "carry on"]), list(1, "", ["Give up", "set off"]), list(2, "", [], { failed: true })];
    expect(sanitizePhotoListMode({ mode: "single", name: "  My  list " })).toEqual({ mode: "single", name: "My list" });
    expect(sanitizePhotoListMode({ mode: "per_photo" })).toEqual({ mode: "per_photo", name: "" });
    const per = photoListActions(lists, { mode: "per_photo", name: "" }, "es");
    expect(per.map((a) => a.type === "create_vocab_list" && a.name)).toEqual(["Unit 4", "Foto 2"]);
    const single = photoListActions(lists, { mode: "single", name: "" }, "en");
    expect(single).toHaveLength(1);
    expect(single[0].type === "create_vocab_list" && single[0].words.map((w) => w.english)).toEqual(["give up", "carry on", "set off"]);
    expect(single[0]).toMatchObject({ name: "Unit 4" });
    expect(photoListActions(lists, { mode: "single", name: "Phrasal verbs" }, "en")[0]).toMatchObject({ name: "Phrasal verbs" });
    expect(photoListActions(lists, { mode: "none", name: "" }, "es")).toEqual([]);
    expect(photoListActions([list(0, "", ["owl"])], { mode: "per_photo", name: "" }, "xx")[0]).toMatchObject({ name: "Foto 1" });
    expect(photoListActions([list(0, "", [], { failed: true }), list(1, "", ["owl"])], { mode: "single", name: "" }, "es")[0]).toMatchObject({ name: "Foto 2" });
  });

  it("merges every photo into one list unless the tutor clearly asks for one per photo", () => {
    // Regression: four photos used to give four lists when the learner didn't say how to group them.
    expect(sanitizePhotoListMode("??")).toEqual({ mode: "single", name: "" });
    expect(sanitizePhotoListMode({ mode: "per-photo" })).toEqual({ mode: "single", name: "" });
    const four = [
      list(0, "Lifestyles", ["thrive"]), list(1, "Family roles", ["sibling"]),
      list(2, "lifestyles", ["cope"]), list(3, "Unit 9 · A very long heading about the environment", ["recycle"]),
    ];
    const merged = photoListActions(four, sanitizePhotoListMode(undefined), "es");
    expect(merged).toHaveLength(1);
    // Headings joined while they fit in a list name; repeated headings only once.
    expect(merged[0]).toMatchObject({ name: "Lifestyles · Family roles" });
    expect(merged[0].type === "create_vocab_list" && merged[0].words).toHaveLength(4);
    const untitled = [list(0, "", ["a"]), list(1, "", ["b"])];
    expect(photoListActions(untitled, { mode: "single", name: "" }, "fr")[0]).toMatchObject({ name: "Mes photos" });
    expect(photoListActions(untitled, { mode: "single", name: "" }, "xx")[0]).toMatchObject({ name: "Mis fotos" });
  });

  it("accepts a merged list of five full photos", () => {
    expect(MAX_BULK_WORDS).toBe(MAX_TUTOR_PHOTOS * MAX_PHOTO_LIST_WORDS);
  });

  it("explains which photos couldn't be read, and summarises them for the tutor", () => {
    const lists = [list(0, "Unit 4", ["give up"], { skipped: 1 }), list(1, "", [], { failed: true }), list(2, "", [], { failed: true, busy: true })];
    expect(unreadableNote(lists, "es")).toMatch(/la foto 2, 3/);
    expect(unreadableNote([list(0, "", [], { failed: true, busy: true })], "en")).toMatch(/busy/);
    expect(unreadableNote([list(0, "", [], { failed: true })], "fr")).toMatch(/la photo 1/);
    expect(unreadableNote([list(0, "x", ["a b"])], "es")).toBe("");
    const s = photoListSummary([...lists, list(3, "", ["owl"])]);
    expect(s).toContain("heading «Unit 4»: 1 words (1 illegible): give up");
    expect(s).toContain("Photo 2: could not be read");
    expect(s).toContain("Photo 3: not read — the AI service was busy");
    expect(s).toContain("Photo 4 — no heading");
  });
});

describe("video lists", () => {
  const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  it("reads a video and keeps only English vocabulary", async () => {
    vi.mocked(geminiVideoJSON).mockResolvedValueOnce({ title: " 50  phrasal verbs ", summary: "Phrasal verbs", english: true, words: [word("give up")] });
    const v = await readYouTubeVideo(url, { instruction: "the phrasal verbs", level: "ISE_III", locale: "es" });
    expect(v).toMatchObject({ title: "50 phrasal verbs", english: true, failed: false });
    expect(v.words).toHaveLength(1);
    vi.mocked(geminiVideoJSON).mockResolvedValueOnce({ title: "Cooking", summary: "x", english: false, words: [word("salt")] });
    expect((await readYouTubeVideo(url, { instruction: "", level: null, locale: "en" })).words).toEqual([]);
    vi.mocked(geminiVideoJSON).mockResolvedValueOnce({});
    expect((await readYouTubeVideo(url, { instruction: "", level: null, locale: "en" })).failed).toBe(true);
  });

  it("tells a busy AI from an unavailable video", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(geminiVideoJSON).mockRejectedValueOnce(new Error("503 overloaded"));
    expect(await readYouTubeVideo(url, { instruction: "", level: null, locale: "es" })).toMatchObject({ failed: true, busy: true });
    vi.mocked(geminiVideoJSON).mockRejectedValueOnce("private video");
    expect(await readYouTubeVideo(url, { instruction: "", level: null, locale: "es" })).toMatchObject({ failed: true, busy: false });
  });

  const v: VideoRead = { url, title: "Phrasal verbs", summary: "S", words: [sanitizeWord(word("give up"))!], english: true, failed: false, busy: false };

  it("proposes a list when asked for vocabulary or when the tutor chose to", () => {
    expect(asksForList("hazme una lista de phrasal verbs")).toBe(true);
    expect(asksForList("summarise it please")).toBe(false);
    expect(videoListAction(v, null, "lista de palabras")[0]).toMatchObject({ name: "Phrasal verbs" });
    expect(videoListAction(v, { create: true, name: " Mine " }, "summary")[0]).toMatchObject({ name: "Mine" });
    expect(videoListAction(v, { create: false }, "summary")).toEqual([]);
    expect(videoListAction({ ...v, words: [] }, { create: true }, "words")).toEqual([]);
    expect(videoListAction({ ...v, title: "" }, null, "words")[0]).toMatchObject({ name: "YouTube" });
  });

  it("summarises the video and has messages in every language", () => {
    expect(videoSummaryForTutor(v)).toContain("Vocabulary found (1): give up");
    expect(videoSummaryForTutor({ ...v, words: [], english: false })).toContain("In English / about English: no");
    expect(videoMessage("busy", "en")).toMatch(/busy/);
    expect(videoMessage("ready", "xx")).toMatch(/He visto/);
  });
});
