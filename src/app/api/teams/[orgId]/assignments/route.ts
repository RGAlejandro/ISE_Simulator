import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { getMembership, isTeacherRole } from "@/lib/teams-server";
import { ASSIGNMENT_KINDS, endOfDayUTC, type AssignmentKindValue } from "@/lib/teams";

const MAX_OPEN_ASSIGNMENTS = 30;

/** Teacher creates homework for the team. */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId } = await params;
    const membership = await getMembership(user.id, orgId);
    if (!isTeacherRole(membership?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { title?: string; kind?: string; dueDate?: string };
    const kind = ASSIGNMENT_KINDS.find((k) => k === body.kind) as AssignmentKindValue | undefined;
    if (!kind) return NextResponse.json({ error: "Invalid assignment type" }, { status: 400 });
    const dueAt = endOfDayUTC(String(body.dueDate ?? ""));
    if (Number.isNaN(dueAt.getTime()) || dueAt < new Date()) return NextResponse.json({ error: "Pick a due date from today on" }, { status: 400 });
    const title = (body.title ?? "").trim().slice(0, 120);

    const open = await prisma.assignment.count({ where: { orgId, dueAt: { gte: new Date() } } });
    if (open >= MAX_OPEN_ASSIGNMENTS) return NextResponse.json({ error: "Too many open assignments" }, { status: 429 });

    const a = await prisma.assignment.create({
      data: { orgId, createdById: user.id, kind, dueAt, title: title || kind },
      select: { id: true },
    });
    return NextResponse.json({ id: a.id });
  } catch (error) {
    console.error("Error creating assignment:", error);
    return NextResponse.json({ error: "Could not create the assignment" }, { status: 500 });
  }
}
