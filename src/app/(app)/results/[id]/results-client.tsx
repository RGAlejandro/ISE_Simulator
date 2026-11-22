"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/language-provider";
import { Ledger, LedgerRow, NotebookHeader, NotebookPage, Section } from "@/components/notebook/notebook";
import {
  BackLink, CriterionScore, LockedNote, NextSteps, ScoreTitle, SkillScore, Suggestions, useResultEyebrow,
} from "@/components/results/results-parts";
import type { WritingFeedback, ReadingQuestionResult } from "@/types";

interface ReadingAggregate {
  score: number;
  total: number;
  percentage: number;
  questions?: ReadingQuestionResult[];
}

type Response = {
  taskType: string;
  taskNumber: number;
  response: string;
  aiFeedback: (WritingFeedback | ReadingAggregate) | null;
  score: number | null;
};

interface ResultsClientProps {
  exam: {
    id: string;
    level: string;
    status: string;
    score: number | null;
    createdAt: string;
  };
  responses: Response[];
  isPro: boolean;
  /** An admin viewing a learner's result: no "what next" actions. */
  readOnly?: boolean;
  /** READING = Practice → Reading (Tasks 1 and 2 only). */
  mode?: "FULL" | "READING";
}

const WRITING_CRITERIA = ["readingAndWriting", "taskFulfilment", "organisationAndStructure", "languageControl"] as const;

