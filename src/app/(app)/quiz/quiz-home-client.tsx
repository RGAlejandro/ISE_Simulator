"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InkLink, NotebookHeader, NotebookPage, Section } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { QuizLoading, useStartQuiz } from "@/components/quiz/quiz-parts";
import { QUIZ_SIZE, QUIZ_SOURCES, type QuizSource } from "@/lib/quiz";

export interface QuizRow {
  id: string;
  total: number;
  answered: number;
  score: number | null;
  completed: boolean;
  createdAt: string;
}

export function QuizHomeClient({ pending, mastered, canStart, isPro, history }: {
  pending: Record<QuizSource, number>;
  mastered: number;
  canStart: boolean;
  isPro: boolean;
  history: QuizRow[];
}) {
  const { dict, t, locale } = useI18n();
  const tq = dict.quiz;
  const { start, starting, error } = useStartQuiz();
  const total = QUIZ_SOURCES.reduce((n, s) => n + pending[s], 0);
  const size = Math.min(QUIZ_SIZE, total);
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });

  return (
    <div className="flex-1 bg-paper">
      {starting && <QuizLoading />}
      <NotebookPage className="pb-16">
        <NotebookHeader title={tq.title} subtitle={tq.subtitle} />

        <Section n={1} title={tq.nextTitle}>
          <div className="max-w-2xl space-y-5">
            {total === 0 ? (
              <div className="space-y-3">
                <p className="text-[15px] leading-relaxed text-ink-soft">{mastered > 0 ? tq.allMastered : tq.empty}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <InkLink href="/writing">{tq.goWriting}</InkLink>
                  <InkLink href="/translation">{tq.goTranslation}</InkLink>
                  <InkLink href="/grammar">{tq.goTeacher}</InkLink>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="font-display text-2xl font-semibold text-ink">
                    {t("quiz.pending", { n: total })}
                    {mastered > 0 && <span className="text-ink-soft"> · {t("quiz.mastered", { n: mastered })}</span>}
                  </p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
                    {QUIZ_SOURCES.filter((s) => pending[s] > 0).map((s) => (
                      <li key={s}>{tq.sources[s]} <span className="tabular-nums font-medium text-ink">{pending[s]}</span></li>
                    ))}
                  </ul>
                </div>
                {canStart ? (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Button size="lg" onClick={start} disabled={starting}>
                      {tq.start} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <span className="text-sm text-ink-soft">{t("quiz.size", { n: size, m: Math.max(2, Math.round(size * 0.5)) })}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="font-hand text-xl leading-snug text-pen">{tq.limitReached}</p>
                    {!isPro && <Button asChild size="sm"><Link href="/pricing">{tq.upgrade}</Link></Button>}
                  </div>
                )}
                {canStart && !isPro && <p className="text-xs text-ink-soft">{tq.freeNote}</p>}
              </>
            )}
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-pen" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </p>
            )}
          </div>
        </Section>

        <Section n={2} title={tq.historyTitle}>
          {history.length === 0 ? (
            <p className="text-sm text-ink-soft">{tq.historyEmpty}</p>
          ) : (
            <ul className="max-w-2xl divide-y divide-rule border-y border-rule">
              {history.map((q) => (
                <li key={q.id}>
                  <Link href={`/quiz/${q.id}`} className="group flex items-center gap-4 py-3">
                    <span className="w-24 shrink-0 text-sm tabular-nums text-ink-soft">{day(q.createdAt)}</span>
                    <span className="min-w-0 flex-1 text-[15px] font-medium text-ink group-hover:underline decoration-marker decoration-4 underline-offset-2">
                      {t("quiz.questions", { n: q.total })}
                    </span>
                    {q.completed && q.score != null ? (
                      <span className="font-display text-lg font-semibold tabular-nums text-ink">{q.score}/{q.total}</span>
                    ) : (
                      <span className="font-hand text-lg text-pen">{t("quiz.unfinished", { n: q.answered, total: q.total })}</span>
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
