import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma")).prismaMock }));
vi.mock("@/lib/readiness-server", () => ({ getReadiness: vi.fn() }));

import { db, resetDb } from "../helpers/prisma";
import { getReadiness } from "@/lib/readiness-server";
import { computeReadiness } from "@/lib/readiness";
import { completedBy, getMembership, getStudentAssignments, getTeamDashboard, isTeacherRole } from "@/lib/teams-server";

const now = new Date("2026-11-25T12:00:00Z");
const a = (kind: string, extra: Record<string, unknown> = {}) => ({
  id: `a-${kind}`, title: kind, kind, createdAt: new Date("2026-11-20"), dueAt: new Date("2026-11-30"), ...extra,
});

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
});

describe("membership", () => {
  it("looks the member up and knows who teaches", async () => {
    db("orgMember", "findUnique").mockResolvedValue({ role: "TEACHER" });
    expect(await getMembership("u1", "o1")).toEqual({ role: "TEACHER" });
    expect(isTeacherRole("OWNER")).toBe(true);
    expect(isTeacherRole("TEACHER")).toBe(true);
    expect(isTeacherRole("STUDENT")).toBe(false);
    expect(isTeacherRole(null)).toBe(false);
  });
});

describe("completedBy", () => {
  it("is empty without students", async () => {
    expect((await completedBy(a("ORAL") as never, [], "ISE_II")).size).toBe(0);
  });

  it("checks the right practice for each kind of assignment", async () => {
    db("writtenExam", "findMany").mockResolvedValue([{ userId: "s1" }]);
    db("oralExam", "findMany").mockResolvedValue([{ userId: "s2" }]);
    db("listeningSession", "findMany").mockResolvedValue([{ userId: "s3" }]);
    db("writingDraft", "findMany").mockResolvedValue([{ practice: { userId: "s4" } }]);
    db("readingSession", "findMany").mockResolvedValue([{ userId: "s5" }]);
    db("reviewLog", "findMany").mockResolvedValue([{ userId: "s6" }]);
    const ids = ["s1", "s2", "s3", "s4", "s5", "s6"];
    expect([...(await completedBy(a("WRITTEN") as never, ids, "ISE_II"))]).toEqual(["s1"]);
    expect(db("writtenExam", "findMany").mock.calls[0][0].where.mode).toBe("FULL");
    expect([...(await completedBy(a("ORAL") as never, ids, "ISE_II"))]).toEqual(["s2"]);
    expect([...(await completedBy(a("LISTENING") as never, ids, "ISE_II"))]).toEqual(["s3"]);
    expect([...(await completedBy(a("WRITING") as never, ids, "ISE_II"))]).toEqual(["s4"]);
    expect([...(await completedBy(a("READING") as never, ids, "ISE_II"))].sort()).toEqual(["s1", "s5"]);
    expect(db("readingSession", "findMany").mock.calls[0][0].where.reading).toEqual({ level: "B2" });
    await completedBy(a("READING") as never, ids, "ISE_X" as never);
    expect(db("readingSession", "findMany").mock.calls[1][0].where.reading).toBeUndefined();
    expect([...(await completedBy(a("REVIEW") as never, ids, "ISE_II"))]).toEqual(["s6"]);
  });
});

