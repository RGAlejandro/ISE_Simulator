"use client";

import type { OralTaskType } from "@/types";
import type { LiveMetrics } from "@/lib/live-metrics";
import { CoachHud } from "@/components/exam/live/coach-hud";
import { useI18n } from "@/components/i18n/language-provider";
import { NotebookHeader, NotebookPage, Section } from "@/components/notebook/notebook";
import {
  BackLink, CriterionScore, LockedNote, NextSteps, ScoreTitle, Suggestions, useResultEyebrow,
} from "@/components/results/results-parts";

// Trinity ISE Speaking & Listening: four criteria on the spoken tasks, one on independent listening.
const SPOKEN_SKILL_KEYS = ["communicativeEffectiveness", "interactiveListening", "languageControl", "delivery"] as const;
type CriterionKey = (typeof SPOKEN_SKILL_KEYS)[number] | "listening";

interface OralResultsClientProps {
  exam: {
    id: string;
    level: string;
    status: string;
    overallScore: number | null;
    createdAt: string;
  };
  feedback: Array<{
    taskType: string;
    feedback: Record<string, unknown>;
    score: number | null;
  }>;
  exchanges: Array<{
    taskType: string;
    role: string;
    content: string;
  }>;
  isPro: boolean;
  /** Present for Live Examiner sessions: delivery metrics measured during the session. */
  liveMetrics?: LiveMetrics | null;
  /** An admin viewing a learner's result: no "what next" actions. */
  readOnly?: boolean;
}

export function OralResultsClient({ exam, feedback, exchanges, isPro, liveMetrics, readOnly = false }: OralResultsClientProps) {
  const { dict } = useI18n();
  const r = dict.results;
  const eyebrow = useResultEyebrow(exam.level, liveMetrics ? r.liveOral : r.oral, exam.createdAt);
  let n = 0;

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        {!readOnly && <BackLink />}
        <NotebookHeader eyebrow={eyebrow} title={<ScoreTitle score={exam.overallScore} />} subtitle={r.subtitleOral} />

        {liveMetrics && liveMetrics.candidateWords > 0 && (
          <Section n={++n} title={dict.live.reportTitle}>
            <p className="-mt-3 mb-5 max-w-2xl text-sm text-ink-soft">{dict.live.reportSubtitle}</p>
            <CoachHud metrics={liveMetrics} showNudges={false} />
          </Section>
        )}

        <Section n={++n} title={r.byTask}>
          <div className="divide-y divide-rule">
            {feedback.map((f) => (
              <OralTask
                key={f.taskType}
                f={f}
                isPro={isPro}
                exchanges={exchanges.filter((e) => e.taskType === f.taskType)}
              />
            ))}
          </div>
        </Section>

        {!readOnly && <NextSteps n={++n} />}
      </NotebookPage>
    </div>
  );
}

function OralTask({ f, isPro, exchanges }: {
  f: OralResultsClientProps["feedback"][number];
  isPro: boolean;
  exchanges: OralResultsClientProps["exchanges"];
}) {
  const { dict, t } = useI18n();
  const r = dict.results;
  const fb = f.feedback as Record<string, { score: number; comments: string }> & { suggestions?: string[]; summary?: string };
  const label = r.task[f.taskType as OralTaskType] ?? f.taskType;

  // Trinity: the Listening task is scored 0–5 on one criterion; spoken tasks 0–20 (four criteria × 5).
  const isListening = f.taskType === "LISTENING";
  const maxScore = isListening ? 5 : 20;
  const keys: readonly CriterionKey[] = isListening ? ["listening"] : SPOKEN_SKILL_KEYS;
  const score = f.score != null ? `${f.score}/${maxScore}` : "—";

  return (
    <article className="space-y-5 py-8 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-xl font-semibold text-ink">{label}</h3>
        <span className="font-display text-2xl font-semibold tabular-nums text-ink">{score}</span>
      </div>

      {!isPro ? (
        <LockedNote title={r.lockedOralTitle} body={r.lockedOralBody} />
      ) : (
        <>
          {fb.summary && (
            <div className="max-w-3xl border-l-2 border-ink pl-4">
              <p className="font-display text-base font-semibold text-ink">{t("results.whyScore", { score: f.score ?? "—", max: maxScore })}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{fb.summary}</p>
            </div>
          )}

          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {keys.map((key) => {
              const area = fb[key];
              if (!area || typeof area !== "object") return null;
              return <CriterionScore key={key} label={r.criterion[key]} score={area.score} max={5} comments={area.comments} />;
            })}
          </div>

          <Suggestions items={fb.suggestions ?? []} />

          {exchanges.length > 0 && <Transcript exchanges={exchanges} />}
        </>
      )}
    </article>
  );
}

function Transcript({ exchanges }: { exchanges: OralResultsClientProps["exchanges"] }) {
  const { dict, t } = useI18n();
  const r = dict.results;
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-marker">
        {r.transcript}
      </summary>
      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto border-l-2 border-margin pl-4 text-sm leading-relaxed sm:max-h-[28rem]">
        {exchanges.map((e, i) => {
          // Listening turns store the passage as JSON; show a short preview instead.
          let content = e.content;
          try {
            const parsed = JSON.parse(e.content);
            if (parsed.listeningText) content = t("results.listeningPassage", { text: String(parsed.listeningText).slice(0, 100) });
          } catch {
            // Plain text turn.
          }
          const examiner = e.role === "EXAMINER";
          return (
            <div key={i}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{examiner ? r.examiner : r.you}</p>
              <p className={examiner ? "text-ink-soft" : "text-ink"}>{content}</p>
            </div>
          );
        })}
      </div>
    </details>
  );
}
