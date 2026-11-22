import { prisma } from "@/lib/prisma";
import { EXAM_LEVELS } from "@/lib/constants";
import { getReadiness } from "@/lib/readiness-server";
import { aggregateErrorTags, histogram, HEATMAP_CRITERIA, type AssignmentKindValue, type ClassErrorStat } from "@/lib/teams";
import type { Band, ReadinessReport, Skill } from "@/lib/readiness";
import type { ExamLevel } from "@/types";

export type OrgRoleValue = "OWNER" | "TEACHER" | "STUDENT";

export async function getMembership(userId: string, orgId: string) {
  return prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } }, select: { role: true } });
}

export function isTeacherRole(role: OrgRoleValue | undefined | null): boolean {
  return role === "OWNER" || role === "TEACHER";
}

const CLASS_ERRORS_WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;

// ─── assignment completion (derived, no extra table) ────────────────────────

/** userIds that did the assignment's kind of practice at the team level between creation and due date. */
export async function completedBy(
  a: { kind: AssignmentKindValue; createdAt: Date; dueAt: Date },
  userIds: string[],
  level: ExamLevel,
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const window = { gte: a.createdAt, lte: a.dueAt };
  const cefr = EXAM_LEVELS.find((l) => l.value === level)?.cefr;
  let rows: { userId: string }[] = [];
  switch (a.kind) {
    case "WRITTEN":
      // A full paper only: a Reading practice (Tasks 1 and 2) doesn't complete a written mock.
      rows = await prisma.writtenExam.findMany({ where: { userId: { in: userIds }, level, mode: "FULL", status: "EVALUATED", completedAt: window }, select: { userId: true }, distinct: ["userId"] });
      break;
    case "ORAL":
      rows = await prisma.oralExam.findMany({ where: { userId: { in: userIds }, level, status: "EVALUATED", completedAt: window }, select: { userId: true }, distinct: ["userId"] });
      break;
    case "LISTENING":
      rows = await prisma.listeningSession.findMany({ where: { userId: { in: userIds }, level, status: "COMPLETED", completedAt: window }, select: { userId: true }, distinct: ["userId"] });
      break;
    case "WRITING": {
      const drafts = await prisma.writingDraft.findMany({
        where: { version: 1, createdAt: window, practice: { userId: { in: userIds }, level } },
        select: { practice: { select: { userId: true } } },
      });
      rows = drafts.map((d) => ({ userId: d.practice.userId }));
      break;
    }
    case "READING": {
      // Either a Trinity Reading practice or a vocabulary reading counts.
      const [practice, readings] = await Promise.all([
        prisma.writtenExam.findMany({ where: { userId: { in: userIds }, level, mode: "READING", status: "EVALUATED", completedAt: window }, select: { userId: true }, distinct: ["userId"] }),
        prisma.readingSession.findMany({
          where: { userId: { in: userIds }, completedAt: window, ...(cefr ? { reading: { level: cefr } } : {}) },
          select: { userId: true },
          distinct: ["userId"],
        }),
      ]);
      rows = [...practice, ...readings];
      break;
    }
    case "REVIEW":
      rows = await prisma.reviewLog.findMany({ where: { userId: { in: userIds }, createdAt: window }, select: { userId: true }, distinct: ["userId"] });
      break;
  }
  return new Set(rows.map((r) => r.userId));
}

// ─── teacher dashboard ──────────────────────────────────────────────────────

export interface TeamMemberRow {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  pPass: number;
  band: Band;
  limitingSkill: Skill | null;
  trendPerWeek: number | null;
  lastAt: string | null;
  attempts7d: number;
  onTrack: boolean;
  observations: number;
  skills: { skill: Skill; mean: number; pPass: number; count: number }[];
  /** Heatmap cells aligned with HEATMAP_CRITERIA (null = no evidence). */
  cells: (number | null)[];
}

export interface TeamAssignmentRow {
  id: string;
  title: string;
  kind: AssignmentKindValue;
  dueAt: string;
  createdAt: string;
  done: number;
  total: number;
  overdue: boolean;
}

export interface TeamDashboard {
  org: { id: string; name: string; level: ExamLevel; levelLabel: string; joinCode: string; createdAt: string };
  teachers: { userId: string; name: string; role: OrgRoleValue }[];
  members: TeamMemberRow[];
  kpis: { students: number; active7d: number; avgPPass: number | null; onTrackShare: number | null };
  histogram: { from: number; to: number; count: number }[];
  classSkills: { skill: Skill; mean: number }[];
  classErrors: ClassErrorStat[];
  assignments: TeamAssignmentRow[];
  lesson: { id: string; createdAt: string; content: unknown; focus: unknown } | null;
}

function displayName(u: { name: string | null; email: string }) {
  return u.name?.trim() || u.email.split("@")[0];
}

