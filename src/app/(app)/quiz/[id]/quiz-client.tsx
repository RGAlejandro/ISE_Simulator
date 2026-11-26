"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InkBar, InkLink, NotebookPage, Section } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { QuizLoading, WithGaps, useSourceLine, useStartQuiz } from "@/components/quiz/quiz-parts";
import { cn } from "@/lib/utils";
import type { ClientQuizQuestion, QuizReveal } from "@/lib/quiz";

export function QuizClient({ id, questions, initialReveals, initialMastered, canStartAnother }: {
  id: string;
  questions: ClientQuizQuestion[];
  initialReveals: Record<string, QuizReveal>;
  initialMastered: number | null;
  canStartAnother: boolean;
}) {
  const { dict, t } = useI18n();
  const tq = dict.quiz;
  const [reveals, setReveals] = useState(initialReveals);
  // Resume at the first question not answered yet.
  const firstOpen = questions.findIndex((q) => !initialReveals[q.id]);
  const [index, setIndex] = useState(firstOpen === -1 ? questions.length : firstOpen);
  const [checking, setChecking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mastered, setMastered] = useState(initialMastered);
  const nextRef = useRef<HTMLButtonElement>(null);
  const sourceLine = useSourceLine();

  const q = questions[index];
  const shown = q ? reveals[q.id] : undefined;
  const answered = Object.keys(reveals).length;

  const choose = async (choice: number) => {
    if (!q || shown || checking !== null) return;
    setChecking(choice);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/${id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qid: q.id, choice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reveal) throw new Error();
      setReveals((r) => ({ ...r, [q.id]: data.reveal as QuizReveal }));
      if (data.done && typeof data.mastered === "number") setMastered(data.mastered);
    } catch {
      setError(tq.checkError);
    } finally {
      setChecking(null);
    }
  };

  const next = () => {
    setError(null);
    setIndex((i) => i + 1);
  };

  useEffect(() => {
    if (shown) nextRef.current?.focus();
  }, [shown]);

  // 1–4 pick an option; Enter moves on once it's corrected.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!shown && /^[1-4]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < q.options.length) choose(i);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const header = (
    <Link href="/quiz" className="inline-flex items-center gap-1.5 pt-6 text-sm text-ink-soft hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" /> {tq.back}
    </Link>
  );

  if (!q) {
    return <Summary questions={questions} reveals={reveals} mastered={mastered} header={header} canStartAnother={canStartAnother} />;
  }

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        {header}
        <div className="mt-8 max-w-3xl">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-ink-soft">{t("quiz.progress", { i: index + 1, n: questions.length })}</p>
            <p className="text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{sourceLine(q)}</p>
          </div>
          <InkBar value={answered} max={questions.length} className="mt-2" />

          <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{q.prompt}</p>
          <p lang={q.source === "vocab" ? undefined : "en"} className="mt-2 font-display text-2xl font-semibold leading-snug text-ink sm:text-3xl text-balance">
            <WithGaps text={q.question} />
          </p>

          <div role="radiogroup" aria-label={q.prompt} className="mt-8 grid gap-2.5">
            {q.options.map((opt, i) => {
              const picked = shown?.choice === i;
              const right = shown && shown.answer === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  disabled={!!shown || checking !== null}
                  onClick={() => choose(i)}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-4 py-3 text-left text-[15px] transition-colors",
                    !shown && "border-rule text-ink hover:border-ink disabled:opacity-60",
                    right && "border-ink bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] font-semibold text-ink",
                    shown && picked && !shown.correct && "border-pen text-pen",
                    shown && !right && !picked && "border-rule text-ink-soft opacity-70",
                  )}
                >
                  <span className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    right ? "border-ink bg-ink text-paper" : shown && picked ? "border-pen bg-pen text-paper" : "border-rule text-ink-soft",
                  )}>
                    {checking === i ? <Loader2 className="h-3 w-3 animate-spin" /> : right ? <Check className="h-3.5 w-3.5" /> : shown && picked ? <X className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span lang={q.source === "vocab" ? undefined : "en"} className="min-w-0">{opt}</span>
                </button>
              );
            })}
          </div>

          {!shown && <p className="mt-4 hidden text-xs text-ink-soft sm:block">{tq.keysHint}</p>}
          {error && (
            <p className="mt-4 flex items-center gap-1.5 text-sm text-pen" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          {shown && (
            <div className="mt-6 space-y-4" aria-live="polite">
              <Explanation q={q} r={shown} />
              <Button ref={nextRef} onClick={next}>{index + 1 < questions.length ? tq.next : tq.finish}</Button>
            </div>
          )}
        </div>
      </NotebookPage>
    </div>
  );
}

