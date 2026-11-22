import { redirect } from "next/navigation";
import { getCurrentUser, isProUser } from "@/lib/user";
import { EXAM_LEVELS } from "@/lib/constants";
import { getReadiness } from "@/lib/readiness-server";
import { ReadinessClient } from "./readiness-client";

export default async function ReadinessPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { level, report } = await getReadiness(user.id);
  const meta = EXAM_LEVELS.find((l) => l.value === level);

  return (
    <ReadinessClient
      levelLabel={meta ? `${meta.label} (${meta.cefr})` : null}
      report={report}
      isPro={isProUser(user)}
    />
  );
}
