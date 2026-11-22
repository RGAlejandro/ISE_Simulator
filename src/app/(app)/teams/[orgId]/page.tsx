import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { getMembership, getTeamDashboard, isTeacherRole } from "@/lib/teams-server";
import { TeamPanelClient } from "./team-panel-client";

export default async function TeamPanelPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Students (and outsiders) never see the teacher panel.
  const membership = await getMembership(user.id, orgId);
  if (!isTeacherRole(membership?.role)) redirect("/teams");

  const dashboard = await getTeamDashboard(orgId);
  if (!dashboard) redirect("/teams");

  return <TeamPanelClient data={dashboard} isAdmin={user.plan === "ADMIN"} />;
}