/** Why the pick is wrong (in the teacher's words), why the right one is right, and what the learner wrote back then. */
function Explanation({ q, r }: { q: ClientQuizQuestion; r: QuizReveal }) {
  const { dict } = useI18n();
  const tq = dict.quiz;
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {!r.correct && r.why && (
        <p className="flex gap-2 rounded-md bg-[color-mix(in_srgb,var(--pen)_8%,transparent)] px-3 py-2 text-ink">
          <X className="mt-1 h-4 w-4 shrink-0 text-pen" aria-hidden />
          <span>{r.why}</span>
        </p>
      )}
      <p className="flex gap-2 text-ink">
        <Check className="mt-1 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {!r.correct && <><span className="font-semibold">{tq.rightAnswer}: {q.options[r.answer]}.</span>{" "}</>}
          {r.rightWhy}
        </span>
      </p>
      {r.yours && q.source !== "vocab" && (
        <p className="border-l-2 border-rule pl-3 text-sm text-ink-soft">
          {tq.yours[q.source]} <span lang="en" className="text-pen line-through decoration-pen/60">{r.yours}</span>
        </p>
      )}
    </div>
  );
}

function Summary({ questions, reveals, mastered, header, canStartAnother }: {
  questions: ClientQuizQuestion[];
  reveals: Record<string, QuizReveal>;
  mastered: number | null;
  header: React.ReactNode;
  canStartAnother: boolean;
}) {
  const { dict, t } = useI18n();
  const tq = dict.quiz;
  const score = questions.filter((q) => reveals[q.id]?.correct).length;
  const { start, starting, error } = useStartQuiz();
  const sourceLine = useSourceLine();

  return (
    <div className="flex-1 bg-paper">
      {starting && <QuizLoading />}
      <NotebookPage className="pb-16">
        {header}
        <header className="space-y-2 pb-8 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">{tq.doneTitle}</p>
          <h1 className="font-display text-5xl font-semibold tabular-nums tracking-tight text-ink">{score}/{questions.length}</h1>
          {!!mastered && <p className="text-base text-ink-soft">{t("quiz.masteredNow", { n: mastered })}</p>}
        </header>

        <Section n={1} title={tq.reviewTitle}>
          <ol className="max-w-3xl divide-y divide-rule border-y border-rule">
            {questions.map((q, i) => {
              const r = reveals[q.id];
              return (
                <li key={q.id} className="flex gap-4 py-4">
                  <span className="w-6 shrink-0 font-display text-lg font-semibold tabular-nums text-ink-soft">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{sourceLine(q)}</p>
                    <p lang={q.source === "vocab" ? undefined : "en"} className="font-serif text-[15px] leading-relaxed text-ink"><WithGaps text={q.question} /></p>
                    {r && (
                      <p className={cn("flex items-start gap-2 text-sm font-medium", r.correct ? "text-ink" : "text-pen")}>
                        {r.correct ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                        <span>
                          {!r.correct && <><span className="line-through">{q.options[r.choice]}</span>{" "}</>}
                          <span className="text-ink">{q.options[r.answer]}</span>
                        </span>
                      </p>
                    )}
                    {r && !r.correct && r.why && <p className="text-sm leading-relaxed text-ink-soft">{r.why}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section n={2} title={dict.results.nextTitle}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {canStartAnother ? (
              <Button size="lg" onClick={start} disabled={starting}>{tq.again}</Button>
            ) : (
              <p className="font-hand text-xl text-pen">{tq.limitReached}</p>
            )}
            <InkLink href="/quiz">{tq.back}</InkLink>
            <InkLink href="/grammar">{dict.teacher.title}</InkLink>
          </div>
          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-pen" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </Section>
      </NotebookPage>
    </div>
  );
}
