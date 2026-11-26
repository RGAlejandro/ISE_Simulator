import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma")).prismaMock }));
vi.mock("@/lib/readiness-server", () => ({ getReadiness: vi.fn(), loadReadinessEvidence: vi.fn() }));
vi.mock("@/lib/teams-server", () => ({ getStudentAssignments: vi.fn() }));
vi.mock("@/lib/srs-server", () => ({ getReviewQueue: vi.fn() }));
vi.mock("@/lib/user", async (orig) => ({ ...(await orig<typeof import("@/lib/user")>()), getDailyUsage: vi.fn() }));

import { db, resetDb } from "../helpers/prisma";
import { getReadiness, loadReadinessEvidence } from "@/lib/readiness-server";
import { getStudentAssignments } from "@/lib/teams-server";
import { getReviewQueue } from "@/lib/srs-server";
import { getDailyUsage } from "@/lib/user";
import { computeReadiness } from "@/lib/readiness";
import { loadDashboardData } from "@/lib/dashboard-server";
import { buildTutorSnapshot } from "@/lib/tutor-context";

const now = new Date();
const user = (over: Record<string, unknown> = {}) => ({
  id: "u1", name: "Ana López", email: "a@x.com", plan: "FREE" as const, examDate: null, examLevel: null,
  examModules: "BOTH" as const, targetBand: "PASS" as const, subscription: null, ...over,
});
const report = () => computeReadiness(
  [{ skill: "writing", value: 60, weight: 1, at: now, source: "writingLab" }],
  [{ skill: "writing", key: "languageControl", value: 0.4, at: now }],
  { now },
);

function emptyDashboardQueries() {
  for (const m of ["writtenExam", "oralExam"]) {
    db(m, "findMany").mockResolvedValue([]);
    db(m, "count").mockResolvedValue(0);
  }
}

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
  vi.mocked(getDailyUsage).mockResolvedValue({ writtenCount: 0 } as never);
  vi.mocked(getStudentAssignments).mockResolvedValue([]);
  vi.mocked(getReviewQueue).mockResolvedValue({ due: 3, newLeft: 5, total: 8, reviewedToday: true });
});

describe("dashboard data", () => {
  it("works for a brand-new learner with no goal and no evidence", async () => {
    vi.mocked(getReadiness).mockResolvedValue({ level: null, report: null });
    emptyDashboardQueries();
    const d = await loadDashboardData(user());
    expect(d.examPlan.goal).toBeNull();
    expect(d.examPlan.plan).toBeNull();
    expect(d.readiness).toBeNull();
    expect(d.stats).toMatchObject({ avgScore: null, bestScore: null, streak: 0, evaluatedCount: 0, last7Count: 0 });
    expect(d.stats.activity14).toHaveLength(14);
    expect(d.isPro).toBe(false);
  });

  it("builds the week plan, scores, streak and recent exams", async () => {
    vi.mocked(getReadiness).mockResolvedValue({ level: "ISE_III", report: report() });
    const examDate = new Date(now.getTime() + 10 * 86_400_000);
    db("writingDraft", "count").mockResolvedValue(1);
    db("reviewLog", "findMany").mockResolvedValue([{ createdAt: now }, { createdAt: now }]);
    db("readingSession", "count").mockResolvedValue(1);
    db("writtenExam", "count").mockResolvedValue(1);
    db("oralExam", "count").mockResolvedValue(0);
    db("writingDraft", "findFirst").mockResolvedValue({ practice: { id: "p1", genre: "article" } });
    db("writingDraft", "findMany").mockResolvedValue([{ score: 2 }, { score: 1.5 }]);
    db("writingPractice", "findMany").mockResolvedValue([
      { genre: "article", taskType: "READING_INTO_WRITING" }, { genre: "essay", taskType: "EXTENDED_WRITING" }, { genre: "essay", taskType: "EXTENDED_WRITING" },
    ]);
    db("writtenExam", "findMany")
      .mockResolvedValueOnce([{ id: "w1", mode: "READING", level: "ISE_III", status: "EVALUATED", score: 70, createdAt: now }])
      .mockResolvedValueOnce([{ score: 70 }])
      .mockResolvedValueOnce([{ createdAt: now }]);
    db("oralExam", "findMany")
      .mockResolvedValueOnce([{ id: "o1", level: "ISE_III", status: "EVALUATED", overallScore: 60, createdAt: new Date(now.getTime() - 1000) }])
      .mockResolvedValueOnce([{ overallScore: 60 }])
      .mockResolvedValueOnce([{ createdAt: new Date(now.getTime() - 86_400_000) }]);

    const d = await loadDashboardData(user({ plan: "ADMIN", examDate, examLevel: "ISE_III", examModules: "READING_WRITING" }));
    expect(d.isPro).toBe(true);
    const plan = d.examPlan.plan!;
    expect(plan.phase).toBe("simulate");
    expect(plan.targets.map((t) => t.key)).not.toContain("oral");
    expect(plan.dueToday).toBe(8);
    expect(plan.wroteToday).toEqual({ practiceId: "p1", genre: "article" });
    expect(plan.suggestion.taskType).toBe("READING_INTO_WRITING");
    expect(plan.writingScores).toEqual([1.5, 2]);
    expect(d.stats).toMatchObject({ avgScore: 65, bestScore: 70, streak: 2, evaluatedCount: 2 });
    expect(d.recentExams.map((e) => e.id)).toEqual(["w1", "o1"]);
    expect(d.recentExams[0]).toMatchObject({ type: "written", reading: true });
    expect(d.readiness?.levelLabel).toBe("ISE III (C1)");
  });

  it("drops writing and the mock for a Speaking & Listening goal", async () => {
    vi.mocked(getReadiness).mockResolvedValue({ level: null, report: null });
    emptyDashboardQueries();
    db("writingDraft", "count").mockResolvedValue(0);
    db("reviewLog", "findMany").mockResolvedValue([]);
    db("readingSession", "count").mockResolvedValue(0);
    db("writingDraft", "findFirst").mockResolvedValue(null);
    db("writingDraft", "findMany").mockResolvedValue([]);
    db("writingPractice", "findMany").mockResolvedValue([]);
    const d = await loadDashboardData(user({ examDate: new Date(now.getTime() + 20 * 86_400_000), examLevel: "ISE_II", examModules: "SPEAKING_LISTENING" }));
    const keys = d.examPlan.plan!.targets.map((t) => t.key);
    expect(keys).not.toContain("writing");
    expect(keys).not.toContain("mock");
    expect(d.examPlan.plan!.wroteToday).toBeNull();
  });
});

