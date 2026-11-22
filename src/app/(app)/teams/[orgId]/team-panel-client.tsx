"use client";

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { ClassErrors, ClassSkills, CriteriaHeatmap, KpiRow, ReadinessHistogram } from "@/components/teams/team-charts";
import { AssignmentsPanel, InviteCard, LessonPanel, MembersTable } from "@/components/teams/team-panels";
import type { TeamDashboard } from "@/lib/teams-server";

function Card({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ""}`}>
      <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function TeamPanelClient({ data }: { data: TeamDashboard }) {
  const { dict, t } = useI18n();
  const tm = dict.teams;
  const { org } = data;

  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <header className="space-y-3">
          <Link href="/teams" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            <ArrowLeft className="h-3.5 w-3.5" /> {tm.back}
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{org.name}</h1>
              <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Users className="h-4 w-4" />
                {org.levelLabel} · {data.teachers.map((x) => x.name).join(", ")}
              </p>
            </div>
          </div>
        </header>

        <KpiRow kpis={data.kpis} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={tm.histTitle} subtitle={t("teams.histSubtitle", { level: org.levelLabel })}>
            <ReadinessHistogram bins={data.histogram} />
          </Card>
          <Card title={tm.skillsTitle} subtitle={tm.skillsSubtitle}>
            <ClassSkills skills={data.classSkills} />
          </Card>
        </div>

        <Card title={tm.tableTitle}>
          <MembersTable orgId={org.id} members={data.members} />
        </Card>

        <Card title={tm.heatTitle} subtitle={tm.heatSubtitle}>
          {data.members.length ? <CriteriaHeatmap members={data.members} /> : <p className="text-sm text-zinc-500">{tm.noStudents}</p>}
        </Card>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card title={tm.errorsTitle} subtitle={tm.errorsSubtitle} className="lg:col-span-2">
            <ClassErrors errors={data.classErrors} students={data.kpis.students} />
          </Card>
          <Card title={tm.lessonTitle} subtitle={tm.lessonSubtitle} className="lg:col-span-3">
            <LessonPanel orgId={org.id} lesson={data.lesson} />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card title={tm.assignTitle} subtitle={tm.assignSubtitle} className="lg:col-span-3">
            <AssignmentsPanel orgId={org.id} assignments={data.assignments} />
          </Card>
          <Card title={tm.inviteTitle} subtitle={tm.inviteBody} className="lg:col-span-2">
            <InviteCard joinCode={org.joinCode} />
          </Card>
        </div>
      </div>
    </div>
  );
}
