"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InkBar, InkLink, NotebookHeader, NotebookPage, Section } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { LessonLoading, useStartLesson, useTagLabel } from "@/components/teacher/teacher-parts";
import { cn } from "@/lib/utils";
import type { TeachableTag } from "@/lib/teacher";

export interface WeakSpot {
  tag: TeachableTag;
  count: number;
  writings: number;
  example: { quote: string; correction: string } | null;
  /** The last finished lesson on this tag, and the mistakes made since. */
  last: { date: string; score: number; total: number; since: { errors: number; writings: number } } | null;
}

export interface LessonRow {
  id: string;
  focus: string;
  title: string;
  score: number | null;
  total: number;
  completed: boolean;
  createdAt: string;
}

export function TeacherHomeClient({ writings, weak, topics, history, canStart, isPro }: {
  writings: number;
  weak: WeakSpot[];
  topics: { tag: TeachableTag; count: number }[];
  history: LessonRow[];
  canStart: boolean;
  isPro: boolean;
}) {
  const { dict, t, locale } = useI18n();
  const tc = dict.teacher;
  const label = useTagLabel();
  const { start, starting, error } = useStartLesson();
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const max = weak[0]?.count ?? 1;
  const blocked = !canStart || starting !== null;

  return (
    <div className="flex-1 bg-paper">
      {starting && <LessonLoading topic={label(starting)} />}
      <NotebookPage className="pb-16">
        <NotebookHeader title={tc.title} subtitle={tc.subtitle} />

        {(!canStart || error) && (
          <div className="mb-8 max-w-2xl space-y-3">
            {!canStart && <p className="font-hand text-xl leading-snug text-pen">{tc.limitReached}</p>}
            {!canStart && !isPro && <Button asChild size="sm"><Link href="/pricing">{tc.upgrade}</Link></Button>}
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-pen" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </p>
            )}
          </div>
        )}

        <Section n={1} title={tc.weakTitle} eyebrow={writings > 0 ? t("teacher.basedOn", { n: writings }) : undefined}>
          {weak.length === 0 ? (
            <div className="max-w-2xl space-y-3">
              <p className="text-[15px] leading-relaxed text-ink-soft">{tc.noWritings}</p>
              <InkLink href="/writing">{tc.noWritingsCta}</InkLink>
            </div>
          ) : (
            <ul className="max-w-3xl divide-y divide-rule border-y border-rule">
              {weak.map((w) => (
                <li key={w.tag} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                      <h3 className="font-display text-lg font-semibold text-ink">{label(w.tag)}</h3>
                      <span className="text-sm tabular-nums text-ink-soft">{t("teacher.errors", { n: w.count, w: w.writings })}</span>
                    </div>
                    <InkBar value={w.count} max={max} tone="pen" className="max-w-md" />
                    {w.example && (
                      <p className="truncate text-sm">
                        <span className="text-pen line-through decoration-pen/70">{w.example.quote}</span>
                        <span className="text-ink-soft"> → </span>
                        <span className="font-medium text-ink">{w.example.correction}</span>
                      </p>
                    )}
                    {w.last && (
                      <p className="text-xs text-ink-soft">
                        {t("teacher.lastLesson", { date: day(w.last.date), score: w.last.score, total: w.last.total })}
                        {" · "}
                        {w.last.since.writings === 0
                          ? tc.sinceNone
                          : t("teacher.since", { n: w.last.since.errors, w: w.last.since.writings })}
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => start(w.tag)} disabled={blocked} className="shrink-0 self-start sm:self-center">
                    {starting === w.tag ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{tc.lesson} <ArrowRight className="ml-1 h-3.5 w-3.5" /></>}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section n={2} title={tc.anyTopicTitle}>
          <p className="mb-4 max-w-2xl text-sm text-ink-soft">{tc.anyTopicHint}{!isPro && ` ${tc.freeNote}`}</p>
          <div className="flex max-w-3xl flex-wrap gap-2">
            {topics.map((tp) => (
              <button
                key={tp.tag}
                type="button"
                onClick={() => start(tp.tag)}
                disabled={blocked}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-3 py-1.5 text-sm text-ink transition-colors",
                  "hover:border-ink disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {label(tp.tag)}
                {tp.count > 0 && <span className="rounded-full bg-pen/10 px-1.5 text-[11px] font-semibold tabular-nums text-pen">{tp.count}</span>}
              </button>
            ))}
          </div>
        </Section>

        <Section n={3} title={tc.historyTitle}>
          {history.length === 0 ? (
            <p className="text-sm text-ink-soft">{tc.historyEmpty}</p>
          ) : (
            <ul className="max-w-3xl divide-y divide-rule border-y border-rule">
              {history.map((h) => (
                <li key={h.id}>
                  <Link href={`/grammar/${h.id}`} className="group flex items-center gap-4 py-3">
                    <span className="w-16 shrink-0 text-sm tabular-nums text-ink-soft">{day(h.createdAt)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink decoration-marker decoration-4 underline-offset-2 group-hover:underline">
                        {h.title || label(h.focus)}
                      </span>
                      <span className="block text-xs text-ink-soft">{label(h.focus)}</span>
                    </span>
                    {h.completed && h.score != null && h.total > 0 ? (
                      <span className="w-14 shrink-0 text-right font-display text-lg font-semibold tabular-nums text-ink">{h.score}/{h.total}</span>
                    ) : (
                      <span className="shrink-0 font-hand text-lg text-pen">{tc.unfinished}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </NotebookPage>
    </div>
  );
}
