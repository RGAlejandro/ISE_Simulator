import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { VocabularyClient } from "./vocabulary-client";

export default async function VocabularyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return <VocabularyClient />;
}
