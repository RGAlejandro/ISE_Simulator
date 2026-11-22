import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { loadDashboardData } from "@/lib/dashboard-server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const data = await loadDashboardData(user);
  return <DashboardClient {...data} />;
}
