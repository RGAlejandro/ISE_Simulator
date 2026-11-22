import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { getReadiness } from "@/lib/readiness-server";
import { getMembership, isTeacherRole } from "@/lib/teams-server";
import { MemberClient } from "./member-client";

/** Teacher's read-only view of one student's Readiness (scores and progress only — no texts). */
export default async function TeamMemberPage({ params }: { params: Promise<{ orgId: string; userId: string }> }) {
  const { orgId, userId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [actor, target, org] = await Promise.all([
    getMembership(user.id, orgId),
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } }, select: { role: true, user: { select: { name: true, email: true } } } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, level: true } }),
  ]);
  if (!isTeacherRole(actor?.role) || !org) redirect("/teams");
  if (!target || target.role !== "STUDENT") redirect(`/teams/${orgId}`);

  const { report } = await getReadiness(userId, { level: org.level, useGoal: false });
  if (!report) redirect(`/teams/${orgId}`);

  return (
    <MemberClient
      orgId={orgId}
      teamName={org.name}
      userId={userId}
      name={target.user.name?.trim() || target.user.email.split("@")[0]}
      report={report}
    />
  );
}
