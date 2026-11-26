import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma")).prismaMock }));
const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("@/lib/ai-provider", () => ({ generateJSON: vi.fn() }));

import { db, resetDb } from "../helpers/prisma";
import { generateJSON } from "@/lib/ai-provider";
import { getReviewQueue } from "@/lib/srs-server";
import { createListWithWords } from "@/lib/vocab-lists";
import { OFFICIAL_FILE_TYPES, readUploads, requireProUser } from "@/lib/official-server";
import { markWritingText } from "@/lib/writing-marking";
import { GENRE_GUIDES, READING_INTO_WRITING_SECTION, genreFamily, phraseForInsert } from "@/lib/writing-phrases";

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
});

describe("review queue", () => {
  it("adds the new words left in today's allowance", async () => {
    db("savedWord", "count").mockResolvedValueOnce(5).mockResolvedValueOnce(20);
    db("reviewLog", "findMany")
      .mockResolvedValueOnce([{ wordId: "a" }, { wordId: "b" }, { wordId: "c" }])
      .mockResolvedValueOnce([{ wordId: "a" }]);
    // 3 reviewed today, 1 of them seen before → 2 new today; 8 - 2 = 6 left.
    expect(await getReviewQueue("u1", new Date("2026-11-25T12:00:00"))).toEqual({ due: 5, newLeft: 6, total: 11, reviewedToday: true });
  });

  it("never offers more new words than are unstudied", async () => {
    db("savedWord", "count").mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    db("reviewLog", "findMany").mockResolvedValueOnce([]);
    expect(await getReviewQueue("u1")).toEqual({ due: 0, newLeft: 2, total: 2, reviewedToday: false });
    expect(db("reviewLog", "findMany")).toHaveBeenCalledTimes(1);
  });
});

describe("createListWithWords", () => {
  it("skips words already saved (any case) and creates the rest in one go", async () => {
    db("savedWord", "findMany").mockResolvedValue([{ english: "Give up" }]);
    db("vocabularyList", "create").mockResolvedValue({ id: "l1", name: "Unit 4" });
    db("savedWord", "createMany").mockResolvedValue({ count: 1 });
    const words = [
      { english: "give up", spanish: "rendirse", example: "", partOfSpeech: null, level: "B1" as const },
      { english: "carry on", spanish: "seguir", example: "e", partOfSpeech: "phrasal verb", level: "B2" as const },
    ];
    const r = await createListWithWords("u1", "Unit 4", "📚", words);
    expect(r).toEqual({ list: { id: "l1", name: "Unit 4" }, added: 1, skipped: ["give up"] });
    expect(db("savedWord", "createMany").mock.calls[0][0].data).toEqual([
      { userId: "u1", listId: "l1", english: "carry on", spanish: "seguir", example: "e", partOfSpeech: "phrasal verb", level: "B2" },
    ]);
  });
});