export function ResultsClient({ exam, responses, isPro, readOnly = false, mode = "FULL" }: ResultsClientProps) {
  const { dict, t } = useI18n();
  const r = dict.results;
  const readingOnly = mode === "READING";
  const eyebrow = useResultEyebrow(exam.level, readingOnly ? r.readingPractice : r.written, exam.createdAt);

  const r1fb = responses.find((x) => x.taskType === "READING_1")?.aiFeedback as ReadingAggregate | undefined;
  const r2fb = responses.find((x) => x.taskType === "READING_2")?.aiFeedback as ReadingAggregate | undefined;
  const writings = ["READING_INTO_WRITING", "EXTENDED_WRITING"]
    .map((type) => responses.find((x) => x.taskType === type))
    .filter((x): x is Response => !!x);

  const readingScore = (r1fb?.score ?? 0) + (r2fb?.score ?? 0);
  const readingTotal = (r1fb?.total ?? 0) + (r2fb?.total ?? 0);
  const readingPct = readingTotal > 0 ? Math.round((readingScore / readingTotal) * 100) : null;

  // Writing: average of the marked tasks (each 0–20, normalised to 0–100).
  const wScores = writings.filter((w) => w.score != null).map((w) => ((w.score as number) / 20) * 100);
  const writingPct = wScores.length > 0 ? Math.round(wScores.reduce((a, b) => a + b, 0) / wScores.length) : null;

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        {!readOnly && <BackLink />}
        <NotebookHeader eyebrow={eyebrow} title={<ScoreTitle score={exam.score} />} subtitle={readingOnly ? r.subtitleReading : r.subtitleWritten} />

        {!readingOnly && (
        <Section n={1} title={r.summary}>
          <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            <SkillScore
              label={r.reading}
              sublabel={r.readingTasks}
              score={readingPct}
              detail={readingTotal > 0 ? t("results.correctOf", { score: readingScore, total: readingTotal }) : r.noData}
            />
            <SkillScore
              label={r.writing}
              sublabel={r.writingTasks}
              score={writingPct}
              detail={wScores.length === 0 ? r.noWriting : t("results.tasksMarked", { n: wScores.length })}
            />
          </div>
        </Section>
        )}

        <Section n={readingOnly ? 1 : 2} title={r.reading}>
          <Ledger className="max-w-2xl">
            <ReadingTaskRow label={r.task1} fb={r1fb} from={1} to={15} />
            <ReadingTaskRow label={r.task2} fb={r2fb} from={16} to={30} />
          </Ledger>
          <div className="mt-6">
            {isPro ? (
              (r1fb?.questions || r2fb?.questions) && (
                <ReadingQuestionDetail questions={[...(r1fb?.questions ?? []), ...(r2fb?.questions ?? [])]} />
              )
            ) : (
              <LockedNote title={r.lockedReadingTitle} body={r.lockedReadingBody} />
            )}
          </div>
        </Section>

        {!readingOnly && (
        <Section n={3} title={r.writing}>
          {writings.length === 0 ? (
            <div className="max-w-2xl">
              <p className="font-display text-lg font-semibold text-ink">{r.noWriting}</p>
              <p className="mt-1 text-sm text-ink-soft">{r.noWritingBody}</p>
            </div>
          ) : (
            <div className="space-y-10">
              {writings.map((w) => <WritingTask key={w.taskType} r={w} isPro={isPro} />)}
              {!isPro && <LockedNote title={r.lockedWritingTitle} body={r.lockedWritingBody} />}
            </div>
          )}
        </Section>

        )}

        {!readOnly && (
          <NextSteps
            n={readingOnly ? 2 : 4}
            again={readingOnly ? { href: "/practice?start=reading", label: r.againReading } : undefined}
          />
        )}
      </NotebookPage>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

function ReadingTaskRow({ label, fb, from, to }: { label: string; fb?: ReadingAggregate; from: number; to: number }) {
  const { dict, t } = useI18n();
  return (
    <LedgerRow
      label={label}
      value={fb ? `${fb.score}/${fb.total}` : "—"}
      hint={fb ? t("results.questionsRange", { from, to, p: fb.percentage }) : dict.results.noData}
    />
  );
}

function ReadingQuestionDetail({ questions }: { questions: ReadingQuestionResult[] }) {
  const { dict, t } = useI18n();
  const r = dict.results;
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const wrong = questions.filter((q) => !q.isCorrect).length;
  if (questions.length === 0) return null;
  // Mistakes first: correct answers only on request (or when there are no mistakes).
  const visible = showAll || wrong === 0 ? questions : questions.filter((q) => !q.isCorrect);

  return (
    <div className="border-t border-rule">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="block font-display text-lg font-semibold text-ink">{r.perQuestion}</span>
          <span className="block text-sm text-ink-soft">
            {wrong === 0 ? r.allCorrect : wrong === 1 ? r.wrongCountOne : t("results.wrongCount", { n: wrong })}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-ink">
          {open ? r.hide : r.show}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <>
        <ol className="divide-y divide-rule border-t border-rule">
          {visible.map((q) => (
            <li key={q.num} className="flex items-start gap-4 py-4">
              <span className="w-8 shrink-0 font-display sm:w-10 text-lg font-semibold tabular-nums text-ink-soft">{q.num}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {q.isCorrect
                    ? <Check className="h-4 w-4 text-ink" aria-label={r.correctAnswer} />
                    : <X className="h-4 w-4 text-pen" aria-hidden />}
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                    {r.qType[q.type] ?? q.type}
                  </span>
                </div>
                {q.context && <p className="mt-1 text-sm italic leading-relaxed text-ink-soft">{q.context}</p>}
                <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>
                    <span className="text-ink-soft">{r.yourAnswer}: </span>
                    <span className={cn("font-semibold", q.isCorrect ? "text-ink" : "text-pen", !q.isCorrect && q.userAnswer && "line-through decoration-1")}>
                      {q.userAnswer || r.blank}
                    </span>
                  </span>
                  {!q.isCorrect && (
                    <span>
                      <span className="text-ink-soft">{r.correctAnswer}: </span>
                      <span className="font-semibold text-ink">{q.correctAnswer}</span>
                    </span>
                  )}
                </p>
                {!q.isCorrect && q.explanation && (
                  <p className="mt-2 border-l-2 border-pen pl-3 text-sm leading-relaxed text-ink">{q.explanation}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
        {wrong > 0 && wrong < questions.length && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-4 text-sm text-ink-soft">
            {!showAll && <span>{r.onlyWrong}</span>}
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="font-medium text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-marker"
            >
              {showAll ? r.showWrong : t("results.showAll", { n: questions.length })}
            </button>
          </p>
        )}
        </>
      )}
    </div>
  );
}

function WritingTask({ r, isPro }: { r: Response; isPro: boolean }) {
  const { dict } = useI18n();
  const res = dict.results;
  const fb = r.aiFeedback as WritingFeedback | null;
  const label = r.taskType === "READING_INTO_WRITING" ? res.task3 : res.task4;

  return (
    <article className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-xl font-semibold text-ink">{label}</h3>
        {r.score != null && <span className="font-display text-2xl font-semibold tabular-nums text-ink">{r.score}/20</span>}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{res.yourText}</p>
        <div className="max-h-56 overflow-y-auto whitespace-pre-wrap border-l-2 border-margin pl-4 text-[15px] leading-relaxed text-ink">
          {r.response}
        </div>
      </div>

      {fb && isPro ? (
        <div className="space-y-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{res.criteriaScale}</p>
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {WRITING_CRITERIA.map((key) => {
              const area = fb[key];
              if (!area) return null;
              return <CriterionScore key={key} label={res.criterion[key]} score={area.score} max={4} comments={area.comments} />;
            })}
          </div>
          <Suggestions items={fb.suggestions ?? []} />
        </div>
      ) : null}
    </article>
  );
}
