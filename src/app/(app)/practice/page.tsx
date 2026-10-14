import { redirect } from "next/navigation";
import { getCurrentUser, getDailyUsage } from "@/lib/user";
import { PracticeClient } from "./practice-client";

export default async function PracticePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const usage = await getDailyUsage(user.id);

  return (
    <PracticeClient
      isPro={user.plan === "PRO" || user.plan === "ADMIN"}
      writtenCount={usage.writtenCount}
      oralCount={usage.oralCount}
      listeningCount={usage.listeningCount}
      canTakeWritten={usage.canTakeWritten}
      canTakeOral={usage.canTakeOral}
      canTakeListening={usage.canTakeListening}
    />
  );
}
