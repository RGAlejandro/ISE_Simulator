import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { UsersClient } from "./users-client";

export default async function AdminUsersPage() {
  const me = await getAdminUser();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      createdAt: true,
      subscription: { select: { status: true, currentPeriodEnd: true } },
      _count: {
        select: {
          writtenExams: true,
          oralExams: true,
          listeningSessions: true,
          grammarSessions: true,
          savedWords: true,
        },
      },
    },
  });

  return (
    <UsersClient
      currentUserId={me.id}
      users={users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        createdAt: u.createdAt.toISOString(),
        subscriptionStatus: u.subscription?.status ?? null,
        currentPeriodEnd: u.subscription?.currentPeriodEnd?.toISOString() ?? null,
        counts: {
          written:   u._count.writtenExams,
          oral:      u._count.oralExams,
          listening: u._count.listeningSessions,
          grammar:   u._count.grammarSessions,
          vocab:     u._count.savedWords,
          total: u._count.writtenExams + u._count.oralExams + u._count.listeningSessions + u._count.grammarSessions,
        },
      }))}
    />
  );
}
