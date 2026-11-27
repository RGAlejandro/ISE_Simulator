"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/language-provider";
import { ChevronRight, FileText, Lock, Mic, PenTool, Trash2, Upload } from "lucide-react";
import { Sparkline } from "@/components/admin/sparkline";
import { ExamCountdown, ExamGoalForm, GoalSummary, ReadOnlyContext, TodayItems, WeekPlan, type ExamPlanData } from "@/components/dashboard/exam-plan-card";
import { ReadinessCard } from "@/components/dashboard/readiness-card";
import { AssignmentRows } from "@/components/dashboard/assignments-card";
import { InkLink, Ledger, LedgerRow, NotebookHeader, NotebookPage, Section, Stamp, type StampBand } from "@/components/notebook/notebook";
import type { StudentAssignment } from "@/lib/teams-server";
import type { ReadinessReport } from "@/lib/readiness";
import { cn } from "@/lib/utils";
import { bandFromScore } from "@/lib/writing";
import type { FirstStep } from "@/lib/welcome";
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
  examPlan: ExamPlanData;
  /** The recommended first marked exercise (from the welcome's self-assessment). */
  firstStep: FirstStep;
  readiness: { report: ReadinessReport; levelLabel: string } | null;
  assignments: StudentAssignment[];
  /** Admin viewing a learner: no editing, no action links, extra sections. */
  profile?: {
    userId: string;
    meta: string;
    writings: { id: string; title: string; genre: string; taskType: string; versions: number; score: number | null; updatedAt: string }[];
    lists: { id: string; name: string; emoji: string; words: number }[];
  };
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

function scoreBand(score: number): StampBand {
  if (score >= 80) return "distinction";
  if (score >= 65) return "merit";
  if (score >= 50) return "pass";
  return "below";
}

const BAND_KEY: Record<StampBand, string> = {
  distinction: "dashboard.bands.distinction",
  merit: "dashboard.bands.merit",
  pass: "dashboard.bands.pass",
  below: "dashboard.bands.fail",
};

