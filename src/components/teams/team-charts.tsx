"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/language-provider";
import { VIZ } from "@/components/readiness/readiness-parts";
import { HEATMAP_CRITERIA } from "@/lib/teams";
import { DISTINCTION, MERIT, PASS, type Skill } from "@/lib/readiness";
import type { TeamDashboard, TeamMemberRow } from "@/lib/teams-server";
import { cn } from "@/lib/utils";

// ─── KPI row (stat tiles) ───────────────────────────────────────────────────

export function KpiRow({ kpis }: { kpis: TeamDashboard["kpis"] }) {
  const { dict, t } = useI18n();
  const tm = dict.teams;
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  const tiles = [
    { label: tm.kpiStudents, value: String(kpis.students), hint: null },
    { label: tm.kpiActive, value: String(kpis.active7d), hint: t("teams.kpiOf", { n: kpis.active7d, total: kpis.students }) },
    { label: tm.kpiAvg, value: pct(kpis.avgPPass), hint: tm.kpiMeasured },
    { label: tm.kpiOnTrack, value: pct(kpis.onTrackShare), hint: tm.kpiMeasured },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((k) => (
        <div key={k.label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{k.label}</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{k.value}</p>
          {k.hint && <p className="mt-0.5 text-[11px] text-zinc-500">{k.hint}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Histogram of chance of passing (columns, one hue) ──────────────────────

export function ReadinessHistogram({ bins }: { bins: TeamDashboard["histogram"] }) {
  const { dict, t } = useI18n();
  const max = Math.max(1, ...bins.map((b) => b.count));
  const H = 140;
  return (
    <div>
      <div className="flex h-[176px] items-end justify-around gap-2 border-b border-zinc-300 pb-px dark:border-zinc-700" role="list">
        {bins.map((b) => {
          const h = b.count === 0 ? 0 : Math.max(4, (b.count / max) * H);
          const label = `${Math.round(b.from * 100)}–${Math.round(b.to * 100)}%: ${b.count === 1 ? dict.teams.histStudentsOne : t("teams.histStudents", { n: b.count })}`;
          return (
            <div key={b.from} role="listitem" tabIndex={0} aria-label={label} title={label} className="group flex w-full max-w-[64px] flex-col items-center justify-end gap-1 outline-none">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">{b.count > 0 ? b.count : ""}</span>
              <div
                className={cn("w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-[#2a78d6]", VIZ.fill)}
                style={{ height: h }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-around gap-2 text-[11px] text-zinc-500">
        {bins.map((b) => (
          <span key={b.from} className="w-full max-w-[64px] text-center tabular-nums">
            {Math.round(b.from * 100)}–{Math.round(b.to * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Class average per skill (meter list) ───────────────────────────────────

export function ClassSkills({ skills }: { skills: { skill: Skill; mean: number }[] }) {
  const { dict } = useI18n();
  return (
    <ul className="space-y-4 pt-4">
      {skills.map((s, i) => (
        <li key={s.skill} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
          <span className="text-sm text-zinc-800 dark:text-zinc-200">{dict.readiness.skill[s.skill]}</span>
          <div className="relative">
            {i === 0 && (
              <div className="pointer-events-none absolute -top-4 left-0 right-0 text-[10px] text-zinc-500" aria-hidden>
                {[
                  [PASS, "P"],
                  [MERIT, "M"],
                  [DISTINCTION, "D"],
                ].map(([v, l]) => (
                  <span key={l as string} className="absolute -translate-x-1/2" style={{ left: `${v}%` }}>
                    {l}
                  </span>
                ))}
              </div>
            )}
            <div className={cn("relative h-2.5 rounded-full", VIZ.track)}>
              <div className={cn("h-full rounded-full", VIZ.fill)} style={{ width: `${s.mean}%` }} />
              {[PASS, MERIT, DISTINCTION].map((v) => (
                <span key={v} className={cn("absolute -top-1 h-[18px] w-px", VIZ.tick)} style={{ left: `${v}%` }} aria-hidden />
              ))}
            </div>
          </div>
          <span className="text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">{s.mean ? Math.round(s.mean) : "—"}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Criteria heatmap (diverging around the Pass line) ──────────────────────

/** Steps per arm of the diverging scale; the midpoint (≈ Pass) is neutral gray. */
function heatStep(v: number): { mix: number; pole: "blue" | "red" | null } {
  const d = v - 0.5;
  const t = Math.abs(d) / 0.5;
  if (t < 0.12) return { mix: 0, pole: null };
  return { mix: t < 0.4 ? 40 : t < 0.7 ? 70 : 100, pole: d > 0 ? "blue" : "red" };
}

export function CriteriaHeatmap({ members }: { members: TeamMemberRow[] }) {
  const { dict } = useI18n();
  const tm = dict.teams;
  const [showValues, setShowValues] = useState(false);
  const label = (i: number) => {
    const h = HEATMAP_CRITERIA[i];
    return `${dict.readiness.skill[h.skill]} · ${dict.readiness.criterion[h.key as keyof typeof dict.readiness.criterion]}`;
  };

  return (
    <div className="space-y-3 [--heat-blue:#2a78d6] [--heat-mid:#f0efec] [--heat-red:#e34948] dark:[--heat-blue:#3987e5] dark:[--heat-mid:#383835] dark:[--heat-red:#e66767]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th />
              <th colSpan={4} className="pb-1 text-left font-semibold text-zinc-600 dark:text-zinc-300">{dict.readiness.skill.speaking}</th>
              <th colSpan={4} className="pb-1 text-left font-semibold text-zinc-600 dark:text-zinc-300">{dict.readiness.skill.writing}</th>
            </tr>
            <tr>
              <th />
              {HEATMAP_CRITERIA.map((h) => (
                <th key={`${h.skill}:${h.key}`} className="h-16 w-[11%] px-1 pb-1 align-bottom text-left text-[10px] font-medium leading-tight text-zinc-500">
                  {dict.readiness.criterion[h.key as keyof typeof dict.readiness.criterion]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <th scope="row" className="max-w-[9rem] truncate pr-2 text-left font-medium text-zinc-800 dark:text-zinc-200">
                  {m.name}
                </th>
                {m.cells.map((v, i) => {
                  const s = v === null ? null : heatStep(v);
                  const text = v === null ? tm.heatNoData : `${Math.round(v * 100)}%`;
                  return (
                    <td
                      key={i}
                      tabIndex={0}
                      title={`${m.name} · ${label(i)}: ${text}`}
                      aria-label={`${m.name}, ${label(i)}: ${text}`}
                      className={cn(
                        "h-8 rounded-[4px] text-center tabular-nums outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-white",
                        v === null && "bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgba(120,120,120,0.18)_4px_5px)]",
                        s && s.mix >= 70 ? "text-white" : "text-zinc-900 dark:text-zinc-100",
                      )}
                      style={
                        s
                          ? { backgroundColor: s.pole ? `color-mix(in oklab, var(--heat-${s.pole}) ${s.mix}%, var(--heat-mid))` : "var(--heat-mid)" }
                          : undefined
                      }
                    >
                      {showValues && v !== null ? Math.round(v * 100) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span>{tm.heatBelow}</span>
          {[100, 70, 40].map((m) => (
            <span key={`r${m}`} className="h-3 w-5 rounded-[3px]" style={{ backgroundColor: `color-mix(in oklab, var(--heat-red) ${m}%, var(--heat-mid))` }} />
          ))}
          <span className="h-3 w-5 rounded-[3px]" style={{ backgroundColor: "var(--heat-mid)" }} />
          {[40, 70, 100].map((m) => (
            <span key={`b${m}`} className="h-3 w-5 rounded-[3px]" style={{ backgroundColor: `color-mix(in oklab, var(--heat-blue) ${m}%, var(--heat-mid))` }} />
          ))}
          <span>{tm.heatAbove}</span>
          <span className="ml-3 h-3 w-5 rounded-[3px] bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgba(120,120,120,0.25)_4px_5px)] ring-1 ring-zinc-200 dark:ring-zinc-700" />
          <span>{tm.heatNoData}</span>
        </div>
        <button type="button" onClick={() => setShowValues((v) => !v)} className="font-medium underline-offset-2 hover:underline">
          {showValues ? tm.heatHideValues : tm.heatShowValues}
        </button>
      </div>
    </div>
  );
}

// ─── Class errors (ranked horizontal bars) ──────────────────────────────────

export function ClassErrors({ errors, students }: { errors: TeamDashboard["classErrors"]; students: number }) {
  const { dict, t } = useI18n();
  if (errors.length === 0) return <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.teams.errorsEmpty}</p>;
  return (
    <ul className="space-y-3">
      {errors.map((e) => {
        const share = students ? e.students / students : 0;
        return (
          <li key={e.tag} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-zinc-800 dark:text-zinc-200">{dict.writing.tags[e.tag as keyof typeof dict.writing.tags] ?? e.tag}</span>
              <span className="shrink-0 text-xs text-zinc-500">{t("teams.errorsStudents", { n: e.students, total: students })}</span>
            </div>
            <div className={cn("h-2 rounded-full", VIZ.track)}>
              <div className={cn("h-full rounded-full", VIZ.fill)} style={{ width: `${Math.round(share * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
