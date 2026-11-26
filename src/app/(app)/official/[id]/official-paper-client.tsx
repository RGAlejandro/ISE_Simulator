"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InkLink, Ledger, LedgerRow, NotebookHeader, NotebookPage, Section } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { BandStamp, CriterionScore, ScoreTitle, failingSkill } from "@/components/results/results-parts";
import { FilePicker, Steps, prepareUploads, useOfficialError } from "@/components/official/official-parts";
import { EXAM_LEVELS } from "@/lib/constants";
import { countInserted, countStruck, countWords } from "@/lib/writing";
import { cn } from "@/lib/utils";
import type { OfficialAnswers, OfficialBlock, OfficialPaperContent, OfficialQuestionResult, OfficialReadingResult } from "@/lib/official";
import type { WritingCriterionKey, WritingEvaluation } from "@/types";

export interface MarkedWriting {
  practiceId: string;
  task: 3 | 4;
  genre: string;
  /** Criteria mean, 0–4. */
  score: number | null;
  wordCount: number;
  evaluation: WritingEvaluation | null;
}

interface Props {
  id: string;
  title: string;
  level: string;
  status: "PARSED" | "TRANSCRIBED" | "MARKED";
  content: OfficialPaperContent;
  answers: OfficialAnswers | null;
  readingResult: OfficialReadingResult | null;
  score: number | null;
  writings: MarkedWriting[];
}

const STEP = { PARSED: 1, TRANSCRIBED: 2, MARKED: 3 } as const;

export function OfficialPaperClient(props: Props) {
  const { dict } = useI18n();
  const o = dict.official;
  const levelLabel = EXAM_LEVELS.find((l) => l.value === props.level)?.label ?? props.level;
  const [answers, setAnswers] = useState<OfficialAnswers | null>(props.answers);
  const [status, setStatus] = useState(props.status);
  const [reupload, setReupload] = useState(false);

  // After marking, router.refresh() brings new server props: they win over the local state.
  if (props.status === "MARKED" || status === "MARKED") return <MarkedView {...props} levelLabel={levelLabel} />;

  const showUpload = status === "PARSED" || reupload || !answers;
  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        <Link href="/official" className="inline-flex items-center gap-1.5 pt-6 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> {o.title}
        </Link>
        <NotebookHeader eyebrow={`${o.resultEyebrow} · ${levelLabel}`} title={props.title} />
        <div className="-mt-2 mb-8"><Steps current={showUpload ? 1 : STEP[status]} /></div>

        <Section n={1} title={o.paperRead}>
          <PaperSummary content={props.content} />
        </Section>

        {showUpload ? (
          <UploadAnswers
            id={props.id}
            onDone={(a) => { setAnswers(a); setStatus("TRANSCRIBED"); setReupload(false); }}
          />
        ) : (
          <Review
            id={props.id}
            content={props.content}
            answers={answers as OfficialAnswers}
            onChange={setAnswers}
            onReupload={() => setReupload(true)}
          />
        )}
      </NotebookPage>
    </div>
  );
}

