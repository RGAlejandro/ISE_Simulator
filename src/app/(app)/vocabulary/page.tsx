import { redirect } from "next/navigation";
import { getCurrentUser, isProUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { SESSION_MAX_NEW } from "@/lib/srs";
import { VocabularyClient } from "./vocabulary-client";

export default async function VocabularyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [dueReviews, newWords] = await Promise.all([
    prisma.savedWord.count({ where: { userId: user.id, srsBox: { gt: 0 }, dueAt: { lte: new Date() } } }),
    prisma.savedWord.count({ where: { userId: user.id, srsBox: 0 } }),
  ]);

  return <VocabularyClient reviewDue={dueReviews + Math.min(newWords, SESSION_MAX_NEW)} isPro={isProUser(user)} />;
}
