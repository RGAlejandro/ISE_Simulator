import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { EXAM_LEVELS } from "@/lib/constants";
import { isJoinCode } from "@/lib/teams";
import { JoinClient } from "./join-client";

export default async function JoinTeamPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const normalized = code.toUpperCase();
  const org = isJoinCode(normalized)
    ? await prisma.organization.findUnique({
        where: { joinCode: normalized },
        select: { id: true, name: true, level: true, owner: { select: { name: true, email: true } }, members: { where: { userId: user.id }, select: { role: true } } },
      })
    : null;

  if (org?.members[0] && org.members[0].role !== "STUDENT") redirect(`/teams/${org.id}`);
  const level = org ? EXAM_LEVELS.find((l) => l.value === org.level) : null;

  return (
    <JoinClient
      code={normalized}
      team={
        org
          ? {
              name: org.name,
              owner: org.owner.name?.trim() || org.owner.email.split("@")[0],
              level: level ? `${level.label} (${level.cefr})` : org.level,
              alreadyMember: org.members.length > 0,
            }
          : null
      }
    />
  );
}
