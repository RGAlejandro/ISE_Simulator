"use client";

import { useI18n } from "@/components/i18n/language-provider";
import { Stamp } from "@/components/notebook/notebook";
import { TodayRow } from "@/components/dashboard/exam-plan-card";
import { ASSIGNMENT_HREF } from "@/lib/teams";
import type { StudentAssignment } from "@/lib/teams-server";

/** Homework set by the student's teams, as rows of the "Today" list. Completion is detected from practice. */
export function AssignmentRows({ items }: { items: StudentAssignment[] }) {
  const { dict, t, locale } = useI18n();
  const tm = dict.teams;
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return (
    <>
      {items.map((a) => {
        const meta = `${t("dashboard.nb.homework", { team: a.teamName })} · ${tm.assignKind[a.kind]} · ${t("teams.assignDueOn", { date: fmt.format(new Date(a.dueAt)) })}`;
        return a.done ? (
          <li key={a.id} className="flex items-center gap-4 py-3">
            <span aria-hidden className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-ink bg-ink" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-ink-soft line-through decoration-ink-soft/50">{a.title}</span>
              <span className="block text-xs text-ink-soft">{meta}</span>
            </span>
            <Stamp band="pass" tilt={-4}>{dict.dashboard.nb.done}</Stamp>
          </li>
        ) : (
          <TodayRow key={a.id} href={ASSIGNMENT_HREF[a.kind]} label={a.title} meta={meta} />
        );
      })}
    </>
  );
}
