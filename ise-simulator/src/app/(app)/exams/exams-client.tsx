"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExamListRow } from "../dashboard/dashboard-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, Filter, FileText, Mic, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type ExamItem = {
  id: string;
  type: "written" | "oral";
  level: string;
  status: string;
  score: number | null;
  createdAt: string;
};

const LEVEL_OPTIONS = [
  { value: "all",            label: "All levels" },
  { value: "ISE_FOUNDATION", label: "Foundation (A2)" },
  { value: "ISE_I",          label: "ISE I (B1)" },
  { value: "ISE_II",         label: "ISE II (B2)" },
  { value: "ISE_III",        label: "ISE III (C1)" },
  { value: "ISE_IV",         label: "ISE IV (C2)" },
];

const STATUS_OPTIONS = [
  { value: "all",         label: "All status" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED",   label: "Completed" },
  { value: "EVALUATED",   label: "Evaluated" },
];

interface Props {
  exams: ExamItem[];
  isPro: boolean;
  filters: { type: string; level: string; status: string };
  pagination: { page: number; pageSize: number; totalPages: number; total: number };
  totals: { all: number; written: number; oral: number };
}

export function ExamsClient({ exams, isPro, filters, pagination, totals }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "all") params.delete(k);
      else params.set(k, v);
    }
    // Reset page when filters change (unless explicitly setting page)
    if (!("page" in patch)) params.delete("page");
    const q = params.toString();
    return q ? `/exams?${q}` : "/exams";
  };

  const onFilterChange = (key: string, value: string) => {
    router.push(buildHref({ [key]: value }));
  };

  const hasFilters = filters.type !== "all" || filters.level !== "all" || filters.status !== "all";

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/30 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            My exams
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Full history across written and oral sessions.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5">
              <FileText className="h-3 w-3" /> {totals.written} written
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Mic className="h-3 w-3" /> {totals.oral} oral
            </Badge>
            <Badge variant="outline">Total: {totals.all}</Badge>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-zinc-500" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Filters</span>
            {hasFilters && (
              <Link href="/exams" className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Clear all
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Type */}
            <FilterGroup label="Type">
              <FilterPill active={filters.type === "all"}     onClick={() => onFilterChange("type", "all")}>All</FilterPill>
              <FilterPill active={filters.type === "written"} onClick={() => onFilterChange("type", "written")}>Written</FilterPill>
              <FilterPill active={filters.type === "oral"}    onClick={() => onFilterChange("type", "oral")}>Oral</FilterPill>
            </FilterGroup>

            {/* Level */}
            <FilterGroup label="Level">
              <select
                value={filters.level}
                onChange={(e) => onFilterChange("level", e.target.value)}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FilterGroup>

            {/* Status */}
            <FilterGroup label="Status">
              <select
                value={filters.status}
                onChange={(e) => onFilterChange("status", e.target.value)}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FilterGroup>
          </div>
        </div>

        {/* Results */}
        {exams.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              <Inbox className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No exams match these filters</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {hasFilters ? "Try clearing some filters." : "You haven't taken any exams yet."}
            </p>
            {!hasFilters && (
              <Link href="/practice">
                <Button size="sm" className="mt-4 gap-1.5">Start your first exam <ChevronRight className="h-3.5 w-3.5" /></Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {exams.map((exam) => (
                <ExamListRow key={`${exam.type}-${exam.id}`} exam={exam} isPro={isPro} />
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={buildHref({ page: pagination.page > 1 ? String(pagination.page - 1) : undefined })}
                    aria-disabled={pagination.page <= 1}
                    className={cn(pagination.page <= 1 && "pointer-events-none opacity-40")}
                  >
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                      <ChevronLeft className="h-3.5 w-3.5" /> Prev
                    </Button>
                  </Link>
                  <span className="text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <Link
                    href={buildHref({ page: pagination.page < pagination.totalPages ? String(pagination.page + 1) : undefined })}
                    aria-disabled={pagination.page >= pagination.totalPages}
                    className={cn(pagination.page >= pagination.totalPages && "pointer-events-none opacity-40")}
                  >
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</p>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
        active
          ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
          : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800",
      )}
    >
      {children}
    </button>
  );
}