describe("tutor snapshot", () => {
  function vocabQueries() {
    db("vocabularyList", "findMany").mockResolvedValue([{ name: "A very long list name that keeps going and going", _count: { words: 12 } }]);
    db("savedWord", "count").mockResolvedValueOnce(40).mockResolvedValueOnce(4).mockResolvedValueOnce(10).mockResolvedValueOnce(8);
    db("savedWord", "findMany").mockResolvedValueOnce([{ english: "thrive" }]).mockResolvedValueOnce([{ english: "thrive" }, { english: "give up" }]);
  }

  it("summarises goal, readiness, recent work, errors and vocabulary", async () => {
    db("user", "findUnique").mockResolvedValue({ name: "Ana López", examLevel: "ISE_III", examDate: new Date(now.getTime() + 7 * 86_400_000), examModules: "READING_WRITING", targetBand: "MERIT" });
    vi.mocked(getReadiness).mockResolvedValue({ level: "ISE_III", report: report() });
    vi.mocked(loadReadinessEvidence).mockResolvedValue({
      observations: [
        { skill: "writing", value: 61.4, weight: 1, at: now, source: "writingLab" },
        { skill: "speaking", value: 50, weight: 1, at: now, source: "oralExam" },
      ],
      criteria: [],
    });
    db("writingDraft", "findMany").mockResolvedValue([
      { feedback: { issues: [{ tag: "articles", quote: "a".repeat(200), correction: "b", explanation: "" }] } },
      { feedback: null },
    ]);
    vocabQueries();
    const s = await buildTutorSnapshot("u1", now);
    expect(s.firstName).toBe("Ana");
    expect(s.goal).toMatchObject({ level: "ISE_III", daysLeft: 7, phase: "simulate", modulesToPass: "READING_WRITING", targetBand: "MERIT" });
    expect(s.readiness?.skills.map((x) => x.skill)).toEqual(["reading", "writing", "speaking", "listening"]);
    expect(s.recentAttempts).toEqual(expect.arrayContaining([expect.objectContaining({ skill: "writing", score: 61 })]));
    expect(s.writingErrors.textsAnalysed).toBe(2);
    expect(s.writingErrors.top[0].examples[0].wrote.endsWith("…")).toBe(true);
    expect(s.vocabulary).toMatchObject({ saved: 40, dueForReviewToday: 4, notStartedYet: 10, learned: 8, struggling: ["thrive"], alreadySaved: ["thrive", "give up"] });
    expect(s.vocabulary.lists[0].name.length).toBeLessThanOrEqual(40);
  });

  it("copes with a learner who has nothing yet", async () => {
    db("user", "findUnique").mockResolvedValue(null);
    vi.mocked(getReadiness).mockResolvedValue({ level: null, report: null });
    db("writingDraft", "findMany").mockResolvedValue([]);
    vocabQueries();
    const s = await buildTutorSnapshot("u1");
    expect(s).toMatchObject({ firstName: null, readiness: null, recentAttempts: [] });
    expect(s.goal).toMatchObject({ level: null, examDate: null, daysLeft: null, phase: null, modulesToPass: "BOTH", targetBand: "PASS" });
    expect(loadReadinessEvidence).not.toHaveBeenCalled();
  });
});
