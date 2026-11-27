import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { parseSelfAssessment } from "@/lib/welcome";
import { WelcomeClient } from "./welcome-client";

export const metadata = { title: "Welcome — ISE Simulator" };

/** First-run welcome (exam goal, self-assessment, first exercise). Can be reopened later to change the answers. */
export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return (
    <WelcomeClient
      firstName={user.name?.trim().split(/\s+/)[0] || null}
      initial={{
        examLevel: user.examLevel,
        examDate: user.examDate ? user.examDate.toISOString().slice(0, 10) : null,
        examModules: user.examModules,
        targetBand: user.targetBand,
        selfAssessment: parseSelfAssessment(user.selfAssessment) ?? {},
      }}
    />
  );
}
