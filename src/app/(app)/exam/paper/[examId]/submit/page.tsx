import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { SubmitPaperClient } from "./submit-client";
import type { WrittenExamContent } from "@/types";

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default async function SubmitPaperPage({ params }: PageProps) {
  const { examId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const exam = await prisma.writtenExam.findUnique({
    where: { id: examId, userId: user.id },
  });
  if (!exam) redirect("/practice");

  const content = exam.content as unknown as WrittenExamContent;

  return (
    <SubmitPaperClient
      examId={examId}
      level={exam.level}
      content={content}
    />
  );
}
