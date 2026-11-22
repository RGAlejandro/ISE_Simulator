"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { ActionList, Methodology, OutOfScopeNote, ReadinessHero, SkillMeters, WeakestCriteria } from "@/components/readiness/readiness-parts";
import { TrajectoryChart } from "@/components/readiness/trajectory-chart";
import { NotebookHeader, NotebookPage, PenNote, Section } from "@/components/notebook/notebook";
import type { ReadinessReport } from "@/lib/readiness";

interface Props {
  levelLabel: string | null;
  report: ReadinessReport | null;
  isPro: boolean;
}

/** Pro gate: the breakdown renders blurred behind an upgrade prompt for free users. */
function ProGate({ isPro, children }: { isPro: boolean; children: React.ReactNode }) {
  const { dict } = useI18n();
  if (isPro) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-start justify-center pt-24">
        <div className="max-w-sm border-y-2 border-ink bg-paper px-6 py-5 text-center">
          <Lock className="mx-auto h-5 w-5 text-ink-soft" />
          <p className="mt-2 font-display text-lg font-semibold text-ink">{dict.readiness.lockedTitle}</p>
          <p className="mt-1 text-sm text-ink-soft">{dict.readiness.lockedBody}</p>
          <Button asChild className="mt-4">
            <Link href="/pricing">{dict.readiness.upgrade}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReadinessClient({ levelLabel, report, isPro }: Props) {
  const { dict, t } = useI18n();
  const r = dict.readiness;
  const limiting = report?.overall.limitingSkill;

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        <NotebookHeader
          eyebrow={levelLabel ?? undefined}
          title={<>{r.title} <span className="marker-underline italic">{r.titleAccent}</span></>}
          subtitle={levelLabel ? t("readiness.subtitle", { level: levelLabel }) : r.noLevel}
        />

        {!report ? (
          <Button asChild>
            <Link href="/dashboard">{r.setGoal}</Link>
          </Button>
        ) : (
          <>
            <Section n={1} title={dict.dashboard.nb.readiness}>
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <ReadinessHero report={report} />
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{r.actionsTitle}</p>
                  <ActionList actions={report.actions} target={report.focus.target} />
                </div>
              </div>
            </Section>

            <ProGate isPro={isPro}>
              <Section n={2} title={r.skillsTitle}>
                <p className="-mt-3 mb-2 max-w-2xl text-sm text-ink-soft">{r.skillsSubtitle}</p>
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <div>
                    <SkillMeters skills={report.skills} />
                    <OutOfScopeNote report={report} className="mt-4" />
                    {limiting && report.overall.band !== "distinction" && (
                      <PenNote className="mt-4">{dict.dashboard.nb.priority}: {r.skill[limiting]}</PenNote>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{r.criteriaTitle}</p>
                    <WeakestCriteria items={report.weakestCriteria} />
                  </div>
                </div>
              </Section>
              <Section n={3} title={r.trajectoryTitle}>
                <p className="-mt-3 mb-4 max-w-2xl text-sm text-ink-soft">{r.trajectorySubtitle}</p>
                <TrajectoryChart points={report.trajectory} examDate={report.projection.examDate} readyBy={report.projection.readyBy} />
              </Section>
            </ProGate>

            <Methodology />
          </>
        )}
      </NotebookPage>
    </div>
  );
}
