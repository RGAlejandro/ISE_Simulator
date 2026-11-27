import { redirect } from "next/navigation";
import { getCurrentUser, getDailyUsage, isProUser } from "@/lib/user";
import { PracticeClient, type SetupKind } from "./practice-client";

const START: SetupKind[] = ["written", "listening", "reading"];

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { start } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.onboardedAt) redirect("/welcome");

  const usage = await getDailyUsage(user.id);

  return (
    <PracticeClient
      isPro={isProUser(user)}
      usage={usage}
      examModules={user.examModules}
      examLevel={user.examLevel}
      autoStart={START.includes(start as SetupKind) ? (start as SetupKind) : null}
    />
  );
}
