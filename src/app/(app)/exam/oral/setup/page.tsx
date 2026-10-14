import { redirect } from "next/navigation";
import { getCurrentUser, getDailyUsage } from "@/lib/user";
import { OralSetupClient } from "./setup-client";

type SearchParams = Promise<{ level?: string }>;

export default async function OralExamSetupPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const usage = await getDailyUsage(user.id);
  if (!usage.canTakeOral) {
    redirect("/practice?error=oral_limit");
  }

  const params = await searchParams;

  return <OralSetupClient initialLevel={params.level ?? null} />;
}