describe("team dashboard", () => {
  const report = (pPassish: number, days: number) => {
    const obs = pPassish
      ? [{ skill: "writing" as const, value: pPassish, weight: 1, at: new Date(now.getTime() - days * 86_400_000), source: "writingLab" as const }]
      : [];
    const criteria = pPassish ? [{ skill: "writing" as const, key: "languageControl", value: 0.4, at: now }] : [];
    return { level: "ISE_II", report: computeReadiness(obs, criteria, { now }) };
  };

  it("returns null for a missing team", async () => {
    db("organization", "findUnique").mockResolvedValue(null);
    expect(await getTeamDashboard("o1", now)).toBeNull();
  });

  it("builds members, KPIs, class errors and assignment progress", async () => {
    db("organization", "findUnique").mockResolvedValue({
      id: "o1", name: "2ºB", level: "ISE_II", joinCode: "ABCDEFGH", createdAt: now,
      members: [
        { userId: "t1", role: "OWNER", joinedAt: now, user: { id: "t1", name: "Teacher", email: "t@x.com" } },
        { userId: "s1", role: "STUDENT", joinedAt: now, user: { id: "s1", name: " ", email: "ana@x.com" } },
        { userId: "s2", role: "STUDENT", joinedAt: now, user: { id: "s2", name: "Ben", email: "ben@x.com" } },
      ],
      assignments: [a("REVIEW", { dueAt: new Date("2026-11-20") })],
      lessons: [{ id: "l1", createdAt: now, content: { title: "x" }, focus: {} }],
    });
    vi.mocked(getReadiness).mockResolvedValueOnce(report(70, 1) as never).mockResolvedValueOnce(report(0, 0) as never);
    db("writingDraft", "findMany").mockResolvedValue([
      { feedback: { issues: [{ tag: "articles" }, { tag: 3 }] }, practice: { userId: "s1" } },
      { feedback: null, practice: { userId: "s2" } },
    ]);
    db("reviewLog", "findMany").mockResolvedValue([{ userId: "s1" }]);
    const d = (await getTeamDashboard("o1", now))!;
    expect(d.org.levelLabel).toBe("ISE II (B2)");
    expect(d.teachers).toEqual([{ userId: "t1", name: "Teacher", role: "OWNER" }]);
    expect(d.members.map((m) => m.name)).toEqual(["ana", "Ben"]);
    expect(d.members[0].cells.filter((c) => c !== null)).toEqual([0.4]);
    expect(d.kpis).toMatchObject({ students: 2, active7d: 1 });
    expect(d.kpis.avgPPass).toBeCloseTo(d.members[0].pPass);
    expect(d.classSkills.find((s) => s.skill === "writing")?.mean).toBeGreaterThan(0);
    expect(d.classSkills.find((s) => s.skill === "speaking")?.mean).toBe(0);
    expect(d.classErrors).toEqual([{ tag: "articles", occurrences: 1, students: 1 }]);
    expect(d.assignments[0]).toMatchObject({ done: 1, total: 2, overdue: true });
    expect(d.lesson?.id).toBe("l1");
    expect(vi.mocked(getReadiness).mock.calls[0][1]).toMatchObject({ useGoal: false, level: "ISE_II" });
  });

  it("handles a team with no evidence and no lesson", async () => {
    db("organization", "findUnique").mockResolvedValue({
      id: "o1", name: "x", level: "ISE_X", joinCode: "J", createdAt: now,
      members: [{ userId: "s1", role: "STUDENT", joinedAt: now, user: { id: "s1", name: null, email: "s@x.com" } }],
      assignments: [], lessons: [],
    });
    vi.mocked(getReadiness).mockResolvedValue(report(0, 0) as never);
    db("writingDraft", "findMany").mockResolvedValue([]);
    const d = (await getTeamDashboard("o1"))!;
    expect(d.kpis).toMatchObject({ avgPPass: null, onTrackShare: null });
    expect(d.org.levelLabel).toBe("ISE_X");
    expect(d.lesson).toBeNull();
  });
});

describe("student assignments", () => {
  it("lists open work from every team, pending first", async () => {
    db("orgMember", "findMany").mockResolvedValue([
      { org: { name: "2ºB", level: "ISE_II", assignments: [a("REVIEW", { id: "r", dueAt: new Date("2026-11-28") }), a("ORAL", { id: "o", dueAt: new Date("2026-11-27") })] } },
    ]);
    db("reviewLog", "findMany").mockResolvedValue([]);
    db("oralExam", "findMany").mockResolvedValue([{ userId: "u1" }]);
    const list = await getStudentAssignments("u1", now);
    expect(list.map((x) => [x.id, x.done])).toEqual([["r", false], ["o", true]]);
    expect(list[0].teamName).toBe("2ºB");
  });
});
