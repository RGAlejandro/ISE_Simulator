import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { ListeningClient } from "./listening-client";
import { ProfileViewingBanner } from "@/components/admin/profile-viewing-banner";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function ListeningSessionPage({ params }: Props) {
  const { sessionId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const session = await prisma.listeningSession.findUnique({
    where: { id: sessionId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Owners only; admins may open a learner's session read-only from their profile.
  const isOwner = session?.userId === user.id;
  if (!session || (!isOwner && user.plan !== "ADMIN")) notFound();

  return (
    <>
    {!isOwner && <ProfileViewingBanner name={session.user.name ?? session.user.email} userId={session.user.id} />}
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
    </>
  );
}
