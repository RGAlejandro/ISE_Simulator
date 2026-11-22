"use client";

import Link from "next/link";
import { Gauge, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { ActionList, Methodology, ReadinessHero, SkillMeters, WeakestCriteria } from "@/components/readiness/readiness-parts";
import { TrajectoryChart } from "@/components/readiness/trajectory-chart";
import type { ReadinessReport } from "@/lib/readiness";

interface Props {
  levelLabel: string | null;
  report: ReadinessReport | null;
  isPro: boolean;
}

function Card({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ""}`}>
      <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
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
      <div className="absolute inset-0 grid place-items-center">
        <div className="max-w-sm rounded-2xl border border-zinc-200 bg-white/95 p-5 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-900/95">
          <Lock className="mx-auto h-5 w-5 text-zinc-500" />
          <p className="mt-2 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{dict.readiness.lockedTitle}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{dict.readiness.lockedBody}</p>
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

  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <header className="max-w-2xl space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#cde2fb] text-[#184f95] dark:bg-[#104281] dark:text-[#cde2fb]">
            <Gauge className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {r.title} <span className="marker-underline italic">{r.titleAccent}</span>
          </h1>
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
            {levelLabel ? t("readiness.subtitle", { level: levelLabel }) : r.noLevel}
          </p>
        </header>

        {!report ? (
          <Button asChild>
            <Link href="/dashboard">{r.setGoal}</Link>
          </Button>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-5">
              <section className="lg:col-span-3 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <ReadinessHero report={report} />
              </section>
              <Card title={r.actionsTitle} className="lg:col-span-2">
                <ActionList actions={report.actions} />
              </Card>
            </div>

            <ProGate isPro={isPro}>
              <div className="grid gap-6 lg:grid-cols-5">
                <Card title={r.skillsTitle} subtitle={r.skillsSubtitle} className="lg:col-span-3">
                  <SkillMeters skills={report.skills} />
                </Card>
                <Card title={r.criteriaTitle} className="lg:col-span-2">
                  <WeakestCriteria items={report.weakestCriteria} />
                </Card>
              </div>
              <div className="mt-6">
                <Card title={r.trajectoryTitle} subtitle={r.trajectorySubtitle}>
                  <TrajectoryChart points={report.trajectory} examDate={report.projection.examDate} readyBy={report.projection.readyBy} />
                </Card>
              </div>
            </ProGate>

            <Methodology />
          </>
        )}
      </div>
    </div>
  );
}
