import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isProUser } from "@/lib/user";
import { LESSON_TYPE, TEACHABLE_TAGS, diagnose, errorsSince } from "@/lib/teacher";
import { canStartLesson, loadMarkedDrafts } from "@/lib/teacher-server";
import { TeacherHomeClient, type WeakSpot, type LessonRow } from "./teacher-home-client";

export const metadata = { title: "Teacher — ISE Simulator" };

/** Weak spots shown with a lesson button. */
const TOP = 5;

export default async function TeacherPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const isPro = isProUser(user);

  const [drafts, lessons, canStart] = await Promise.all([
    loadMarkedDrafts(user.id),
    prisma.grammarSession.findMany({
      where: { userId: user.id, exerciseType: LESSON_TYPE },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, focus: true, lesson: true, questions: true, score: true, completedAt: true, createdAt: true },
    }),
    canStartLesson(user.id, isPro),
  ]);

  const diagnosis = diagnose(drafts, 2);
  const counts = Object.fromEntries(diagnosis.map((d) => [d.tag, d.count]));
  const total = (q: unknown) => (Array.isArray(q) ? q.length : 0);

  const weak: WeakSpot[] = diagnosis.slice(0, TOP).map((d) => {
    const last = lessons.find((l) => l.focus === d.tag && l.completedAt);
    return {
      tag: d.tag,
      count: d.count,
      writings: d.writings,
      example: d.examples[0] ? { quote: d.examples[0].quote, correction: d.examples[0].correction } : null,
      last: last && last.completedAt
        ? {
            date: last.completedAt.toISOString(),
            score: last.score ?? 0,
            total: total(last.questions),
            since: errorsSince(drafts, d.tag, last.completedAt),
          }
        : null,
    };
  });

  const history: LessonRow[] = lessons.slice(0, 12).map((l) => ({
    id: l.id,
    focus: l.focus ?? "",
    title: (l.lesson as { title?: string } | null)?.title ?? "",
    score: l.score,
    total: total(l.questions),
    completed: !!l.completedAt,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <TeacherHomeClient
      writings={drafts.length}
      weak={weak}
      topics={TEACHABLE_TAGS.map((tag) => ({ tag, count: counts[tag] ?? 0 }))}
      history={history}
      canStart={canStart}
      isPro={isPro}
    />
  );
}
