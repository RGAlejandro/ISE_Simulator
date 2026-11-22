import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isJoinCode } from "@/lib/teams";

/** Join a team as a STUDENT with its invite code. Idempotent. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    const normalized = (code ?? "").trim().toUpperCase();
    if (!isJoinCode(normalized)) return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });

    const org = await prisma.organization.findUnique({ where: { joinCode: normalized }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: org.id, userId: user.id } },
      create: { orgId: org.id, userId: user.id, role: "STUDENT" },
      update: {},
    });
    return NextResponse.json({ id: org.id });
  } catch (error) {
    console.error("Error joining team:", error);
    return NextResponse.json({ error: "Could not join the team" }, { status: 500 });
  }
}
