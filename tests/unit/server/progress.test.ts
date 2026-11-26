import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma")).prismaMock }));

import { db, resetDb } from "../helpers/prisma";
import { getReadiness, loadReadinessEvidence } from "@/lib/readiness-server";
import { awardXp } from "@/lib/gamification-server";
import { dayStart } from "@/lib/gamification";

const at = new Date("2026-11-20T10:00:00Z");

function evidence(overrides: Partial<Record<string, unknown[]>> = {}) {
  db("writtenExam", "findMany").mockResolvedValue(overrides.written ?? []);
  db("writingDraft", "findMany").mockResolvedValue(overrides.drafts ?? []);
  db("oralExam", "findMany").mockResolvedValue(overrides.orals ?? []);
  db("listeningSession", "findMany").mockResolvedValue(overrides.listening ?? []);
  db("readingSession", "findMany").mockResolvedValue(overrides.reading ?? []);
  db("officialPaper", "findMany").mockResolvedValue(overrides.official ?? []);
}

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
});

describe("readiness evidence", () => {
  it("turns every marked attempt into band-scale observations and criteria", async () => {
    evidence({
      written: [{
        completedAt: at, createdAt: at,
        responses: [
          { taskType: "READING_1", score: 12 }, { taskType: "READING_2", score: 12 },
          { taskType: "READING_INTO_WRITING", score: 12.5, aiFeedback: JSON.stringify({ organisationAndStructure: { score: 3 }, readingAndWriting: { score: 2 }, junk: { score: 4 } }) },
          { taskType: "EXTENDED_WRITING", score: null, aiFeedback: null },
        ],
      }, { completedAt: null, createdAt: at, responses: [{ taskType: "READING_1", score: 10 }] }],
      drafts: [{ score: 2, createdAt: at, feedback: { criteria: { languageControl: { score: 1 }, taskFulfilment: { score: "x" } } } }],
      orals: [{
        completedAt: at, createdAt: at,
        feedback: [
          { taskType: "TOPIC", score: 12, feedback: { delivery: { score: 4 }, languageControl: { score: 3 } } },
          { taskType: "CONVERSATION", score: 14, feedback: "not json" },
          { taskType: "LISTENING", score: 3, feedback: null },
        ],
      }, { completedAt: null, createdAt: at, feedback: [] }],
      listening: [
        { overallScore: 70, round1Response: "The talk is about bees and farms", completedAt: at, createdAt: at },
        { overallScore: 90, round1Response: "asdf qwrt", completedAt: null, createdAt: at },
      ],
      reading: [{ score: 6, total: 8, completedAt: at }],
      official: [
        { readingResult: { correct: 24, total: 30 }, content: { keySource: "paper" }, updatedAt: at },
        { readingResult: { correct: 20, total: 30 }, content: { keySource: "ai" }, updatedAt: at },
        { readingResult: { correct: 3, total: 5 }, content: {}, updatedAt: at },
        { readingResult: null, content: null, updatedAt: at },
      ],
    });
    const { observations, criteria } = await loadReadinessEvidence("u1", "ISE_III");
    const by = (source: string) => observations.filter((o) => o.source === source);
    expect(by("mockReading")).toEqual([{ skill: "reading", value: 80, weight: 1, at, source: "mockReading" }]);
    expect(by("mockWriting")[0].value).toBe(65);
    expect(by("writingLab")[0].value).toBe(50);
    // Mean of the spoken tasks: (12 + 14) / 2 = 13 → Merit line.
    expect(by("oralExam")[0].value).toBe(65);
    expect(by("oralListening")[0].value).toBe(50);
    expect(by("listening")).toHaveLength(1);
    expect(by("officialReading").map((o) => o.weight)).toEqual([1.5, 1]);
    expect(by("readingExplorer")[0]).toMatchObject({ value: 75, weight: 0.35 });
    expect(criteria.filter((c) => c.skill === "writing").map((c) => c.key).sort()).toEqual(["languageControl", "organisation", "readingForWriting"]);
    expect(criteria.filter((c) => c.skill === "speaking")).toHaveLength(2);
  });

  it("skips Reading Explorer for an unknown level", async () => {
    evidence();
    await loadReadinessEvidence("u1", "ISE_X" as never);
    expect(db("readingSession", "findMany")).not.toHaveBeenCalled();
  });
});

