import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { getMembership, isTeacherRole } from "@/lib/teams-server";

/** A student leaves the team, or a teacher removes a student. The owner can't be removed. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; userId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId, userId } = await params;

    const [actor, target] = await Promise.all([getMembership(user.id, orgId), getMembership(userId, orgId)]);
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const self = userId === user.id;
    if (target.role === "OWNER") return NextResponse.json({ error: "The owner can't leave or be removed" }, { status: 400 });
    if (!self && !(isTeacherRole(actor?.role) && target.role === "STUDENT")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.orgMember.delete({ where: { orgId_userId: { orgId, userId } } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Could not remove the member" }, { status: 500 });
  }
}