export function ExamListRow({ exam, isPro, onDelete }: {
  exam: { id: string; type: "written" | "oral"; /** Practice → Reading (Tasks 1 and 2 only). */ reading?: boolean; level: string; status: string; score: number | null; createdAt: string };
  isPro: boolean;
  /** When provided, shows a delete (soft-hide) button that calls this with the exam. */
  onDelete?: (exam: { id: string; type: "written" | "oral" }) => void;
}) {
  const { t, locale } = useI18n();
  const isWritten = exam.type === "written";
  const isEvaluated = exam.status === "EVALUATED";
  const isInProgress = exam.status === "IN_PROGRESS";

  const resultsHref = isWritten ? `/results/${exam.id}` : `/results/${exam.id}?type=oral`;
  const continueHref = isWritten ? `/exam/written/${exam.id}` : `/exam/oral/${exam.id}`;
  const submitPaperHref = `/exam/paper/${exam.id}/submit`;
  const band = exam.score !== null ? scoreBand(exam.score) : null;

  const linkCls = "inline-flex items-center gap-1 text-xs font-medium text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-marker";

  return (
    <div className="group flex items-center gap-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center text-ink-soft" aria-hidden>
        {isWritten ? <PenTool className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ink">
          {LEVEL_SHORT[exam.level] ?? exam.level}
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
            {exam.reading ? t("dashboard.exam.reading") : isWritten ? t("dashboard.exam.written") : t("dashboard.exam.oral")}
          </span>
        </p>
        <p className="text-xs text-ink-soft tabular-nums">
          {new Date(exam.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
          {isInProgress && <span className="ml-2 font-hand text-base text-pen">{t("dashboard.exam.inProgress")}</span>}
        </p>
      </div>

      {exam.score !== null && (
        <span className="shrink-0 font-display text-xl tabular-nums text-ink">{Math.round(exam.score)}%</span>
      )}
      <span className="hidden w-28 shrink-0 justify-end sm:flex">
        {band && isEvaluated && <Stamp band={band}>{t(BAND_KEY[band])}</Stamp>}
      </span>

      <div className="flex shrink-0 items-center gap-3">
        {isEvaluated ? (
          <>
            {!isPro && (
              <span className="hidden items-center gap-1 text-[10px] text-ink-soft lg:flex">
                <Lock className="h-3 w-3" /> {t("dashboard.exam.fullFeedbackPro")}
              </span>
            )}
            <Link href={resultsHref} className={linkCls}>
              {t("dashboard.exam.results")} <ChevronRight className="h-3 w-3" />
            </Link>
          </>
        ) : isInProgress ? (
          <>
            {isWritten && !exam.reading && (
              <Link href={submitPaperHref} className={cn(linkCls, "hidden md:inline-flex")}>
                <Upload className="h-3 w-3" /> {t("dashboard.exam.submit")}
              </Link>
            )}
            <Link href={continueHref} className={linkCls}>
              {isWritten ? <FileText className="h-3 w-3" /> : <Mic className="h-3 w-3" />} {t("dashboard.exam.continue")}
            </Link>
          </>
        ) : (
          <Link href={resultsHref} className={linkCls}>
            {t("dashboard.exam.view")} <ChevronRight className="h-3 w-3" />
          </Link>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete({ id: exam.id, type: exam.type })}
            title={t("dashboard.exam.delete")}
            aria-label={t("dashboard.exam.delete")}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-soft hover:text-pen transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function DashboardClient({ user, isPro, recentExams, totalExams, stats, usage, examPlan, firstStep, readiness, assignments, profile }: DashboardClientProps) {
  const { t, dict, locale } = useI18n();
  const nb = dict.dashboard.nb;
  const [editingGoal, setEditingGoal] = useState(false);

  const plan = examPlan.plan;
  const hasToday = assignments.length > 0 || (!!plan && plan.phase !== "examDay" && plan.phase !== "past");
  const todayLabel = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const sessions14 = stats.activity14.reduce((a, b) => a + b.count, 0);

  const showWeek = !!plan && plan.phase !== "examDay" && plan.phase !== "past";
  const readOnly = !!profile;
  // A brand-new learner gets a guided start instead of empty sections.
  const hasEvidence = (readiness?.report.overall.observations ?? 0) > 0;
  const hasLevel = !!examPlan.focus.examLevel;
  const onboarding = !readOnly && (!hasLevel || !hasEvidence);
  const showToday = hasToday || !onboarding;
  const showReadiness = !!readiness && (hasEvidence || readOnly);
  const showActivity = totalExams > 0 || sessions14 > 0 || hasEvidence || readOnly;
  // Section numbers in the margin follow the sections actually shown.
  const order = [
    onboarding ? "start" : null, showToday ? "today" : null, showReadiness ? "readiness" : null, showWeek ? "week" : null,
    showActivity ? "activity" : null, recentExams.length > 0 ? "recent" : null,
    profile ? "writings" : null, profile ? "lists" : null,
  ].filter(Boolean);
  const num = (key: string) => order.indexOf(key) + 1;

  return (
    <ReadOnlyContext.Provider value={readOnly}>
    <div className="flex-1 bg-paper">
      <NotebookPage>
        {profile && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-6">
            <p className="font-hand text-xl leading-none text-pen">{t("adminProfile.banner", { name: user.name ?? user.email })}</p>
            <InkLink href="/admin/users">{dict.adminProfile.back}</InkLink>
          </div>
        )}
        <NotebookHeader
          eyebrow={profile ? profile.meta : <>{t(greetingKey())} · <span className="first-letter:uppercase">{todayLabel}</span></>}
          title={user.name || user.email.split("@")[0]}
          subtitle={profile ? <>{user.email}<GoalSummary data={examPlan} /></> : (
            <>
              {stats.streak > 0 ? t("dashboard.streakLine", { n: stats.streak }) : t("dashboard.welcomeLine")}
              {!isPro && (
                <Link href="/pricing" className="ml-2 font-medium text-ink underline decoration-marker decoration-4 underline-offset-2">
                  {t("common.upgrade")}
                </Link>
              )}
              <GoalSummary data={examPlan} />
            </>
          )}
          aside={<ExamCountdown data={examPlan} onEdit={readOnly ? undefined : () => setEditingGoal(true)} />}
        />

        {!readOnly && editingGoal && (
          <Section title={dict.goal.change}>
            <ExamGoalForm data={examPlan} onCancel={() => setEditingGoal(false)} />
          </Section>
        )}

        {onboarding && (
          <Section n={num("start")} title={nb.start.title}>
            <p className="-mt-2 mb-4 max-w-2xl text-sm leading-relaxed text-ink-soft">{nb.start.intro}</p>
            <ol className="divide-y divide-rule border-y border-rule">
              <StartStep n={1} done={hasLevel} title={nb.start.step1} meta={nb.start.step1Meta}>
                {!hasLevel && <div className="pb-5 pl-12"><ExamGoalForm data={examPlan} /></div>}
              </StartStep>
              <StartStep
                n={2}
                done={hasEvidence || totalExams > 0}
                title={t("dashboard.nb.start.step2", { skill: dict.readiness.skill[firstStep.skill] })}
                meta={firstStep.selfRated ? dict.welcome.start.reasonSelf : dict.welcome.start.reasonDefault}
                href={firstStep.href}
              />
              <StartStep n={3} done={hasEvidence} title={nb.start.step3} meta={nb.start.step3Meta} href="/readiness" />
            </ol>
          </Section>
        )}

        {showToday && <Section n={num("today")} title={nb.today} action={readOnly ? undefined : <InkLink href="/practice">{nb.toPractice}</InkLink>}>
          {hasToday ? (
            <ul className="divide-y divide-rule border-y border-rule">
              <AssignmentRows items={assignments} />
              <TodayItems data={examPlan} />
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">{nb.nothingToday}</p>
          )}
        </Section>}

        {showReadiness && readiness && (
          <Section
            n={num("readiness")}
            eyebrow={readiness.levelLabel}
            title={nb.readiness}
            action={readOnly ? undefined : <InkLink href="/readiness">{nb.readinessLink}</InkLink>}
          >
            <ReadinessCard report={readiness.report} />
          </Section>
        )}

        {plan && showWeek && (
          <Section
            n={num("week")}
            eyebrow={t("dashboard.nb.phase", { phase: dict.dashboard.plan.phase[plan.phase as keyof typeof dict.dashboard.plan.phase] })}
            title={nb.week}
          >
            <p className="-mt-2 mb-4 max-w-2xl text-sm text-ink-soft">{dict.dashboard.plan.phaseHint[plan.phase as keyof typeof dict.dashboard.plan.phaseHint]}</p>
            <WeekPlan data={examPlan} />
          </Section>
        )}

        {showActivity && <Section n={num("activity")} title={nb.activity}>
          <div className="grid gap-10 md:grid-cols-[18rem_minmax(0,1fr)]">
            <Ledger>
              <LedgerRow label={t("dashboard.kpi.streak")} value={stats.streak} emphasis />
              <LedgerRow label={t("dashboard.kpi.totalExams")} value={totalExams} hint={t("dashboard.kpi.evaluatedHint", { n: stats.evaluatedCount })} />
              <LedgerRow label={t("dashboard.kpi.avgScore")} value={stats.avgScore !== null ? `${Math.round(stats.avgScore)}%` : "—"} />
              <LedgerRow
                label={t("dashboard.kpi.bestScore")}
                value={stats.bestScore !== null ? `${Math.round(stats.bestScore)}%` : "—"}
                hint={stats.bestScore !== null ? t(BAND_KEY[scoreBand(stats.bestScore)]) : undefined}
              />
              <LedgerRow label={t("dashboard.kpi.last7")} value={stats.last7Count} />
            </Ledger>
            <div className="min-w-0 space-y-4">
              <div>
                <div className="mb-1 flex items-baseline justify-between text-xs text-ink-soft">
                  <span>{t("dashboard.activity.subtitle")}</span>
                  <span className="tabular-nums">{t("dashboard.activity.sessions", { n: sessions14 })}</span>
                </div>
                <div className="text-ink">
                  <Sparkline data={stats.activity14.map((b) => ({ label: b.date, value: b.count }))} height={96} stroke="currentColor" fill="rgba(120,130,160,0.14)" />
                </div>
                <div className="mt-1 flex justify-between border-t border-ink/30 pt-1 text-[10px] text-ink-soft tabular-nums">
                  <span>{stats.activity14[0]?.date.slice(5)}</span>
                  <span>{stats.activity14[stats.activity14.length - 1]?.date.slice(5)}</span>
                </div>
              </div>
              {!isPro && !readOnly && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{nb.usageToday}</p>
                  <Ledger>
                  <LedgerRow label={t("dashboard.usage.written")} value={`${usage.writtenCount} / 1`} />
                  <LedgerRow label={t("dashboard.usage.oral")} value={`${usage.oralCount} / 1`} />
                  <LedgerRow label={t("dashboard.usage.listening")} value={`${usage.listeningCount} / 3`} />
                  </Ledger>
                </div>
              )}
            </div>
          </div>
        </Section>}

        {recentExams.length > 0 && (
          <Section
            n={num("recent")}
            title={t("dashboard.recent.title")}
            action={totalExams > recentExams.length && !readOnly ? <InkLink href="/exams">{t("dashboard.recent.viewAll", { n: totalExams })}</InkLink> : undefined}
          >
            <div className="divide-y divide-rule border-y border-rule">
              {recentExams.map((exam) => (
                <ExamListRow key={exam.id} exam={exam} isPro={isPro || readOnly} />
              ))}
            </div>
          </Section>
        )}

        {profile && (
          <Section n={num("writings")} title={dict.adminProfile.writingsTitle}>
            {profile.writings.length === 0 ? (
              <p className="text-sm text-ink-soft">{dict.adminProfile.writingsEmpty}</p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {profile.writings.map((w) => {
                  const band = w.score !== null ? bandFromScore(w.score) : null;
                  return (
                    <li key={w.id}>
                      <Link href={`/writing/${w.id}`} className="group flex items-center gap-4 py-3">
                        <span className="w-10 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{w.taskType === "READING_INTO_WRITING" ? "T3" : "T4"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium text-ink group-hover:underline decoration-marker decoration-4 underline-offset-2">{w.title}</span>
                          <span className="block text-xs text-ink-soft first-letter:uppercase">
                            {w.genre} · {w.versions === 1 ? dict.adminProfile.versionOne : t("adminProfile.versions", { n: w.versions })} · {new Date(w.updatedAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                          </span>
                        </span>
                        {w.score !== null && <span className="font-display text-xl tabular-nums text-ink">{w.score.toFixed(1)}</span>}
                        <span className="hidden w-28 justify-end sm:flex">{band && <Stamp band={band}>{t(BAND_KEY[band])}</Stamp>}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        )}

        {profile && (
          <Section n={num("lists")} title={dict.adminProfile.listsTitle}>
            {profile.lists.length === 0 ? (
              <p className="text-sm text-ink-soft">{dict.adminProfile.listsEmpty}</p>
            ) : (
              <Ledger className="max-w-xl">
                {profile.lists.map((l) => (
                  <LedgerRow key={l.id} label={`${l.emoji} ${l.name}`} value={t("adminProfile.words", { n: l.words })} />
                ))}
              </Ledger>
            )}
          </Section>
        )}
      </NotebookPage>
    </div>
    </ReadOnlyContext.Provider>
  );
}

/** One step of the first-run guide: a checkbox, a title and, when pending, a link. */
function StartStep({ n, done, title, meta, href, children }: {
  n: number; done: boolean; title: string; meta: string; href?: string; children?: React.ReactNode;
}) {
  const head = (
    <span className="flex items-center gap-4 py-3.5">
      <span
        aria-hidden
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-semibold",
          done ? "border-ink bg-ink text-paper" : "border-ink-soft/50 text-ink-soft",
        )}
      >
        {done ? "✓" : n}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-medium", done ? "text-ink-soft line-through decoration-ink-soft/50" : "text-ink group-hover:underline decoration-marker decoration-4 underline-offset-2")}>{title}</span>
        <span className="block text-xs text-ink-soft">{meta}</span>
      </span>
      {href && !done && <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft group-hover:text-ink" />}
    </span>
  );
  return (
    <li>
      {href && !done ? <Link href={href} className="group block">{head}</Link> : head}
      {children}
    </li>
  );
}
