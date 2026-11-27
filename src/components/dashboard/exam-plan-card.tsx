"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { bandFromScore } from "@/lib/writing";
import { cn } from "@/lib/utils";
import type { PlanPhase, PlanTarget } from "@/lib/study-plan";
import type { ExamLevel, WritingTaskType } from "@/types";

export type ExamModulesValue = "BOTH" | "READING_WRITING" | "SPEAKING_LISTENING";
export type TargetBandValue = "PASS" | "MERIT" | "DISTINCTION";
const MODULE_OPTIONS: ExamModulesValue[] = ["BOTH", "READING_WRITING", "SPEAKING_LISTENING"];
const TARGET_OPTIONS: TargetBandValue[] = ["PASS", "MERIT", "DISTINCTION"];

export interface ExamPlanData {
  goal: { examDate: string; examLevel: ExamLevel } | null;
  /** Module(s) still to pass, the band aimed for and the level (set even without a date). */
  focus: { examModules: ExamModulesValue; targetBand: TargetBandValue; examLevel: ExamLevel | null };
  levels: { value: ExamLevel; label: string }[];
  plan: {
    daysLeft: number;
    phase: PlanPhase;
    targets: PlanTarget[];
    dueToday: number;
    reviewedToday: boolean;
    /** Writing Lab text submitted today, if any (ticks off today's writing). */
    wroteToday: { practiceId: string; genre: string } | null;
    suggestion: { taskType: WritingTaskType; genre: string };
    /** First-draft scores at the exam level, oldest first. */
    writingScores: number[];
    genresCovered: number;
    genresTotal: number;
  } | null;
}

/** True when an admin views a learner's dashboard: rows stay readable but are not links. */
export const ReadOnlyContext = createContext(false);

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
  const [level, setLevel] = useState<ExamLevel>(data.focus.examLevel ?? "ISE_III");
  const [modules, setModules] = useState<ExamModulesValue>(data.focus.examModules);
  const [target, setTarget] = useState<TargetBandValue>(data.focus.targetBand);
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
        body: JSON.stringify({ examDate: date, examLevel: level, examModules: modules, targetBand: target }),
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

  const g = dict.goal;
  const chip = (active: boolean) => cn(
    "rounded-md border px-3 py-1.5 text-sm transition-colors",
    active ? "border-ink bg-ink text-paper" : "border-rule text-ink hover:border-ink",
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{p.setupBody}</p>
      <fieldset className="space-y-1.5">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{g.modulesLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {MODULE_OPTIONS.map((m) => (
            <button key={m} type="button" aria-pressed={modules === m} onClick={() => setModules(m)} className={chip(modules === m)}>{g.modules[m]}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1.5">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{g.targetLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {TARGET_OPTIONS.map((tb) => (
            <button key={tb} type="button" aria-pressed={target === tb} onClick={() => setTarget(tb)} className={chip(target === tb)}>{g.targets[tb]}</button>
          ))}
        </div>
      </fieldset>
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
        {onCancel && <Button variant="ghost" onClick={onCancel}>{p.cancel}</Button>}
      </div>
      {error && <p className="text-sm text-pen">{error}</p>}
    </div>
  );
}

/** Big countdown for the page header. */
export function ExamCountdown({ data, onEdit }: { data: ExamPlanData; onEdit?: () => void }) {
  const { dict, locale } = useI18n();
  const p = dict.dashboard.plan;
  if (!data.goal || !data.plan) {
    if (!onEdit) return <p className="text-sm text-ink-soft">{dict.adminProfile.noGoal}</p>;
    return (
      <button type="button" onClick={onEdit} className="text-sm font-medium text-ink underline decoration-marker decoration-4 underline-offset-4">
        {dict.dashboard.nb.setGoal}
      </button>
    );
  }
  const { plan, goal } = data;
  const date = new Date(`${goal.examDate}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long" });
  // Kept short on purpose so it sits on the same line as the name; the goal itself is shown by GoalSummary.
  return (
    <div className="text-left sm:text-right">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{date}</p>
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
      {onEdit && (
        <button type="button" onClick={onEdit} className="mt-1 inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
          <Pencil className="h-3 w-3" /> {dict.goal.change}
        </button>
      )}
    </div>
  );
}

/** One line under the learner's name: level · module(s) still to pass · target band. */
export function GoalSummary({ data }: { data: ExamPlanData }) {
  const { dict } = useI18n();
  const level = data.focus.examLevel ? data.levels.find((l) => l.value === data.focus.examLevel)?.label : null;
  const parts = [level, dict.goal.modules[data.focus.examModules], `${dict.goal.targetLabel}: ${dict.goal.targets[data.focus.targetBand]}`].filter(Boolean);
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
      {parts.map((x, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-rule">·</span>}
          {x}
        </span>
      ))}
    </span>
  );
}

/** Weekly targets as a checklist, plus the writing level trend. */
export function WeekPlan({ data }: { data: ExamPlanData }) {
  const { dict, t } = useI18n();
  const readOnly = useContext(ReadOnlyContext);
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
              <Link href={readOnly ? "#" : tg.href} aria-disabled={readOnly} tabIndex={readOnly ? -1 : undefined} onClick={readOnly ? (e) => e.preventDefault() : undefined} className="group flex items-center gap-3 py-2.5">
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
      {data.focus.examModules === "SPEAKING_LISTENING" ? (
        <TodayRow href="/exam/oral/setup?mode=live" label={dict.live.ctaPractice} meta={dict.goal.modules.SPEAKING_LISTENING} />
      ) : plan.wroteToday ? (
        <li className="flex items-center gap-3 py-3 text-sm text-ink-soft">
          <Check className="h-4 w-4" />
          <span className="line-through decoration-ink-soft/50 first-letter:uppercase">{t("dashboard.nb.wroteToday", { genre: plan.wroteToday.genre })}</span>
        </li>
      ) : (
        <TodayRow
          href={`/writing?type=${plan.suggestion.taskType}&genre=${encodeURIComponent(plan.suggestion.genre)}&level=${goal.examLevel}`}
          label={t("dashboard.plan.todayWriting", { genre: plan.suggestion.genre })}
          meta={`Writing · ${plan.suggestion.taskType === "READING_INTO_WRITING" ? "Task 3" : "Task 4"}`}
        />
      )}
    </>
  );
}

export function TodayRow({ href, label, meta, trailing }: { href: string; label: string; meta?: string; trailing?: React.ReactNode }) {
  const readOnly = useContext(ReadOnlyContext);
  if (readOnly) {
    return (
      <li className="flex items-center gap-4 py-3">
        <span aria-hidden className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-ink-soft/50" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-ink first-letter:uppercase">{label}</span>
          {meta && <span className="block text-xs text-ink-soft">{meta}</span>}
        </span>
      </li>
    );
  }
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
