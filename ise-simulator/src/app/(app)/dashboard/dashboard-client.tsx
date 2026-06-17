"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import {
  PenTool, Mic, BarChart2, Trophy, ChevronRight, Upload, FileText, Lock,
  Flame, TrendingUp, Sparkles, Crown, Target, Calendar, ArrowUpRight, Rocket, Trash2,
} from "lucide-react";
import { Sparkline } from "@/components/admin/sparkline";
import { cn } from "@/lib/utils";
import type { UserUsage } from "@/types";

interface Stats {
  avgScore: number | null;
  bestScore: number | null;
  streak: number;
  activity14: { date: string; count: number }[];
  last7Count: number;
  evaluatedCount: number;
}

interface DashboardClientProps {
  user: { name: string | null; email: string; plan: string };
  usage: UserUsage;
  isPro: boolean;
  recentExams: Array<{
    id: string;
    type: "written" | "oral";
    level: string;
    status: string;
    score: number | null;
    createdAt: string;
  }>;
  totalExams: number;
  levels: Array<{ value: string; label: string; cefr: string; color: string }>;
  stats: Stats;
}

const LEVEL_SHORT: Record<string, string> = {
  ISE_FOUNDATION: "Foundation (A2)",
  ISE_I: "ISE I (B1)",
  ISE_II: "ISE II (B2)",
  ISE_III: "ISE III (C1)",
  ISE_IV: "ISE IV (C2)",
};

function greetingKey() {
  const h = new Date().getHours();
  if (h < 5)  return "dashboard.greeting.late";
  if (h < 12) return "dashboard.greeting.morning";
  if (h < 18) return "dashboard.greeting.afternoon";
  return "dashboard.greeting.evening";
}