function PaperSummary({ content }: { content: OfficialPaperContent }) {
  const { dict, t } = useI18n();
  const o = dict.official;
  const questions = content.blocks.reduce((n, b) => n + (b.to - b.from + 1), 0);
  const task = (n: 3 | 4) => {
    const w = n === 3 ? content.task3 : content.task4;
    return w ? t("official.taskLine", { genre: w.genre, min: w.wordLimit.min, max: w.wordLimit.max }) : "—";
  };
  const rows = [
    { label: dict.results.reading, value: questions > 0 ? t("official.questions", { n: questions }) : o.noReading, hint: questions > 0 ? o.key[content.keySource] : undefined },
    { label: dict.results.task3, value: task(3), hint: snippet(content.task3?.prompt) },
    { label: dict.results.task4, value: task(4), hint: snippet(content.task4?.prompt) },
  ];
  return (
    <dl className="max-w-2xl divide-y divide-rule border-y border-rule">
      {rows.map((r) => (
        <div key={r.label} className="grid gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <dt className="text-sm text-ink">{r.label}</dt>
          <dd className="font-display text-base font-semibold text-ink sm:text-right">{r.value}</dd>
          {r.hint && <dd className="text-xs leading-relaxed text-ink-soft sm:col-span-2">{r.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** First sentence or so of a task prompt, to recognise it. */
function snippet(text?: string): string | undefined {
  if (!text) return undefined;
  return text.length > 140 ? `${text.slice(0, 140).replace(/\s+\S*$/, "")}…` : text;
}

function UploadAnswers({ id, onDone }: { id: string; onDone: (a: OfficialAnswers) => void }) {
  const { dict } = useI18n();
  const o = dict.official;
  const errorText = useOfficialError();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transcribe() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of await prepareUploads(files)) form.append("files", f);
      const res = await fetch(`/api/official/${id}/transcribe`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.answers) throw Object.assign(new Error(), { code: data.code, status: res.status });
      onDone(data.answers as OfficialAnswers);
    } catch (err) {
      const e = err as { code?: string; status?: number };
      setError(errorText(e.code, e.status));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section n={2} title={o.answersTitle}>
      <div className="max-w-2xl space-y-5">
        <FilePicker label={o.answersTitle} hint={o.answersHint} files={files} onChange={setFiles} disabled={busy} />
        <p className="border-l-2 border-marker pl-3 text-sm text-ink">{o.handwritingTip}</p>
        <Button size="lg" onClick={transcribe} disabled={busy || files.length === 0}>
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{o.transcribing}</> : o.transcribe}
        </Button>
        {error && <p className="flex items-center gap-1.5 text-sm text-pen" role="alert"><AlertCircle className="h-4 w-4 shrink-0" /> {error}</p>}
      </div>
    </Section>
  );
}

function Review({ id, content, answers, onChange, onReupload }: {
  id: string;
  content: OfficialPaperContent;
  answers: OfficialAnswers;
  onChange: (a: OfficialAnswers) => void;
  onReupload: () => void;
}) {
  const { dict, t, locale } = useI18n();
  const o = dict.official;
  const router = useRouter();
  const errorText = useOfficialError();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setReading = (n: number, v: string) => onChange({ ...answers, reading: { ...answers.reading, [String(n)]: v } });

  async function mark() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/official/${id}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(), { code: data.code, status: res.status });
      router.refresh();
    } catch (err) {
      const e = err as { code?: string; status?: number };
      setError(errorText(e.code, e.status));
      setBusy(false);
    }
  }

  return (
    <>
      <Section n={2} title={o.reviewTitle}>
        <p className="-mt-3 mb-4 max-w-2xl text-sm text-ink-soft">{o.reviewHint}</p>
        {answers.illegible > 0 && <p className="mb-4 font-hand text-xl text-pen">{t("official.illegible", { n: answers.illegible })}</p>}
        {countInserted(answers.task3) + countInserted(answers.task4) > 0 && (
          <p className="mb-4 max-w-2xl border-l-2 border-marker pl-3 text-sm text-ink">
            {t("official.insertedNote", { n: countInserted(answers.task3) + countInserted(answers.task4) })}
          </p>
        )}
        {countStruck(answers.task3) + countStruck(answers.task4) > 0 && (
          <p className="mb-4 max-w-2xl border-l-2 border-pen pl-3 text-sm text-ink">
            {t("official.struckNote", { n: countStruck(answers.task3) + countStruck(answers.task4) })}
          </p>
        )}

        {content.blocks.length > 0 && (
          <div className="mb-10 space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{o.readingAnswers}</p>
            {content.blocks.map((b) => (
              <BlockInputs key={b.from} block={b} answers={answers.reading} onChange={setReading} disabled={busy} />
            ))}
          </div>
        )}

        {([3, 4] as const).map((n) => {
          const task = n === 3 ? content.task3 : content.task4;
          if (!task) return null;
          const key = n === 3 ? "task3" : "task4";
          const text = answers[key];
          const words = countWords(text);
          return (
            <div key={n} className="mb-8 max-w-3xl">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <label htmlFor={`task-${n}`} className="font-display text-lg font-semibold text-ink">
                  {n === 3 ? dict.results.task3 : dict.results.task4}
                </label>
                <span className={cn("text-sm tabular-nums", words < task.wordLimit.min || words > task.wordLimit.max ? "text-pen" : "text-ink-soft")}>
                  {text ? t("official.words", { n: words }) : o.notAnswered} · {task.wordLimit.min}–{task.wordLimit.max}
                </span>
              </div>
              <textarea
                id={`task-${n}`}
                value={text}
                onChange={(e) => onChange({ ...answers, [key]: e.target.value })}
                disabled={busy}
                rows={Math.min(22, Math.max(8, Math.ceil(text.length / 80) + 4))}
                spellCheck={false}
                lang="en"
                className="w-full resize-y border-l-2 border-margin bg-transparent py-1 pl-4 text-[15px] leading-relaxed text-ink focus:outline-none focus:ring-0"
              />
            </div>
          );
        })}
      </Section>

      <Section n={3} title={o.steps[3]}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button size="lg" onClick={mark} disabled={busy}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{o.marking}</> : o.mark}
          </Button>
          {!busy && (
            <button type="button" onClick={onReupload} className="text-sm font-medium text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-marker">
              {o.reupload}
            </button>
          )}
        </div>
        {error && <p className="mt-3 flex items-center gap-1.5 text-sm text-pen" role="alert"><AlertCircle className="h-4 w-4 shrink-0" /> {error}</p>}
      </Section>
    </>
  );
}

