"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { bandFromScore } from "@/lib/writing";
import { cn } from "@/lib/utils";
import type { PlanPhase, PlanTarget } from "@/lib/study-plan";
import type { ExamLevel, WritingTaskType } from "@/types";

export interface ExamPlanData {
  goal: { examDate: string; examLevel: ExamLevel } | null;
  levels: { value: ExamLevel; label: string }[];
  plan: {
    daysLeft: number;
    phase: PlanPhase;
    targets: PlanTarget[];
    dueToday: number;
    reviewedToday: boolean;
    suggestion: { taskType: WritingTaskType; genre: string };
    /** First-draft scores at the exam level, oldest first. */
    writingScores: number[];
    genresCovered: number;
    genresTotal: number;
  } | null;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inputCls = "h-10 rounded-md border border-rule bg-transparent px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-marker";

/** Set or change the exam date and level. */
export function ExamGoalForm({ data, onCancel }: { data: ExamPlanData; onCancel?: () => void }) {
  const { dict } = useI18n();
  const p = dict.dashboard.plan;
  const router = useRouter();
  const [date, setDate] = useState(data.goal?.examDate ?? "");
  const [level, setLevel] = useState<ExamLevel>(data.goal?.examLevel ?? "ISE_III");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!date || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/exam-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examDate: date, examLevel: level }),
      });
      if (!res.ok) throw new Error();
      onCancel?.();
      router.refresh();
    } catch {
      setError(p.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">{p.setupBody}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{p.dateLabel}</span>
          <input id="exam-goal-date" type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{p.levelLabel}</span>
          <select id="exam-goal-level" value={level} onChange={(e) => setLevel(e.target.value as ExamLevel)} className={inputCls}>
            {data.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <Button onClick={save} disabled={!date || saving} className="gap-1.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {p.save}
        </Button>
        {onCancel && data.goal && <Button variant="ghost" onClick={onCancel}>{p.cancel}</Button>}
      </div>
      {error && <p className="text-sm text-pen">{error}</p>}
    </div>
  );
}

/** Big countdown for the page header. */
export function ExamCountdown({ data, onEdit }: { data: ExamPlanData; onEdit: () => void }) {
  const { dict, t, locale } = useI18n();
  const p = dict.dashboard.plan;
  if (!data.goal || !data.plan) {
    return (
      <button type="button" onClick={onEdit} className="text-sm font-medium text-ink underline decoration-marker decoration-4 underline-offset-4">
        {dict.dashboard.nb.setGoal}
      </button>
    );
  }
  const { plan, goal } = data;
  const level = data.levels.find((l) => l.value === goal.examLevel)?.label ?? goal.examLevel;
  const date = new Date(`${goal.examDate}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long" });
  return (
    <div className="text-left sm:text-right">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {t("dashboard.nb.examOn", { level, date })}
      </p>
      {plan.phase === "examDay" ? (
        <p className="font-display text-3xl font-semibold text-ink"><span className="marker-underline">{p.examDayTitle}</span></p>
      ) : plan.phase === "past" ? (
        <p className="font-display text-2xl font-semibold text-ink">{p.pastTitle}</p>
      ) : (
        <p className="font-display text-ink">
          <span className="marker-underline text-6xl font-semibold tabular-nums leading-none">{plan.daysLeft}</span>
          <span className="ml-2 text-lg text-ink-soft">{plan.daysLeft === 1 ? dict.dashboard.nb.dayUnit : dict.dashboard.nb.daysUnit}</span>
        </p>
      )}
      <button type="button" onClick={onEdit} className="mt-1 inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
        <Pencil className="h-3 w-3" /> {dict.dashboard.nb.changeDate}
      </button>
    </div>
  );
}

/** Weekly targets as a checklist, plus the writing level trend. */
export function WeekPlan({ data }: { data: ExamPlanData }) {
  const { dict, t } = useI18n();
  const p = dict.dashboard.plan;
  if (!data.plan) return null;
  const { plan } = data;
  const recent = plan.writingScores.slice(-3);
  const avg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
  const band = avg !== null ? bandFromScore(avg) : null;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_16rem]">
      <ul className="divide-y divide-rule border-y border-rule">
        {plan.targets.map((tg) => {
          const complete = tg.done >= tg.target;
          return (
            <li key={tg.key}>
              <Link href={tg.href} className="group flex items-center gap-3 py-2.5">
                <span
                  aria-hidden
                  className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border-2", complete ? "border-ink bg-ink text-paper" : "border-ink-soft/50")}
                >
                  {complete && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className={cn("flex-1 text-sm text-ink group-hover:underline decoration-marker decoration-2 underline-offset-4", complete && "text-ink-soft line-through decoration-ink-soft/50")}>
                  {p.targets[tg.key]}
                </span>
                <span className="font-display text-base tabular-nums text-ink-soft">
                  {Math.min(tg.done, tg.target)}<span className="text-ink-soft/60">/{tg.target}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{p.writingLevel}</p>
          {band && avg !== null && <span className="font-display text-sm text-ink">{dict.writing.bands[band]} · {avg.toFixed(1)}</span>}
        </div>
        {plan.writingScores.length === 0 ? (
          <p className="text-xs text-ink-soft">{p.writingLevelEmpty}</p>
        ) : (
          <div className="relative flex h-16 items-end gap-1.5 border-b border-ink/40" aria-hidden>
            {/* Pass line (2.0 / 4) */}
            <span className="absolute inset-x-0 border-t border-dashed border-ink-soft/40" style={{ bottom: "50%" }} />
            {plan.writingScores.map((s, i) => (
              <div
                key={i}
                className={cn("w-4 rounded-t-[2px]", s >= 2 ? "bg-ink" : "bg-pen")}
                style={{ height: `${Math.max(6, (s / 4) * 100)}%`, opacity: 0.35 + (0.65 * (i + 1)) / plan.writingScores.length }}
              />
            ))}
          </div>
        )}
        <p className="text-xs text-ink-soft">{t("dashboard.plan.genresCovered", { done: plan.genresCovered, total: plan.genresTotal })}</p>
      </div>
    </div>
  );
}

/** Today's plan items (vocabulary review, suggested writing) as list rows. */
export function TodayItems({ data }: { data: ExamPlanData }) {
  const { dict, t } = useI18n();
  const p = dict.dashboard.plan;
  if (!data.goal || !data.plan || data.plan.phase === "examDay" || data.plan.phase === "past") return null;
  const { plan, goal } = data;
  return (
    <>
      {plan.dueToday > 0 ? (
        <TodayRow href="/vocabulary/review" label={t("dashboard.plan.todayReview", { n: plan.dueToday })} meta={dict.vocab.review.title} />
      ) : plan.reviewedToday ? (
        <li className="flex items-center gap-3 py-3 text-sm text-ink-soft">
          <Check className="h-4 w-4" /> <span className="line-through decoration-ink-soft/50">{p.todayReviewDone}</span>
        </li>
      ) : null}
      <TodayRow
        href={`/writing?type=${plan.suggestion.taskType}&genre=${encodeURIComponent(plan.suggestion.genre)}&level=${goal.examLevel}`}
        label={t("dashboard.plan.todayWriting", { genre: plan.suggestion.genre })}
        meta={`Writing Lab · ${plan.suggestion.taskType === "READING_INTO_WRITING" ? "Task 3" : "Task 4"}`}
      />
    </>
  );
}

export function TodayRow({ href, label, meta, trailing }: { href: string; label: string; meta?: string; trailing?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-4 py-3">
        <span aria-hidden className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-ink-soft/50" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-ink first-letter:uppercase group-hover:underline decoration-marker decoration-4 underline-offset-2">{label}</span>
          {meta && <span className="block text-xs text-ink-soft">{meta}</span>}
        </span>
        {trailing ?? <ArrowRight className="h-4 w-4 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />}
      </Link>
    </li>
  );
}
