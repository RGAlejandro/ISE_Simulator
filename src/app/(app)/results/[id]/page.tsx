import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isProUser } from "@/lib/user";
import { ProfileViewingBanner } from "@/components/admin/profile-viewing-banner";
import { ResultsClient } from "./results-client";
import { OralResultsClient } from "./oral-results-client";
import type { LiveMetrics } from "@/lib/live-metrics";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { type } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Owners see their own results; admins can open anyone's read-only (learner profile).
  const isAdmin = user.plan === "ADMIN";
  const scope = isAdmin ? { id } : { id, userId: user.id };
  const owner = { select: { id: true, name: true, email: true } };
  const banner = (u: { id: string; name: string | null; email: string }) =>
    u.id === user.id ? null : <ProfileViewingBanner name={u.name ?? u.email} userId={u.id} />;

  if (type === "oral") {
    const exam = await prisma.oralExam.findUnique({
      where: scope,
      include: { feedback: true, exchanges: { orderBy: { order: "asc" } }, user: owner },
    });

    if (!exam) redirect("/dashboard");

    return (
      <>
      {banner(exam.user)}
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
        isPro={isProUser(user)}
        liveMetrics={exam.mode === "live" ? (exam.liveMetrics as unknown as LiveMetrics | null) : null}
        readOnly={exam.user.id !== user.id}
      />
      </>
    );
  }

  const exam = await prisma.writtenExam.findUnique({
    where: scope,
    include: { responses: true, user: owner },
  });

  if (!exam) redirect("/dashboard");

  return (
    <>
    {banner(exam.user)}
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
      isPro={isProUser(user)}
      readOnly={exam.user.id !== user.id}
      mode={exam.mode}
    />
    </>
  );
}
