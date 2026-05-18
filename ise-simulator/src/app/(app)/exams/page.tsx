import { redirect } from "next/navigation";
import type { Prisma, ExamLevel, ExamStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { ExamsClient } from "./exams-client";

type SearchParams = Promise<{
  type?: string;
  level?: string;
  status?: string;
  page?: string;
}>;

const PAGE_SIZE = 20;

const VALID_TYPES = ["all", "written", "oral"] as const;
const VALID_LEVELS = ["all", "ISE_FOUNDATION", "ISE_I", "ISE_II", "ISE_III", "ISE_IV"] as const;
const VALID_STATUS = ["all", "IN_PROGRESS", "COMPLETED", "EVALUATED"] as const;

export default async function ExamsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const params = await searchParams;

  const type   = (VALID_TYPES.includes(params.type as typeof VALID_TYPES[number]) ? params.type : "all") as typeof VALID_TYPES[number];
  const level  = (VALID_LEVELS.includes(params.level as typeof VALID_LEVELS[number]) ? params.level : "all") as typeof VALID_LEVELS[number];
  const status = (VALID_STATUS.includes(params.status as typeof VALID_STATUS[number]) ? params.status : "all") as typeof VALID_STATUS[number];
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const writtenWhere: Prisma.WrittenExamWhereInput = { userId: user.id };
  const oralWhere:    Prisma.OralExamWhereInput    = { userId: user.id };
  if (level !== "all") {
    writtenWhere.level = level as ExamLevel;
    oralWhere.level = level as ExamLevel;
  }
  if (status !== "all") {
    writtenWhere.status = status as ExamStatus;
    oralWhere.status = status as ExamStatus;
  }

  // Fetch all matching (we paginate after merging because we sort by createdAt across types).
  const [written, oral, totalAllWritten, totalAllOral] = await Promise.all([
    type === "oral" ? [] : prisma.writtenExam.findMany({
      where: writtenWhere,
      orderBy: { createdAt: "desc" },
      select: { id: true, level: true, status: true, score: true, createdAt: true },
    }),
    type === "written" ? [] : prisma.oralExam.findMany({
      where: oralWhere,
      orderBy: { createdAt: "desc" },
      select: { id: true, level: true, status: true, overallScore: true, createdAt: true },
    }),
    prisma.writtenExam.count({ where: { userId: user.id } }),
    prisma.oralExam.count({ where: { userId: user.id } }),
  ]);

  const merged = [
    ...written.map(e => ({
      id: e.id, type: "written" as const, level: e.level, status: e.status,
      score: e.score, createdAt: e.createdAt.toISOString(),
    })),
    ...oral.map(e => ({
      id: e.id, type: "oral" as const, level: e.level, status: e.status,
      score: e.overallScore, createdAt: e.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredCount = merged.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = merged.slice(start, start + PAGE_SIZE);

  return (
    <ExamsClient
      exams={slice}
      isPro={user.plan === "PRO" || user.plan === "ADMIN"}
      filters={{ type, level, status }}
      pagination={{ page: safePage, pageSize: PAGE_SIZE, totalPages, total: filteredCount }}
      totals={{ all: totalAllWritten + totalAllOral, written: totalAllWritten, oral: totalAllOral }}
    />
  );
}
