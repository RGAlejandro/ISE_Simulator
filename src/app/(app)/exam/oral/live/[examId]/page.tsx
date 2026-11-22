import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { EXAM_LEVELS } from "@/lib/constants";
import { getPersona } from "@/lib/examiner-personas";
import { buildLivePlan } from "@/lib/live-examiner";
import { LiveExamClient } from "./live-exam-client";

const SESSION_WINDOW_MS = 45 * 60_000;

export default async function LiveOralExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const exam = await prisma.oralExam.findFirst({
    where: { id: examId, userId: user.id },
    select: { id: true, level: true, mode: true, status: true, selectedTasks: true, examinerPersona: true, createdAt: true },
  });
  if (!exam) redirect("/dashboard");
  if (exam.mode !== "live") redirect(`/exam/oral/${exam.id}`);
  if (exam.status === "EVALUATED") redirect(`/results/${exam.id}?type=oral`);

  const persona = getPersona(exam.examinerPersona);
  const level = EXAM_LEVELS.find((l) => l.value === exam.level);
  // Render-time check on a request-scoped page (not a cached component), so Date.now() is fine here.
  // eslint-disable-next-line react-hooks/purity
  const expired = exam.status === "IN_PROGRESS" && Date.now() - exam.createdAt.getTime() > SESSION_WINDOW_MS;

  return (
    <LiveExamClient
      examId={exam.id}
      levelLabel={level ? `${level.label} · ${level.cefr}` : exam.level}
      plan={buildLivePlan(exam.level, exam.selectedTasks)}
      persona={{ name: persona.name, accent: persona.accent, flag: persona.flag }}
      initialState={exam.status === "COMPLETED" ? "saved" : expired ? "expired" : "ready"}
    />
  );
}
