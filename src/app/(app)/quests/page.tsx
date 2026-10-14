import { QuestsClient } from "./quests-client";

export const metadata = {
  title: "Quests — ISE Simulator",
  description: "Gamified vocabulary practice: earn XP, keep your streak, climb the leaderboard.",
};

export default function QuestsPage() {
  return <QuestsClient />;
}
