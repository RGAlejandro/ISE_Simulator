"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotebookHeader, NotebookPage, Section } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { ClassErrors, ClassSkills, CriteriaHeatmap, KpiRow, ReadinessHistogram } from "@/components/teams/team-charts";
import { AssignmentsPanel, InviteCard, LessonPanel, MembersTable } from "@/components/teams/team-panels";
import type { TeamDashboard } from "@/lib/teams-server";

export function TeamPanelClient({ data, isAdmin = false }: { data: TeamDashboard; isAdmin?: boolean }) {
  const { dict, t } = useI18n();
  const tm = dict.teams;
  const { org } = data;

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        <NotebookHeader
          eyebrow={
            <Link href="/teams" className="inline-flex items-center gap-1.5 hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" /> {tm.back}
            </Link>
          }
          title={org.name}
          subtitle={`${org.levelLabel} · ${data.teachers.map((x) => x.name).join(", ")}`}
        />

        <Section n={1} title={tm.histTitle}>
          <KpiRow kpis={data.kpis} />
          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm text-ink-soft">{t("teams.histSubtitle", { level: org.levelLabel })}</p>
              <ReadinessHistogram bins={data.histogram} />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{tm.skillsTitle}</p>
              <p className="mb-3 text-sm text-ink-soft">{tm.skillsSubtitle}</p>
              <ClassSkills skills={data.classSkills} />
            </div>
          </div>
        </Section>

        <Section n={2} title={tm.tableTitle}>
          <MembersTable orgId={org.id} members={data.members} isAdmin={isAdmin} />
        </Section>

        <Section n={3} title={tm.heatTitle}>
          <p className="-mt-3 mb-4 max-w-2xl text-sm text-ink-soft">{tm.heatSubtitle}</p>
          {data.members.length ? <CriteriaHeatmap members={data.members} /> : <p className="text-sm text-ink-soft">{tm.noStudents}</p>}
        </Section>

        <Section n={4} title={tm.errorsTitle}>
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <p className="mb-4 text-sm text-ink-soft">{tm.errorsSubtitle}</p>
              <ClassErrors errors={data.classErrors} students={data.kpis.students} />
            </div>
            <div className="lg:col-span-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{tm.lessonTitle}</p>
              <p className="mb-4 text-sm text-ink-soft">{tm.lessonSubtitle}</p>
              <LessonPanel orgId={org.id} lesson={data.lesson} />
            </div>
          </div>
        </Section>

        <Section n={5} title={tm.assignTitle}>
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <p className="mb-4 text-sm text-ink-soft">{tm.assignSubtitle}</p>
              <AssignmentsPanel orgId={org.id} assignments={data.assignments} />
            </div>
            <div className="lg:col-span-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{tm.inviteTitle}</p>
              <p className="mb-4 text-sm text-ink-soft">{tm.inviteBody}</p>
              <InviteCard joinCode={org.joinCode} />
            </div>
          </div>
        </Section>
      </NotebookPage>
    </div>
  );
}
