import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { EXAM_LEVELS } from "@/lib/constants";
import { TeamsClient } from "./teams-client";

export default async function TeamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const memberships = await prisma.orgMember.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "desc" },
    select: {
      role: true,
      org: { select: { id: true, name: true, level: true, _count: { select: { members: { where: { role: "STUDENT" } } } } } },
    },
  });

  return (
    <TeamsClient
      userId={user.id}
      levels={EXAM_LEVELS.map((l) => ({ value: l.value, label: `${l.label} (${l.cefr})` }))}
      defaultLevel={user.examLevel ?? "ISE_III"}
      teams={memberships.map((m) => ({
        id: m.org.id,
        name: m.org.name,
        level: m.org.level,
        role: m.role,
        students: m.org._count.members,
      }))}
    />
  );
}
