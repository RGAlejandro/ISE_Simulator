import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { ResultsClient } from "./results-client";
import { OralResultsClient } from "./oral-results-client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { type } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (type === "oral") {
    const exam = await prisma.oralExam.findUnique({
      where: { id, userId: user.id },
      include: { feedback: true, exchanges: { orderBy: { order: "asc" } } },
    });

    if (!exam) redirect("/dashboard");

    return (
      <OralResultsClient
        exam={{
          id: exam.id,
          level: exam.level,
          status: exam.status,
          overallScore: exam.overallScore,
          createdAt: exam.createdAt.toISOString(),
        }}
        feedback={exam.feedback.map((f: typeof exam.feedback[number]) => ({
          taskType: f.taskType,
          feedback: f.feedback as Record<string, unknown>,
          score: f.score,
        }))}
        exchanges={exam.exchanges.map((e: typeof exam.exchanges[number]) => ({
          taskType: e.taskType,
          role: e.role,
          content: e.content,
        }))}
        isPro={user.plan === "PRO"}
      />
    );
  }

  const exam = await prisma.writtenExam.findUnique({
    where: { id, userId: user.id },
    include: { responses: true },
  });

  if (!exam) redirect("/dashboard");

  return (
    <ResultsClient
      exam={{
        id: exam.id,
        level: exam.level,
        status: exam.status,
        score: exam.score,
        createdAt: exam.createdAt.toISOString(),
      }}
      responses={exam.responses.map((r: typeof exam.responses[number]) => ({
        taskType: r.taskType,
        taskNumber: r.taskNumber,
        response: r.response,
        aiFeedback: r.aiFeedback ? JSON.parse(r.aiFeedback) : null,
        score: r.score,
      }))}
      isPro={user.plan === "PRO"}
    />
  );
}
