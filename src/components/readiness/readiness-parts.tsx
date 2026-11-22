"use client";

import { ChevronDown } from "lucide-react";
import { InkLink, Stamp } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { DISTINCTION, MERIT, PASS, READY_LINE, type Band, type ReadinessReport, type Skill, type SkillEstimate } from "@/lib/readiness";

/*
 * Chart tokens (validated with the dataviz palette checker on the app's card
 * surfaces: #ffffff light, #18181b dark). One hue — the data is magnitude,
 * not identity — so every meter uses the same blue; text stays in ink tokens.
 */
export const VIZ = {
  fill: "bg-[#2a78d6] dark:bg-[#3987e5]",
  track: "bg-[#cde2fb] dark:bg-[#104281]",
  band: "bg-[#2a78d6]/25 dark:bg-[#3987e5]/30",
  tick: "bg-zinc-400/80 dark:bg-zinc-500",
} as const;

export const SKILL_HREF: Record<Skill, string> = {
  reading: "/practice",
  writing: "/writing",
  speaking: "/exam/oral/setup?mode=live",
  listening: "/practice",
};

const pct = (p: number) => Math.round(p * 100);

/** Predicted Trinity band as an examiner's stamp. */
export function BandChip({ band, className }: { band: Band; className?: string }) {
  const { dict } = useI18n();
  return <Stamp band={band} className={className}>{dict.readiness.band[band]}</Stamp>;
}

/** Hero figure + meter against the ready line. */
export function ReadinessHero({ report, compact = false }: { report: ReadinessReport; compact?: boolean }) {
  const { dict, t, locale } = useI18n();
  const r = dict.readiness;
  const { overall, projection } = report;
  const p = pct(overall.pPass);
  const fmtDate = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(iso));

  let projectionText: string;
  if (projection.readyNow) {
    projectionText = projection.marginDays !== null && projection.marginDays > 0 ? t("readiness.readyNowExam", { n: projection.marginDays }) : r.readyNow;
  } else if (projection.readyBy) {
    const margin =
      projection.marginDays === null
        ? "."
        : `: ${projection.marginDays >= 0 ? t("readiness.marginEarly", { n: projection.marginDays }) : t("readiness.marginLate", { n: -projection.marginDays })}`;
    projectionText = `${t("readiness.readyBy", { date: fmtDate(projection.readyBy) })}${margin}`;
  } else {
    projectionText = r.noTrend;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className={cn("font-display font-semibold leading-none tracking-tight text-ink tabular-nums", compact ? "text-6xl" : "text-7xl sm:text-8xl")}>
          <span className="marker-underline">{p}</span>
          <span className={cn("align-top font-medium text-ink-soft", compact ? "text-2xl" : "text-3xl")}>%</span>
        </p>
        <p className="pb-1 text-sm text-ink-soft">{r.heroLabel}</p>
      </div>

      {/* Meter: share of the way to certainty, with the ready line marked. */}
      <div className="relative" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label={r.heroLabel}>
        <div className={cn("h-3 overflow-hidden rounded-full", VIZ.track)}>
          <div className={cn("h-full rounded-full transition-[width] duration-700", VIZ.fill)} style={{ width: `${p}%` }} />
        </div>
        <span className="absolute -top-1 h-5 w-px bg-zinc-700 dark:bg-zinc-300" style={{ left: `${READY_LINE * 100}%` }} aria-hidden />
        <span
          className="absolute top-5 -translate-x-1/2 whitespace-nowrap text-[11px] text-zinc-500 dark:text-zinc-400"
          style={{ left: `${READY_LINE * 100}%` }}
        >
          {t("readiness.readyLine", { p: READY_LINE * 100 })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-4 text-xs text-ink-soft">
        <span>{r.predictedBand}</span>
        <BandChip band={overall.band} />
        {overall.limitingSkill && overall.band !== "distinction" && (
          <span>{t("readiness.limitedBy", { skill: r.skill[overall.limitingSkill] })}</span>
        )}
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span>
          {r.confidence}: <span className="font-medium text-zinc-800 dark:text-zinc-200">{r.conf[overall.confidence]}</span>
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span>{overall.observations === 1 ? r.observationsOne : t("readiness.observations", { n: overall.observations })}</span>
      </div>

      <p className={cn("text-ink", compact ? "text-sm" : "text-base")}>
        {projectionText}
        {projection.trendPerWeek !== null && projection.trendPerWeek !== 0 && !compact && (
          <span className="ml-2 text-sm text-zinc-500">
            ({projection.trendPerWeek > 0 ? "+" : ""}
            {t("readiness.trend", { delta: Math.round(projection.trendPerWeek * 100) })})
          </span>
        )}
      </p>
    </div>
  );
}