describe("official papers: access and uploads", () => {
  it("only lets signed-in Pro users in", async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    expect((await requireProUser()).error?.status).toBe(401);
    clerk.auth.mockResolvedValue({ userId: "c" });
    db("user", "findUnique").mockResolvedValue(null);
    clerk.currentUser.mockResolvedValue(null);
    expect((await requireProUser()).error?.status).toBe(404);
    db("user", "findUnique").mockResolvedValue({ plan: "FREE" });
    const free = await requireProUser();
    expect(free.error?.status).toBe(403);
    expect(await free.error?.json()).toMatchObject({ upsell: true });
    db("user", "findUnique").mockResolvedValue({ id: "u1", plan: "ADMIN" });
    expect((await requireProUser()).user).toMatchObject({ id: "u1" });
  });

  it("validates file types, count and size, and encodes them", async () => {
    const pdf = new File(["%PDF"], "p.pdf", { type: "application/pdf" });
    expect(await readUploads([])).toEqual({ error: "files" });
    expect(await readUploads([new File(["x"], "a.txt", { type: "text/plain" })])).toEqual({ error: "files" });
    expect(await readUploads(Array.from({ length: 16 }, () => pdf))).toEqual({ error: "files" });
    const huge = new File([new Uint8Array(19 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    expect(await readUploads([huge])).toEqual({ error: "files" });
    expect(await readUploads([pdf])).toEqual({ parts: [{ data: Buffer.from("%PDF").toString("base64"), mimeType: "application/pdf" }] });
    expect(OFFICIAL_FILE_TYPES).toContain("image/heic");
  });
});

describe("markWritingText", () => {
  const text = "Bees is important for farming and food.";
  const task = { title: "Bees", prompt: "Write an essay about bees.", bulletPoints: [], wordLimit: { min: 150, max: 180 }, minutes: 45 };
  const good = {
    criteria: { taskFulfilment: { score: 3 }, organisation: { score: 2 }, languageControl: { score: 2 } },
    issues: [{ quote: "Bees is", correction: "Bees are", tag: "subject-verb-agreement" }],
  };

  it("marks the text and retries once when the first answer is unusable", async () => {
    vi.mocked(generateJSON).mockResolvedValueOnce({ criteria: {} }).mockResolvedValueOnce(good);
    const r = await markWritingText({ level: "ISE_II", taskType: "EXTENDED_WRITING", genre: "essay", task, text, locale: "es" });
    expect(r?.score).toBe(2.33);
    expect(r?.wordCount).toBe(7);
    expect(r?.evaluation.issues).toHaveLength(1);
    expect(vi.mocked(generateJSON).mock.calls[0][1]).toMatchObject({ prefer: "gemini" });
  });

  it("passes the previous scores on a rewrite, and gives up after two failures", async () => {
    vi.mocked(generateJSON).mockResolvedValue(null);
    const previous = { version: 1, feedback: { criteria: { taskFulfilment: { score: 1 } } } as never };
    expect(await markWritingText({ level: "ISE_II", taskType: "EXTENDED_WRITING", genre: "essay", task, text, locale: "es", previous })).toBeNull();
    expect(vi.mocked(generateJSON).mock.calls[0][0]).toMatch(/version 1|previous/i);
  });
});

describe("writing phrase bank", () => {
  it("inserts the first alternative without grammar hints", () => {
    expect(phraseForInsert("Consequently, … / As a result, …")).toBe("Consequently, …");
    expect(phraseForInsert("It is worth (+ -ing) noting that…")).toBe("It is worth noting that …");
    expect(phraseForInsert("a · b")).toBe("a");
  });

  it("maps every Trinity genre label to a guide", () => {
    const cases: [string, string][] = [
      ["descriptive essay", "descriptive-essay"], ["argumentative essay", "argumentative-essay"], ["essay", "discursive-essay"],
      ["discursive essay", "discursive-essay"], ["magazine article", "article"], ["informal email", "informal-letter"],
      ["formal letter", "formal-letter"], ["email", "formal-letter"], ["film review", "review"], ["proposal", "proposal"],
      ["critique", "critique"], ["report", "report"], ["story", "report"],
    ];
    for (const [genre, family] of cases) expect(genreFamily(genre)).toBe(family);
    for (const g of Object.values(GENRE_GUIDES)) expect(g.sections.length).toBeGreaterThan(0);
    expect(READING_INTO_WRITING_SECTION.phrases.length).toBeGreaterThan(0);
  });
});

describe("prisma client", () => {
  it("reuses one client in development", async () => {
    vi.doUnmock("@/lib/prisma");
    vi.resetModules();
    vi.doMock("@prisma/client", () => ({ PrismaClient: class { tag = "real"; } }));
    const g = globalThis as unknown as { prisma?: unknown };
    delete g.prisma;
    const { prisma } = await import("@/lib/prisma");
    expect(prisma).toMatchObject({ tag: "real" });
    expect(g.prisma).toBe(prisma);
    delete g.prisma;
  });
});
