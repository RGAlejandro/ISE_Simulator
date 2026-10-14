import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { PaperResultsClient } from "./results-client";

interface PageProps {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ submissionId?: string }>;
}

export default async function PaperResultsPage({ params, searchParams }: PageProps) {
  const { examId } = await params;
  const { submissionId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!submissionId) redirect(`/exam/paper/${examId}/submit`);

  const submission = await prisma.paperSubmission.findUnique({
    where: { id: submissionId, userId: user.id },
  });
  if (!submission) redirect(`/exam/paper/${examId}/submit`);

  return (
    <PaperResultsClient
      examId={examId}
      level={submission.level}
      feedback={submission.feedback as Record<string, unknown>}
      score={submission.score}
    />
  );
}