export async function getTeamDashboard(orgId: string, now = new Date()): Promise<TeamDashboard | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { joinedAt: "asc" } },
      assignments: { orderBy: { dueAt: "desc" }, take: 20 },
      lessons: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!org) return null;

  const students = org.members.filter((m) => m.role === "STUDENT");
  const studentIds = students.map((m) => m.userId);

  const [reports, drafts, completion] = await Promise.all([
    Promise.all(students.map((m) => getReadiness(m.userId, { level: org.level, now, useGoal: false }))),
    prisma.writingDraft.findMany({
      where: { version: 1, createdAt: { gte: new Date(now.getTime() - CLASS_ERRORS_WINDOW_DAYS * DAY_MS) }, practice: { userId: { in: studentIds }, level: org.level } },
      select: { feedback: true, practice: { select: { userId: true } } },
    }),
    Promise.all(org.assignments.map((a) => completedBy(a, studentIds, org.level))),
  ]);

  const members: TeamMemberRow[] = students.map((m, i) => {
    const report = reports[i].report as ReadinessReport;
    const crit = new Map(report.criteria.map((c) => [`${c.skill}:${c.key}`, c.value]));
    return {
      userId: m.userId,
      name: displayName(m.user),
      email: m.user.email,
      joinedAt: m.joinedAt.toISOString(),
      pPass: report.overall.pPass,
      band: report.overall.band,
      limitingSkill: report.overall.limitingSkill,
      trendPerWeek: report.projection.trendPerWeek,
      lastAt: report.activity.lastAt,
      attempts7d: report.activity.attempts7d,
      onTrack: report.onTrack,
      observations: report.overall.observations,
      skills: report.skills.map((s) => ({ skill: s.skill, mean: s.mean, pPass: s.pPass, count: s.count })),
      cells: HEATMAP_CRITERIA.map((h) => crit.get(`${h.skill}:${h.key}`) ?? null),
    };
  });

  const measured = members.filter((m) => m.observations > 0);
  const perStudentTags = new Map<string, string[]>();
  for (const d of drafts) {
    const issues = (d.feedback as { issues?: { tag?: string }[] } | null)?.issues ?? [];
    const list = perStudentTags.get(d.practice.userId) ?? [];
    for (const i of issues) if (typeof i.tag === "string") list.push(i.tag);
    perStudentTags.set(d.practice.userId, list);
  }

  const skills: Skill[] = ["reading", "writing", "speaking", "listening"];
  const classSkills = skills.map((skill) => {
    const vals = measured.map((m) => m.skills.find((s) => s.skill === skill)).filter((s) => s && s.count > 0) as { mean: number }[];
    return { skill, mean: vals.length ? Math.round((vals.reduce((a, b) => a + b.mean, 0) / vals.length) * 10) / 10 : 0 };
  });

  const level = EXAM_LEVELS.find((l) => l.value === org.level);
  return {
    org: {
      id: org.id,
      name: org.name,
      level: org.level,
      levelLabel: level ? `${level.label} (${level.cefr})` : org.level,
      joinCode: org.joinCode,
      createdAt: org.createdAt.toISOString(),
    },
    teachers: org.members.filter((m) => m.role !== "STUDENT").map((m) => ({ userId: m.userId, name: displayName(m.user), role: m.role })),
    members,
    kpis: {
      students: members.length,
      active7d: members.filter((m) => m.attempts7d > 0).length,
      avgPPass: measured.length ? measured.reduce((a, m) => a + m.pPass, 0) / measured.length : null,
      onTrackShare: measured.length ? measured.filter((m) => m.onTrack).length / measured.length : null,
    },
    histogram: histogram(measured.map((m) => m.pPass)),
    classSkills,
    classErrors: aggregateErrorTags(perStudentTags),
    assignments: org.assignments.map((a, i) => ({
      id: a.id,
      title: a.title,
      kind: a.kind,
      dueAt: a.dueAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
      done: completion[i].size,
      total: studentIds.length,
      overdue: a.dueAt < now,
    })),
    lesson: org.lessons[0]
      ? { id: org.lessons[0].id, createdAt: org.lessons[0].createdAt.toISOString(), content: org.lessons[0].content, focus: org.lessons[0].focus }
      : null,
  };
}

// ─── student side ───────────────────────────────────────────────────────────

export interface StudentAssignment {
  id: string;
  title: string;
  kind: AssignmentKindValue;
  dueAt: string;
  teamName: string;
  done: boolean;
}

/** Open (or recently due) assignments from every team the user belongs to as a student. */
export async function getStudentAssignments(userId: string, now = new Date()): Promise<StudentAssignment[]> {
  const memberships = await prisma.orgMember.findMany({
    where: { userId, role: "STUDENT" },
    select: { org: { select: { name: true, level: true, assignments: { where: { dueAt: { gte: new Date(now.getTime() - 3 * DAY_MS) } }, orderBy: { dueAt: "asc" } } } } },
  });
  const out: StudentAssignment[] = [];
  for (const m of memberships) {
    for (const a of m.org.assignments) {
      const done = (await completedBy(a, [userId], m.org.level)).has(userId);
      out.push({ id: a.id, title: a.title, kind: a.kind, dueAt: a.dueAt.toISOString(), teamName: m.org.name, done });
    }
  }
  return out.sort((a, b) => Number(a.done) - Number(b.done) || a.dueAt.localeCompare(b.dueAt)).slice(0, 6);
}
