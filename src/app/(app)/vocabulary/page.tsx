import { redirect } from "next/navigation";
import { getCurrentUser, isProUser } from "@/lib/user";
import { getReviewQueue } from "@/lib/srs-server";
import { VocabularyClient } from "./vocabulary-client";

export default async function VocabularyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const queue = await getReviewQueue(user.id);

  return <VocabularyClient reviewDue={queue.total} isPro={isProUser(user)} />;
}
