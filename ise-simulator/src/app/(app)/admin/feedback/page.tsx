import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { FeedbackClient } from "./feedback-client";

export default async function AdminFeedbackPage() {
  await getAdminUser();

  const items = await prisma.feedback.findMany({
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const unreadCount = items.filter(i => !i.isRead).length;

  return (
    <FeedbackClient
      initialItems={items.map(i => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
      }))}
      unreadCount={unreadCount}
    />
  );
}
