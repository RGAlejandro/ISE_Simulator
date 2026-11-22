"use client";

import { useI18n } from "@/components/i18n/language-provider";
import { BandChip, OutOfScopeNote, ReadinessHero } from "@/components/readiness/readiness-parts";
import { InkBar, PenNote } from "@/components/notebook/notebook";
import { PASS, TARGET_SCORE, type ReadinessReport } from "@/lib/readiness";

/** Dashboard summary of the Trinity Readiness Score: headline chance + the four skills. */
export function ReadinessCard({ report }: { report: ReadinessReport }) {
  const { dict } = useI18n();
  const r = dict.readiness;
  const limiting = report.overall.limitingSkill;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ReadinessHero report={report} compact />
      <ul className="space-y-3.5">
        {report.skills.map((s) => (
          <li key={s.skill} className="space-y-1.5">
            <div className="flex items-baseline gap-3">
              <span className="w-20 shrink-0 text-sm font-medium text-ink">{r.skill[s.skill]}</span>
              <span className="font-display text-lg tabular-nums text-ink">{s.count > 0 ? Math.round(s.mean) : "—"}</span>
              <span className="ml-auto">{s.count > 0 ? <BandChip band={s.band} /> : <span className="text-xs text-ink-soft">{r.conf.none}</span>}</span>
            </div>
            <InkBar value={s.count > 0 ? s.mean : 0} mark={TARGET_SCORE[report.focus.target]} tone={s.count > 0 && s.mean < PASS ? "pen" : "ink"} />
            {s.skill === limiting && report.overall.band !== "distinction" && (
              <PenNote className="text-lg">{dict.dashboard.nb.priority}</PenNote>
            )}
          </li>
        ))}
        <li><OutOfScopeNote report={report} /></li>
      </ul>
    </div>
  );
}
