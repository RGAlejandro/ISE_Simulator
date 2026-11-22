"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { ReadinessHero, SkillMeters, WeakestCriteria } from "@/components/readiness/readiness-parts";
import { TrajectoryChart } from "@/components/readiness/trajectory-chart";
import type { ReadinessReport } from "@/lib/readiness";

interface Props {
  orgId: string;
  teamName: string;
  userId: string;
  name: string;
  report: ReadinessReport;
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ""}`}>
      <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function MemberClient({ orgId, teamName, userId, name, report }: Props) {
  const { dict, t } = useI18n();
  const tm = dict.teams;
  const r = dict.readiness;
  const router = useRouter();

  const remove = async () => {
    if (!window.confirm(tm.removeConfirm)) return;
    const res = await fetch(`/api/teams/${orgId}/members/${userId}`, { method: "DELETE" });
    if (res.ok) router.push(`/teams/${orgId}`);
  };

  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <header className="space-y-3">
          <Link href={`/teams/${orgId}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("teams.memberBack", { team: teamName })}
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{name}</h1>
              <p className="flex items-center gap-1.5 text-sm text-zinc-500">
                <ShieldCheck className="h-4 w-4 text-[#0ca30c]" /> {tm.memberPrivacy}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={remove} className="gap-1.5">
              <UserMinus className="h-3.5 w-3.5" /> {tm.remove}
            </Button>
          </div>
        </header>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <ReadinessHero report={report} />
        </section>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card title={r.skillsTitle} className="lg:col-span-3">
            <SkillMeters skills={report.skills} />
          </Card>
          <Card title={r.criteriaTitle} className="lg:col-span-2">
            <WeakestCriteria items={report.weakestCriteria} />
          </Card>
        </div>

        <Card title={r.trajectoryTitle}>
          <TrajectoryChart points={report.trajectory} examDate={report.projection.examDate} readyBy={report.projection.readyBy} />
        </Card>
      </div>
    </div>
  );
}
