"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InkBar, InkLink, NotebookPage, Section } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { BandStamp } from "@/components/results/results-parts";
import { ResultDetail, VerdictStamp, useStartRound } from "@/components/translation/translation-parts";
import { EXAM_LEVELS } from "@/lib/constants";
import { MAX_ANSWER, roundScore, type TranslationItem, type TranslationResult } from "@/lib/translation";

interface Props {
  id: string;
  level: string;
  items: TranslationItem[];
  initialAnswers: Record<string, TranslationResult>;
  canStartAnother: boolean;
}

export function TranslationSessionClient({ id, level, items, initialAnswers, canStartAnother }: Props) {
  const { dict, t, locale } = useI18n();
  const tr = dict.translation;
  const [answers, setAnswers] = useState(initialAnswers);
  // Resume at the first sentence not yet checked.
  const firstOpen = items.findIndex((i) => !initialAnswers[i.id]);
  const [index, setIndex] = useState(firstOpen === -1 ? items.length : firstOpen);
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const item = items[index];
  const result = item ? answers[item.id] : undefined;
  const checked = items.filter((i) => answers[i.id]).length;
  const levelLabel = EXAM_LEVELS.find((l) => l.value === level)?.label ?? level;

  useEffect(() => {
    if (result) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [index, result]);

  const check = async () => {
    if (!item || checking || draft.trim().length < 2) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/translation/${id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, answer: draft, locale }),
      });
      const data = await res.json();
      if (!res.ok || !data.result) throw new Error();
      setAnswers((a) => ({ ...a, [item.id]: data.result as TranslationResult }));
    } catch {
      setError(tr.error);
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    setDraft("");
    setError(null);
    setIndex((i) => i + 1);
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
      <Link href="/translation" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> {tr.back}
      </Link>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{levelLabel}</span>
    </div>
  );

  if (!item) return <Summary items={items} answers={answers} header={header} level={level} canStartAnother={canStartAnother} />;

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        {header}

        <div className="mt-8 max-w-3xl">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-ink-soft">{t("translation.progress", { i: index + 1, n: items.length })}</p>
            {item.structure && <p className="text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{item.structure}</p>}
          </div>
          <InkBar value={checked} max={items.length} className="mt-2" />

          <p lang={locale === "fr" ? "fr" : "es"} className="mt-10 font-display text-2xl font-semibold leading-snug text-ink sm:text-3xl text-balance">
            {item.source}
          </p>

          {!result ? (
            <div className="mt-8">
              <label htmlFor="translation-answer" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{tr.translateTo}</label>
              <textarea
                id="translation-answer"
                ref={inputRef}
                lang="en"
                rows={2}
                maxLength={MAX_ANSWER}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); check(); }
                }}
                placeholder={tr.placeholder}
                spellCheck={false}
                autoCapitalize="sentences"
                className="mt-2 w-full resize-none border-0 border-b-2 border-ink bg-transparent px-0 py-2 text-lg text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-0"
              />
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Button onClick={check} disabled={checking || draft.trim().length < 2}>
                  {checking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tr.checking}</> : tr.check}
                </Button>
                <span className="hidden text-xs text-ink-soft sm:inline">{tr.enterHint}</span>
              </div>
              {error && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-pen" role="alert">
                  <AlertCircle className="h-4 w-4" /> {error}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-8 space-y-5" aria-live="polite">
              <VerdictStamp verdict={result.verdict} className="text-xs" />
              <ResultDetail result={result} />
              <Button ref={nextRef} onClick={next}>{index + 1 < items.length ? tr.next : tr.finish}</Button>
            </div>
          )}
        </div>
      </NotebookPage>
    </div>
  );
}

function Summary({ items, answers, header, level, canStartAnother }: {
  items: TranslationItem[];
  answers: Record<string, TranslationResult>;
  header: React.ReactNode;
  level: string;
  canStartAnother: boolean;
}) {
  const { dict, t } = useI18n();
  const tr = dict.translation;
  const results = items.map((i) => answers[i.id]).filter(Boolean);
  const score = roundScore(results, items.length);
  const count = (v: TranslationResult["verdict"]) => results.filter((r) => r.verdict === v).length;
  const { start, starting, error } = useStartRound();

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        {header}
        <header className="space-y-2 pb-8 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">{tr.doneTitle}</p>
          <h1 className="flex flex-wrap items-center gap-4 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            <span className="tabular-nums">{score}{" "}%</span>
            <BandStamp pct={score} className="text-xs" />
          </h1>
          <p className="text-base text-ink-soft">
            {t("translation.doneSummary", { c: count("correct"), a: count("almost"), w: count("wrong") })}
          </p>
        </header>

        <Section n={1} title={tr.review}>
          <ol className="max-w-3xl divide-y divide-rule">
            {items.map((item, i) => {
              const r = answers[item.id];
              return (
                <li key={item.id} className="flex gap-4 py-5 first:pt-0">
                  <span className="w-6 shrink-0 font-display text-lg font-semibold tabular-nums text-ink-soft">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-display text-lg font-semibold leading-snug text-ink">{item.source}</p>
                      {r && <VerdictStamp verdict={r.verdict} />}
                    </div>
                    {r && <ResultDetail result={r} />}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section n={2} title={dict.results.nextTitle}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {canStartAnother ? (
              <Button size="lg" onClick={() => start(level)} disabled={starting}>
                {starting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tr.starting}</> : tr.again}
              </Button>
            ) : (
              <p className="font-hand text-xl text-pen">{tr.limitReached}</p>
            )}
            <InkLink href="/practice">{dict.nav.practice}</InkLink>
          </div>
          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-pen" role="alert">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
        </Section>
      </NotebookPage>
    </div>
  );
}