export function ExamListRow({ exam, isPro, onDelete }: {
  exam: { id: string; type: "written" | "oral"; level: string; status: string; score: number | null; createdAt: string };
  isPro: boolean;
  /** When provided, shows a delete (soft-hide) button that calls this with the exam. */
  onDelete?: (exam: { id: string; type: "written" | "oral" }) => void;
}) {
  const t = useT();
  const isWritten = exam.type === "written";
  const isEvaluated = exam.status === "EVALUATED";
  const isInProgress = exam.status === "IN_PROGRESS";

  const resultsHref = isWritten ? `/results/${exam.id}` : `/results/${exam.id}?type=oral`;
  const continueHref = isWritten ? `/exam/written/${exam.id}` : `/exam/oral/${exam.id}`;
  const submitPaperHref = `/exam/paper/${exam.id}/submit`;

  const bandLabel = (score: number | null) => {
    if (score === null) return null;
    if (score >= 80) return { label: t("dashboard.bands.distinction"), cls: "text-purple-600 dark:text-purple-400" };
    if (score >= 65) return { label: t("dashboard.bands.merit"),       cls: "text-blue-600 dark:text-blue-400" };
    if (score >= 50) return { label: t("dashboard.bands.pass"),        cls: "text-green-600 dark:text-green-400" };
    return { label: t("dashboard.bands.fail"), cls: "text-red-500" };
  };
  const band = bandLabel(exam.score);

  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
      {/* Side accent */}
      <span className={cn("absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full", isWritten ? "bg-blue-500" : "bg-purple-500")} />

      {/* Icon */}
      <div className={cn(
        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
        isWritten ? "bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300"
                  : "bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300",
      )}>
        {isWritten ? <PenTool className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </div>

      {/* Meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
            {LEVEL_SHORT[exam.level] ?? exam.level}
          </p>
          <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {isWritten ? t("dashboard.exam.written") : t("dashboard.exam.oral")}
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {new Date(exam.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      </div>

      {/* Score */}
      {exam.score !== null && (
        <div className="text-right shrink-0 mr-2">
          <p className="text-sm sm:text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100 leading-tight">{Math.round(exam.score)}%</p>
          {band && <p className={cn("text-[10px] font-medium uppercase tracking-wide hidden sm:block", band.cls)}>{band.label}</p>}
        </div>
      )}

      {/* Status badge */}
      <div className="hidden sm:block shrink-0">
        {isEvaluated  && <Badge variant="success" className="text-[10px]">{t("dashboard.exam.evaluated")}</Badge>}
        {isInProgress && <Badge variant="warning" className="text-[10px]">{t("dashboard.exam.inProgress")}</Badge>}
        {!isEvaluated && !isInProgress && <Badge variant="default" className="text-[10px]">{t("dashboard.exam.completed")}</Badge>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isEvaluated ? (
          <>
            {!isPro && (
              <span className="hidden lg:flex items-center gap-1 text-[10px] text-zinc-400">
                <Lock className="h-3 w-3" /> {t("dashboard.exam.fullFeedbackPro")}
              </span>
            )}
            <Link href={resultsHref}>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                {t("dashboard.exam.results")} <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </>
        ) : isInProgress ? (
          <>
            {isWritten && (
              <Link href={submitPaperHref} className="hidden md:block">
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                  <Upload className="h-3 w-3" /> {t("dashboard.exam.submit")}
                </Button>
              </Link>
            )}
            <Link href={continueHref}>
              <Button size="sm" className="h-8 gap-1 text-xs">
                {isWritten ? <FileText className="h-3 w-3" /> : <Mic className="h-3 w-3" />} {t("dashboard.exam.continue")}
              </Button>
            </Link>
          </>
        ) : (
          <Link href={resultsHref}>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
              {t("dashboard.exam.view")} <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete({ id: exam.id, type: exam.type })}
            title={t("dashboard.exam.delete")}
            aria-label={t("dashboard.exam.delete")}
            className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface KpiProps {
  label: string; value: string | number; hint?: string; icon: React.ReactNode;
  tone: "blue" | "purple" | "green" | "orange" | "rose";
}

const KPI_TONES: Record<KpiProps["tone"], { iconBg: string; ring: string; bg: string }> = {
  blue:   { iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300",   ring: "ring-blue-200/60 dark:ring-blue-900/40",   bg: "from-blue-50/80 to-transparent dark:from-blue-950/30" },
  purple: { iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300", ring: "ring-purple-200/60 dark:ring-purple-900/40", bg: "from-purple-50/80 to-transparent dark:from-purple-950/30" },
  green:  { iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300", ring: "ring-emerald-200/60 dark:ring-emerald-900/40", bg: "from-emerald-50/80 to-transparent dark:from-emerald-950/30" },
  orange: { iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300", ring: "ring-orange-200/60 dark:ring-orange-900/40", bg: "from-orange-50/80 to-transparent dark:from-orange-950/30" },
  rose:   { iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300",   ring: "ring-rose-200/60 dark:ring-rose-900/40",   bg: "from-rose-50/80 to-transparent dark:from-rose-950/30" },
};

function Kpi({ label, value, hint, icon, tone }: KpiProps) {
  const t = KPI_TONES[tone];
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 sm:p-5 ring-1", t.ring)}>
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", t.bg)} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
          {hint && <p className="mt-1 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 leading-tight">{hint}</p>}
        </div>
        <div className={cn("flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl", t.iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function DashboardClient({ user, isPro, recentExams, totalExams, stats, usage }: DashboardClientProps) {
  const t = useT();
  const planTone = user.plan === "ADMIN" ? "purple" : user.plan === "PRO" ? "amber" : "zinc";
  const planIcon = user.plan === "ADMIN"
    ? <Sparkles className="h-3.5 w-3.5" />
    : user.plan === "PRO"
    ? <Crown className="h-3.5 w-3.5" />
    : null;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/30 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-300">{t(greetingKey())}</p>
              <h1 className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 break-words">
                {user.name || user.email.split("@")[0]}
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {stats.streak > 0
                  ? renderStreakLine(t("dashboard.streakLine", { n: stats.streak }))
                  : t("dashboard.welcomeLine")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn(
                "px-3 py-1.5 text-sm gap-1.5 backdrop-blur bg-white/70 dark:bg-zinc-900/60",
                planTone === "purple" && "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300",
                planTone === "amber"  && "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300",
              )}>
                {planIcon}
                {user.plan} {t("common.plan")}
              </Badge>
              {!isPro && (
                <Link href="/pricing">
                  <Button size="sm" className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                    <Crown className="h-3.5 w-3.5" /> {t("common.upgrade")}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Primary CTA — go to Practice */}
        <Link href="/practice" className="block group">
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-5 sm:p-6 lg:p-7 transition-shadow hover:shadow-xl">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="relative flex items-center gap-3 sm:gap-5">
              <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Rocket className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold leading-tight">{t("dashboard.ctaTitle")}</h2>
                <p className="mt-1 text-xs sm:text-sm text-white/85 leading-snug">{t("dashboard.ctaSubtitle")}</p>
              </div>
              <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </div>
          </div>
        </Link>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Kpi
            label={t("dashboard.kpi.streak")}
            value={stats.streak}
            hint={stats.streak === 1 ? t("dashboard.kpi.streakHintOne") : t("dashboard.kpi.streakHint")}
            icon={<Flame className="h-5 w-5" />}
            tone="orange"
          />
          <Kpi
            label={t("dashboard.kpi.totalExams")}
            value={totalExams}
            hint={t("dashboard.kpi.evaluatedHint", { n: stats.evaluatedCount })}
            icon={<Trophy className="h-5 w-5" />}
            tone="green"
          />
          <Kpi
            label={t("dashboard.kpi.avgScore")}
            value={stats.avgScore !== null ? `${Math.round(stats.avgScore)}%` : "—"}
            hint={stats.avgScore !== null ? t("dashboard.kpi.avgScoreHint") : t("dashboard.kpi.avgScoreEmpty")}
            icon={<BarChart2 className="h-5 w-5" />}
            tone="blue"
          />
          <Kpi
            label={t("dashboard.kpi.bestScore")}
            value={stats.bestScore !== null ? `${Math.round(stats.bestScore)}%` : "—"}
            hint={stats.bestScore !== null ? bandFor(stats.bestScore, t) : t("dashboard.kpi.bestScoreEmpty")}
            icon={<Sparkles className="h-5 w-5" />}
            tone="purple"
          />
          <Kpi
            label={t("dashboard.kpi.last7")}
            value={stats.last7Count}
            hint={stats.last7Count === 1 ? t("dashboard.kpi.last7HintOne") : t("dashboard.kpi.last7Hint")}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="rose"
          />
        </div>

        {/* Activity chart + Today usage */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("dashboard.activity.title")}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("dashboard.activity.subtitle")}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <Calendar className="h-3.5 w-3.5" />
                {t("dashboard.activity.sessions", { n: stats.activity14.reduce((a, b) => a + b.count, 0) })}
              </div>
            </div>
            <Sparkline data={stats.activity14.map(b => ({ label: b.date, value: b.count }))} height={110} />
            <div className="mt-2 flex justify-between text-[10px] text-zinc-400 tabular-nums">
              <span>{stats.activity14[0]?.date.slice(5)}</span>
              <span>Today</span>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{t("dashboard.usage.title")}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              {isPro ? t("dashboard.usage.unlimited") : t("dashboard.usage.free")}
            </p>
            <UsageBar label={t("dashboard.usage.written")}   used={usage.writtenCount}   limit={isPro ? null : 1} color="bg-blue-500" />
            <UsageBar label={t("dashboard.usage.oral")}      used={usage.oralCount}      limit={isPro ? null : 1} color="bg-purple-500" />
            <UsageBar label={t("dashboard.usage.listening")} used={usage.listeningCount} limit={isPro ? null : 1} color="bg-rose-500" />
          </div>
        </div>

        {/* Recommendation / Next-step card */}
        {totalExams === 0 ? (
          <NextStepCard
            icon={<Target className="h-6 w-6" />}
            title={t("dashboard.nextStep.firstTitle")}
            body={t("dashboard.nextStep.firstBody")}
            ctaHref="/practice"
            ctaLabel={t("dashboard.nextStep.cta")}
          />
        ) : stats.streak === 0 ? (
          <NextStepCard
            icon={<Flame className="h-6 w-6" />}
            title={t("dashboard.nextStep.streakTitle")}
            body={t("dashboard.nextStep.streakBody")}
            ctaHref="/practice"
            ctaLabel={t("dashboard.nextStep.ctaShort")}
          />
        ) : null}

        {/* Recent exams */}
        {recentExams.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{t("dashboard.recent.title")}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("dashboard.recent.subtitle")}</p>
              </div>
              {totalExams > recentExams.length && (
                <Link href="/exams" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0">
                  {t("dashboard.recent.viewAll", { n: totalExams })}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {recentExams.map((exam) => (
                <ExamListRow key={exam.id} exam={exam} isPro={isPro} />
              ))}
            </div>
            <div className="mt-3 flex justify-center sm:hidden">
              {totalExams > recentExams.length && (
                <Link href="/exams" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  {t("dashboard.recent.viewAll", { n: totalExams })} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function bandFor(score: number, t: (key: string) => string) {
  if (score >= 80) return t("dashboard.bands.distinction");
  if (score >= 65) return t("dashboard.bands.merit");
  if (score >= 50) return t("dashboard.bands.pass");
  return t("dashboard.bands.fail");
}

function renderStreakLine(template: string) {
  // Template like "You're on a 3-day streak. Keep it going!" — extract number for span styling
  const match = template.match(/(\d+)/);
  if (!match) return template;
  const [before, ...rest] = template.split(match[0]);
  const after = rest.join(match[0]);
  return (
    <>
      {before}
      <span className="font-semibold text-orange-600 dark:text-orange-300">{match[0]}</span>
      {after}
    </>
  );
}

function UsageBar({ label, used, limit, color }: { label: string; used: number; limit: number | null; color: string }) {
  const pct = limit === null ? Math.min(used * 25, 100) : Math.min((used / limit) * 100, 100);
  const isOver = limit !== null && used >= limit;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className={cn("font-medium tabular-nums", isOver ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-100")}>
          {used}{limit !== null && ` / ${limit}`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", isOver ? "bg-rose-500" : color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NextStepCard({ icon, title, body, ctaHref, ctaLabel }: {
  icon: React.ReactNode; title: string; body: string; ctaHref: string; ctaLabel: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:border-zinc-800 dark:from-indigo-950/30 dark:via-zinc-900 dark:to-purple-950/30 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{body}</p>
          <Link href={ctaHref}>
            <Button size="sm" variant="outline" className="mt-3 gap-1.5">
              {ctaLabel} <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
