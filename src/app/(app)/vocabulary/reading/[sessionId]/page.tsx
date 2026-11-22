import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { toLookupData } from "@/lib/reading";
import { ReadingSessionClient } from "./reading-session-client";
import type { CefrBand } from "@/lib/prompts/vocabulary";
import type { ReadingAnswer, ReadingContent } from "@/types";

export default async function ReadingSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const session = await prisma.readingSession.findUnique({
    where: { id: sessionId },
    include: { reading: true, lookups: { orderBy: { createdAt: "asc" } } },
  });
  if (!session || session.userId !== user.id) notFound();

  const result =
    session.completedAt && session.score !== null && session.total !== null
      ? { answers: (session.answers ?? []) as ReadingAnswer[], score: session.score, total: session.total }
      : null;

  return (
    <ReadingSessionClient
      sessionId={session.id}
      title={session.reading.title}
      level={session.reading.level as CefrBand}
      topic={session.reading.topic}
      content={session.reading.content as unknown as ReadingContent}
      initialLookups={session.lookups.map(toLookupData)}
      initialResult={result}
    />
  );
}