function BlockInputs({ block, answers, onChange, disabled }: {
  block: OfficialBlock;
  answers: Record<string, string>;
  onChange: (n: number, v: string) => void;
  disabled: boolean;
}) {
  const nums = Array.from({ length: block.to - block.from + 1 }, (_, i) => block.from + i);
  const gap = block.type === "gap";
  return (
    <div className="max-w-3xl">
      <p className="mb-2 text-sm text-ink">
        <span className="font-semibold">Q{block.from}–{block.to}</span>
        <span className="text-ink-soft"> · {block.instructions}</span>
      </p>
      <div className={cn("grid gap-x-1.5 gap-y-2 sm:gap-x-2", gap ? "grid-cols-1" : "grid-cols-5 sm:grid-cols-10")}>
        {nums.map((n) => (
          <label key={n} className={cn("flex min-w-0 items-center gap-1.5", gap && "max-w-md")}>
            <span className="w-5 shrink-0 text-right text-sm tabular-nums text-ink-soft">{n}</span>
            <input
              value={answers[String(n)] ?? ""}
              onChange={(e) => onChange(n, gap ? e.target.value : e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1))}
              disabled={disabled}
              maxLength={gap ? 80 : 1}
              lang="en"
              className={cn(
                "min-w-0 border-0 border-b-2 border-ink bg-transparent px-1 py-1 text-ink focus:outline-none focus:ring-0",
                gap ? "flex-1 text-[15px]" : "w-8 text-center font-semibold uppercase sm:w-10",
              )}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * The answers laid out like the paper: one column per question group, two
 * groups side by side (1–5 | 6–10, then 11–15 below 1–5), task by task.
 */
function AnswerGrid({ questions, blocks }: { questions: OfficialQuestionResult[]; blocks: OfficialBlock[] }) {
  const { dict } = useI18n();
  const groups = blocks.length > 0
    ? blocks.map((b) => ({ task: b.task, from: b.from, to: b.to, items: questions.filter((q) => q.num >= b.from && q.num <= b.to) }))
    : [1, 2].flatMap((task) => {
        const qs = questions.filter((q) => q.task === task);
        return Array.from({ length: Math.ceil(qs.length / 5) }, (_, i) => {
          const items = qs.slice(i * 5, i * 5 + 5);
          return { task, from: items[0].num, to: items[items.length - 1].num, items };
        });
      });

  return (
    <div className="mt-8 max-w-4xl space-y-8">
      {[1, 2].map((task) => {
        const own = groups.filter((g) => g.task === task && g.items.length > 0);
        if (own.length === 0) return null;
        return (
          <div key={task}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              {task === 1 ? dict.results.task1 : dict.results.task2}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {own.map((g) => (
                <ol key={g.from} aria-label={`${g.from}–${g.to}`} className="min-w-0">
                  {g.items.map((q) => <AnswerRow key={q.num} q={q} />)}
                </ol>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnswerRow({ q }: { q: OfficialQuestionResult }) {
  const { dict } = useI18n();
  return (
    <li className="flex items-baseline gap-2 border-b border-rule py-1.5 text-sm">
      <span className="w-6 shrink-0 text-right tabular-nums text-ink-soft">{q.num}</span>
      {q.ok ? <Check className="h-3.5 w-3.5 shrink-0 self-center text-ink" aria-hidden /> : <X className="h-3.5 w-3.5 shrink-0 self-center text-pen" aria-hidden />}
      <span className={cn("min-w-0 flex-1 truncate", q.ok ? "text-ink" : "text-pen")} title={q.given || undefined}>
        {q.given || dict.results.blank}
      </span>
      {!q.ok && (
        <span className="min-w-0 max-w-[55%] truncate text-ink-soft" title={q.expected}>
          {dict.official.expected}: <span className="font-medium text-ink">{q.expected}</span>
        </span>
      )}
    </li>
  );
}

const WRITING_CRITERIA: WritingCriterionKey[] = ["readingForWriting", "taskFulfilment", "organisation", "languageControl"];

function MarkedView(props: Props & { levelLabel: string }) {
  const { dict, t, locale } = useI18n();
  const num = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 1 });
  const o = dict.official;
  const r = props.readingResult;
  // Trinity: Reading and Writing must each reach Pass.
  const readingPct = r && r.total > 0 ? (r.correct / r.total) * 100 : null;
  const marks = props.writings.filter((w) => w.score != null).map((w) => ((w.score as number) / 4) * 100);
  const writingPct = marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : null;
  const score = props.score != null ? Math.round(props.score) : null;
  const failing = failingSkill(score, [
    { label: dict.results.reading, pct: readingPct },
    { label: dict.results.writing, pct: writingPct },
  ]);

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        <Link href="/official" className="inline-flex items-center gap-1.5 pt-6 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> {o.title}
        </Link>
        <NotebookHeader
          eyebrow={`${o.resultEyebrow} · ${props.title}`}
          title={<ScoreTitle score={score} parts={[readingPct, writingPct]} />}
          subtitle={o.resultSubtitle}
        />
        {failing && (
          <p className="-mt-4 mb-8 max-w-2xl border-l-2 border-pen pl-4 text-sm leading-relaxed text-ink" role="note">
            {t("results.mustPassBoth", { skill: failing })}
          </p>
        )}

        {r && r.total > 0 && (
          <Section n={1} title={o.readingTitle}>
            <Ledger className="max-w-2xl">
              <LedgerRow label={dict.results.task1} value={`${r.task1.correct}/${r.task1.total}`} />
              <LedgerRow label={dict.results.task2} value={`${r.task2.correct}/${r.task2.total}`} />
              <LedgerRow label={dict.results.reading} value={`${r.correct}/${r.total}`} hint={o.key[props.content.keySource]} emphasis />
            </Ledger>
            <AnswerGrid questions={r.questions} blocks={props.content.blocks} />
          </Section>
        )}

        <Section n={r && r.total > 0 ? 2 : 1} title={o.writingTitle}>
          {props.writings.length === 0 ? (
            <p className="text-sm text-ink-soft">{o.notAnswered}</p>
          ) : (
            <div className="space-y-12">
              {props.writings.map((w) => (
                <article key={w.practiceId} className="space-y-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold text-ink">
                      {w.task === 3 ? dict.results.task3 : dict.results.task4}
                      <span className="ml-2 text-sm font-normal text-ink-soft">{w.genre} · {t("official.words", { n: w.wordCount })}</span>
                    </h3>
                    {w.score != null && (
                      <span className="flex items-center gap-3">
                        <BandStamp pct={(w.score / 4) * 100} />
                        <span className="font-display text-2xl font-semibold tabular-nums text-ink">{num(w.score)}/4</span>
                      </span>
                    )}
                  </div>
                  {w.evaluation?.summary && <p className="max-w-3xl border-l-2 border-ink pl-4 text-[15px] leading-relaxed text-ink">{w.evaluation.summary}</p>}
                  {w.evaluation && (
                    <div className="grid max-w-4xl gap-x-10 gap-y-6 sm:grid-cols-2">
                      {WRITING_CRITERIA.map((k) => {
                        const c = w.evaluation?.criteria[k];
                        if (!c) return null;
                        return <CriterionScore key={k} label={dict.readiness.criterion[k]} score={c.score} max={4} comments={c.comment} />;
                      })}
                    </div>
                  )}
                  <InkLink href={`/writing/${w.practiceId}`}>{o.openFeedback}</InkLink>
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section n={(r && r.total > 0 ? 2 : 1) + 1} title={dict.results.nextTitle}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild size="lg"><Link href="/official">{o.another}</Link></Button>
            <InkLink href="/readiness">{dict.results.seeProgress}</InkLink>
          </div>
        </Section>
      </NotebookPage>
    </div>
  );
}