describe("getReadiness", () => {
  it("returns nothing for an unknown user or no level", async () => {
    db("user", "findUnique").mockResolvedValueOnce(null);
    expect(await getReadiness("u1")).toEqual({ level: null, report: null });
    db("user", "findUnique").mockResolvedValueOnce({ examLevel: null, examDate: null, examModules: "BOTH", targetBand: "PASS" });
    db("oralExam", "groupBy").mockResolvedValue([]);
    db("writtenExam", "groupBy").mockResolvedValue([]);
    expect(await getReadiness("u1")).toEqual({ level: null, report: null });
  });

  it("uses the goal (module and band) by default, and the most practised level when there's no goal", async () => {
    db("user", "findUnique").mockResolvedValue({ examLevel: null, examDate: new Date("2026-12-02"), examModules: "READING_WRITING", targetBand: "MERIT" });
    db("oralExam", "groupBy").mockResolvedValue([{ level: "ISE_II", _count: 1 }]);
    db("writtenExam", "groupBy").mockResolvedValue([{ level: "ISE_III", _count: 2 }, { level: "ISE_II", _count: 2 }]);
    evidence();
    const r = await getReadiness("u1", { now: at });
    expect(r.level).toBe("ISE_II");
    expect(r.report?.focus).toEqual({ modules: "READING_WRITING", target: "MERIT" });
    // The exam date belongs to another (unset) level here.
    expect(r.report?.projection.examDate).toBeNull();
  });

  it("lets teachers compare everyone on all four skills", async () => {
    db("user", "findUnique").mockResolvedValue({ examLevel: "ISE_III", examDate: new Date("2026-12-02T00:00:00Z"), examModules: "READING_WRITING", targetBand: "MERIT" });
    evidence();
    const r = await getReadiness("u1", { useGoal: false, now: at });
    expect(r.report?.focus).toEqual({ modules: "BOTH", target: "PASS" });
    expect(r.report?.projection.examDate).toBe("2026-12-02");
  });
});

describe("awardXp", () => {
  const stats = (over: Record<string, unknown> = {}) => ({
    xp: 40, currentStreak: 2, longestStreak: 2, lastActiveDate: null, todayXp: 10, totalAnswered: 0, totalCorrect: 0,
    questsDone: 0, achievements: [] as string[], dailyGoal: 30, ...over,
  });

  it("creates stats on first use, starts a streak and unlocks achievements", async () => {
    db("gamificationStats", "findUnique").mockResolvedValue(null);
    db("gamificationStats", "create").mockResolvedValue(stats({ xp: 0, currentStreak: 0, longestStreak: 0 }));
    const r = await awardXp("u1", { correct: 5, total: 6 });
    expect(r).toMatchObject({ xpGained: 55, xp: 55, level: 2, leveledUp: true, currentStreak: 1, todayXp: 55 });
    expect(r.newAchievements.map((a) => a.id)).toEqual(["first_quest"]);
    expect(db("weeklyXp", "upsert").mock.calls[0][0].update).toEqual({ xp: { increment: 55 } });
  });

  it("keeps the streak on the same day and extends it the next day", async () => {
    db("gamificationStats", "findUnique").mockResolvedValue(stats({ xp: 60, lastActiveDate: dayStart() }));
    const same = await awardXp("u1", { correct: 0, total: 0, xp: 20, countsAsQuest: false });
    expect(same).toMatchObject({ currentStreak: 2, todayXp: 30, leveledUp: false });
    const yesterday = new Date(dayStart().getTime() - 86_400_000);
    db("gamificationStats", "findUnique").mockResolvedValue(stats({ lastActiveDate: yesterday, achievements: ["first_quest"] }));
    const next = await awardXp("u1", { correct: 1, total: 1 });
    expect(next).toMatchObject({ currentStreak: 3, longestStreak: 3, todayXp: 15 });
    expect(next.newAchievements.map((a) => a.id)).toEqual(["streak_3"]);
  });

  it("resets a broken streak and caps XP per activity", async () => {
    db("gamificationStats", "findUnique").mockResolvedValue(stats({ lastActiveDate: new Date(dayStart().getTime() - 5 * 86_400_000) }));
    const r = await awardXp("u1", { correct: 100, total: 100 });
    expect(r.currentStreak).toBe(1);
    expect(r.xpGained).toBe(250);
  });
});
