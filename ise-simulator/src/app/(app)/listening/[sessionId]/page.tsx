import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { ListeningClient } from "./listening-client";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function ListeningSessionPage({ params }: Props) {
  const { sessionId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const session = await prisma.listeningSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.userId !== user.id) notFound();

  return (
    <ListeningClient
      sessionId={session.id}
      level={session.level}
      passageText={session.passageText}
      passageTitle={session.passageTitle}
      passageTopic={session.passageTopic}
      informationType={session.informationType || session.passageTopic}
      existingRound1Score={session.round1Score}
      existingRound1Feedback={session.round1Feedback as object | null}
      existingRound2Feedback={session.round2Feedback as object | null}
      overallScore={session.overallScore}
      isAdmin={user.plan === "ADMIN"}
    />
  );
}
