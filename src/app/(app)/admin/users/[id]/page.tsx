import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { loadDashboardData } from "@/lib/dashboard-server";
import { DashboardClient } from "@/app/(app)/dashboard/dashboard-client";
import type { WritingTaskContent } from "@/types";

export const metadata = { title: "Learner profile — ISE Simulator" };

/** Admin-only, read-only view of a learner: their own dashboard plus their texts and word lists. */
export default async function AdminUserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await getAdminUser();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { subscription: true, orgMemberships: { include: { org: { select: { name: true } } } } },
  });
  if (!user) notFound();

  const [data, practices, lists] = await Promise.all([
    loadDashboardData(user),
    prisma.writingPractice.findMany({
      where: { userId: user.id, hiddenAt: null, drafts: { some: {} } },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { drafts: { select: { version: true, score: true }, orderBy: { version: "asc" } } },
    }),
    prisma.vocabularyList.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { words: true } } },
    }),
  ]);

  const teams = user.orgMemberships.map((m) => m.org.name).join(", ");
  const meta = [
    user.plan,
    teams || null,
    `${user.createdAt.toISOString().slice(0, 10)}`,
  ].filter(Boolean).join(" · ");

  return (
    <DashboardClient
      {...data}
      profile={{
        userId: user.id,
        meta,
        writings: practices.map((p) => ({
          id: p.id,
          title: (p.task as unknown as WritingTaskContent)?.title ?? p.genre,
          genre: p.genre,
          taskType: p.taskType,
          versions: p.drafts.length,
          score: p.drafts.at(-1)?.score ?? null,
          updatedAt: p.updatedAt.toISOString(),
        })),
        lists: lists.map((l) => ({ id: l.id, name: l.name, emoji: l.emoji, words: l._count.words })),
      }}
    />
  );
}
