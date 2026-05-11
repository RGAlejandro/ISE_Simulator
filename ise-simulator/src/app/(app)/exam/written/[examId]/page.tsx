import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { WrittenExamClient } from "./written-exam-client";
import type { WrittenExamContent } from "@/types";

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default async function WrittenExamPage({ params }: PageProps) {
  const { examId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const exam = await prisma.writtenExam.findUnique({
    where: { id: examId, userId: user.id },
  });

  if (!exam) redirect("/dashboard");
  if (exam.status === "EVALUATED") redirect(`/results/${examId}`);

  const content = exam.content as unknown as WrittenExamContent;

  return <WrittenExamClient examId={exam.id} content={content} level={exam.level} />;
}