function SkillRow({ s, showAxis }: { s: SkillEstimate; showAxis: boolean }) {
  const { dict, t, locale } = useI18n();
  const r = dict.readiness;
  const lo = Math.max(0, s.mean - s.sd);
  const hi = Math.min(100, s.mean + s.sd);
  const attempts = s.count === 0 ? r.noAttempts : s.count === 1 ? r.attemptsOne : t("readiness.attempts", { n: s.count });
  const last = s.lastAt ? t("readiness.last", { date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(s.lastAt)) }) : null;
  const label = `${r.skill[s.skill]}: ${Math.round(s.mean)}/100 (${r.band[s.band]}), ±${Math.round(s.sd)}, ${t("readiness.pPass", { p: pct(s.pPass) })}`;

  return (
    <li className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[9rem_minmax(0,1fr)_7.5rem]">
      <div className="min-w-0">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{r.skill[s.skill]}</p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {attempts}
          {last && ` · ${last}`}
        </p>
      </div>

      <div
        tabIndex={0}
        aria-label={label}
        className="relative order-last col-span-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#2a78d6] sm:order-none sm:col-span-1"
      >
        {showAxis && (
          <div className="pointer-events-none absolute -top-5 left-0 right-0 hidden text-[10px] text-zinc-500 sm:block" aria-hidden>
            {[
              [PASS, "Pass"],
              [MERIT, "Merit"],
              [DISTINCTION, "Dist."],
            ].map(([v, l]) => (
              <span key={l as string} className="absolute -translate-x-1/2" style={{ left: `${v}%` }}>
                {l}
              </span>
            ))}
          </div>
        )}
        <div className={cn("relative h-2.5 rounded-full", VIZ.track)}>
          {/* Uncertainty range */}
          <div className={cn("absolute inset-y-0 rounded-full", VIZ.band)} style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
          {/* Estimate */}
          <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700", VIZ.fill, s.count === 0 && "opacity-40")} style={{ width: `${s.mean}%` }} />
          {[PASS, MERIT, DISTINCTION].map((v) => (
            <span key={v} className={cn("absolute -top-1 h-[18px] w-px", VIZ.tick)} style={{ left: `${v}%` }} aria-hidden />
          ))}
        </div>
        {/* Hover / focus readout */}
        <div className="pointer-events-none absolute -top-11 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus-within:block dark:bg-zinc-100 dark:text-zinc-900" style={{ left: `${Math.min(85, Math.max(15, s.mean))}%` }}>
          <span className="font-semibold">{Math.round(s.mean)}</span>
          <span className="opacity-70">/100 · ±{Math.round(s.sd)} · {r.band[s.band]}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 text-right">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("readiness.pPass", { p: pct(s.pPass) })}</span>
        {s.count > 0 ? <BandChip band={s.band} /> : <span className="text-xs text-zinc-500">{r.conf.none}</span>}
      </div>
    </li>
  );
}

export function SkillMeters({ skills }: { skills: SkillEstimate[] }) {
  return (
    <ul className="space-y-6 pt-5">
      {skills.map((s, i) => (
        <SkillRow key={s.skill} s={s} showAxis={i === 0} />
      ))}
    </ul>
  );
}

export function WeakestCriteria({ items }: { items: ReadinessReport["weakestCriteria"] }) {
  const { dict } = useI18n();
  const r = dict.readiness;
  if (items.length === 0) return <p className="text-sm text-zinc-500 dark:text-zinc-400">{r.criteriaEmpty}</p>;
  return (
    <ul className="space-y-4">
      {items.map((c) => {
        const name = r.criterion[c.key as keyof typeof r.criterion] ?? c.key;
        const v = Math.round(c.value * 100);
        return (
          <li key={`${c.skill}:${c.key}`} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 text-zinc-800 dark:text-zinc-200">
                <span className="text-zinc-500">{r.skill[c.skill]} · </span>
                {name}
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">{v}%</span>
            </div>
            <div className={cn("relative h-2 rounded-full", VIZ.track)} aria-hidden>
              <div className={cn("h-full rounded-full", VIZ.fill)} style={{ width: `${v}%` }} />
              <span className={cn("absolute -top-1 h-4 w-px", VIZ.tick)} style={{ left: "50%" }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ActionList({ actions, limit }: { actions: ReadinessReport["actions"]; limit?: number }) {
  const { dict, t } = useI18n();
  const r = dict.readiness;
  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {actions.slice(0, limit).map((a, i) => (
        <li key={a.skill} className="flex gap-4 py-3.5">
          <span className="font-display text-2xl font-semibold leading-none text-ink-soft/70 tabular-nums">{i + 1}</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm text-ink leading-snug">{t(`readiness.action.${a.reason}`, { skill: r.skill[a.skill] })}</p>
            <InkLink href={SKILL_HREF[a.skill]}>{r.actionCta[a.skill]}</InkLink>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Methodology() {
  const { dict } = useI18n();
  const r = dict.readiness;
  return (
    <details className="group border-t border-rule pt-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-semibold text-ink">
        {r.methodTitle}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <ol className="mt-3 max-w-3xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
        {r.method.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ol>
    </details>
  );
}
