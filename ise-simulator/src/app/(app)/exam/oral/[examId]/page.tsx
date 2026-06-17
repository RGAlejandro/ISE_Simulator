import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { OralExamClient } from "./oral-exam-client";

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default async function OralExamPage({ params }: PageProps) {
  const { examId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const exam = await prisma.oralExam.findUnique({
    where: { id: examId, userId: user.id },
    include: {
      exchanges: { orderBy: { order: "asc" } },
    },
  });

  if (!exam) {
    redirect("/dashboard");
  }

  if (exam.status === "EVALUATED") {
    redirect(`/results/${exam.id}?type=oral`);
  }

  // Get the first examiner message
  const firstExchange = exam.exchanges[0];

  // Tasks the candidate opted into during setup. Empty array = legacy exam → run full canonical order.
  const selectedTasks = exam.selectedTasks?.length
    ? exam.selectedTasks
    : ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"];
  const initialTask = (firstExchange?.taskType as string) ?? selectedTasks[0];

  return (
    <OralExamClient
      examId={exam.id}
      level={exam.level}
      initialMessage={firstExchange?.content || ""}
      isPro={user.plan === "PRO" || user.plan === "ADMIN"}
      selectedTasks={selectedTasks}
      initialTask={initialTask}
      topicGeneral={exam.topicGeneral}
      topicDetailed={exam.topicDetailed}
    />
  );
}
