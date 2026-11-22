import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { getMembership, isTeacherRole } from "@/lib/teams-server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; assignmentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId, assignmentId } = await params;
    const membership = await getMembership(user.id, orgId);
    if (!isTeacherRole(membership?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { count } = await prisma.assignment.deleteMany({ where: { id: assignmentId, orgId } });
    if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return NextResponse.json({ error: "Could not delete the assignment" }, { status: 500 });
  }
}
