"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, GraduationCap, Lightbulb, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InkLink, NotebookHeader, NotebookPage, Section } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { LessonLoading, useStartLesson, useTagLabel } from "@/components/teacher/teacher-parts";
import { cn } from "@/lib/utils";
import type { ClientExercise, ExerciseResult, LessonFeedback, OwnMistake, TeachableTag, TeacherLesson } from "@/lib/teacher";

export function LessonClient({ id, focus, lesson, exercises, initialAnswers, initialFeedback }: {
  id: string;
  focus: TeachableTag;
  lesson: TeacherLesson;
  exercises: ClientExercise[];
  initialAnswers: Record<string, string>;
  initialFeedback: LessonFeedback | null;
}) {
  const { dict, t, locale } = useI18n();
  const tc = dict.teacher;
  const label = useTagLabel();
  const topic = label(focus);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [results, setResults] = useState<ExerciseResult[] | null>(initialFeedback?.results ?? null);
  const [comment, setComment] = useState(initialFeedback?.comment ?? "");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { start, starting, error: startError } = useStartLesson();

  const done = results !== null;
  const byId = new Map((results ?? []).map((r) => [r.id, r]));
  const score = results?.filter((r) => r.ok).length ?? 0;
  const left = exercises.filter((e) => !(answers[e.id] ?? "").trim()).length;
  let n = 0;

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/lessons/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.results)) throw new Error();
      setResults(data.results);
      setComment(typeof data.comment === "string" ? data.comment : "");
      requestAnimationFrame(() => document.getElementById("lesson-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setError(tc.checkError);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex-1 bg-paper">
      {starting && <LessonLoading topic={label(starting)} />}
      <NotebookPage className="pb-16">
        <Link href="/grammar" className="inline-flex items-center gap-1.5 pt-6 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> {tc.back}
        </Link>
        <NotebookHeader eyebrow={t("teacher.eyebrow", { topic })} title={lesson.title} subtitle={lesson.intro} />

        {lesson.mistakes.length > 0 && (
          <Section n={++n} title={tc.yourMistakesTitle} eyebrow={tc.yourMistakesHint}>
            <ul className="max-w-3xl space-y-3">
              {lesson.mistakes.map((m, i) => (
                <li key={i} className="border-l-2 border-rule pl-4 font-serif text-[15px] leading-relaxed text-ink">
                  <Corrected mistake={m} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section n={++n} title={tc.rulesTitle}>
          <div className="max-w-3xl space-y-7">
            {lesson.rules.map((r, i) => (
              <div key={i} className="space-y-2">
                <h3 className="font-display text-lg font-semibold text-ink">{r.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink">{r.explanation}</p>
                {r.examples.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {r.examples.map((e, j) => (
                      <li key={j} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        {e.wrong && (
                          <>
                            <X className="h-3.5 w-3.5 shrink-0 self-center text-pen" aria-hidden />
                            <span className="text-pen line-through decoration-pen/70">{e.wrong}</span>
                          </>
                        )}
                        <Check className="h-3.5 w-3.5 shrink-0 self-center text-ink" aria-hidden />
                        <span className="font-medium text-ink">{e.right}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {lesson.tip && (
              <p className="flex gap-3 rounded-md border border-rule bg-[color-mix(in_srgb,var(--marker)_14%,transparent)] px-4 py-3 text-sm leading-relaxed text-ink">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span><span className="font-semibold">{tc.examTip}:</span> {lesson.tip}</span>
              </p>
            )}
          </div>
        </Section>

        <Section n={++n} title={tc.practiceTitle}>
          <ol className="max-w-3xl divide-y divide-rule border-y border-rule">
            {exercises.map((e, i) => (
              <li key={e.id} className="flex gap-4 py-5">
                <span className="w-6 shrink-0 font-display text-lg font-semibold tabular-nums text-ink-soft">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-3">
                  <Exercise
                    exercise={e}
                    value={answers[e.id] ?? ""}
                    onChange={(v) => setAnswers((a) => ({ ...a, [e.id]: v }))}
                    result={byId.get(e.id)}
                  />
                </div>
              </li>
            ))}
          </ol>

          {!done && (
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Button size="lg" onClick={check} disabled={checking || left === exercises.length}>
                {checking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tc.checking}</> : tc.check}
              </Button>
              {checking
                ? <span className="text-sm text-ink-soft" role="status">{tc.checkingHint}</span>
                : left > 0 && left < exercises.length && <span className="text-sm text-ink-soft">{t("teacher.unanswered", { n: left })}</span>}
              {error && <p className="flex items-center gap-1.5 text-sm text-pen" role="alert"><AlertCircle className="h-4 w-4" /> {error}</p>}
            </div>
          )}
        </Section>

        {done && (
          <Section n={++n} id="lesson-result" title={tc.scoreTitle}>
            <p className="font-display text-5xl font-semibold tabular-nums text-ink">{score}/{exercises.length}</p>
            {comment && (
              <figure className="mt-6 flex max-w-3xl gap-3 border-l-2 border-ink pl-4">
                <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden />
                <div>
                  <figcaption className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{tc.teacherSays}</figcaption>
                  <blockquote className="mt-1 font-serif text-[16px] leading-relaxed text-ink">{comment}</blockquote>
                </div>
              </figure>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button onClick={() => start(focus)} disabled={starting !== null}>{t("teacher.another", { topic: topic.toLowerCase() })}</Button>
              <InkLink href="/grammar">{tc.back}</InkLink>
              <InkLink href="/chat">{tc.askTutor}</InkLink>
            </div>
            {startError && <p className="mt-3 flex items-center gap-1.5 text-sm text-pen" role="alert"><AlertCircle className="h-4 w-4" /> {startError}</p>}
          </Section>
        )}
      </NotebookPage>
    </div>
  );
}

/** The learner's sentence: the wrong part crossed out in red, the correction after it. */
function Corrected({ mistake }: { mistake: OwnMistake }) {
  const at = mistake.sentence.indexOf(mistake.quote);
  if (at < 0) return <>{mistake.sentence}</>;
  return (
    <>
      {mistake.sentence.slice(0, at)}
      <span className="text-pen line-through decoration-pen/70">{mistake.quote}</span>{" "}
      <span className="font-sans text-sm font-semibold text-ink">{mistake.correction}</span>
      {mistake.sentence.slice(at + mistake.quote.length)}
    </>
  );
}

function Exercise({ exercise: e, value, onChange, result }: {
  exercise: ClientExercise;
  value: string;
  onChange: (v: string) => void;
  result: ExerciseResult | undefined;
}) {
  const { dict } = useI18n();
  const tc = dict.teacher;
  const done = !!result;

  const prompt = e.kind === "fix" ? tc.fixPrompt : e.kind === "gap" ? tc.gapPrompt : tc.choicePrompt;
  const givenText = e.kind === "choice" ? (e.options[Number(result?.given)] ?? "") : (result?.given ?? "");
  const input = (
    <input
      type="text"
      value={value}
      onChange={(ev) => onChange(ev.target.value)}
      readOnly={done}
      placeholder={tc.answerPlaceholder}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      aria-label={prompt}
      className={cn(
        "w-full max-w-md rounded-md border bg-paper px-3 py-2 text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/30",
        !done && "border-rule",
        done && result.ok && "border-ink",
        done && !result.ok && "border-pen text-pen",
      )}
    />
  );

  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {prompt}
        {e.kind === "fix" && e.own && (
          <span className="rounded-full border border-pen/40 px-2 py-px normal-case tracking-normal text-pen">{tc.fromYou}</span>
        )}
      </p>

      {e.kind === "fix" && (
        <>
          <p className="font-serif text-[15px] leading-relaxed text-ink"><Highlighted sentence={e.sentence} part={e.highlight} /></p>
          {input}
        </>
      )}

      {e.kind === "gap" && (
        <>
          <p className="font-serif text-[15px] leading-relaxed text-ink">
            <WithGaps text={e.sentence} />
          </p>
          {e.hint && (
            <p className="-mt-1 flex items-start gap-1.5 text-xs text-ink-soft">
              <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {e.hint.split(" · ").map((part, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {/* The letter clue ("a______") reads better in a fixed-width font. */}
                    <span className={part.includes("_") ? "font-mono tracking-wider text-ink" : undefined}>{part}</span>
                  </span>
                ))}
              </span>
            </p>
          )}
          {input}
        </>
      )}

      {e.kind === "choice" && (
        <>
          <p className="font-serif text-[15px] leading-relaxed text-ink"><WithGaps text={e.question} /></p>
          <div role="radiogroup" aria-label={prompt} className="flex flex-wrap gap-2">
            {e.options.map((opt, i) => {
              const picked = value === String(i);
              // The intended answer, or the learner's pick when the teacher accepted it too.
              const right = done && (opt === result.expected || (picked && result.ok));
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  disabled={done}
                  onClick={() => onChange(String(i))}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    !done && (picked ? "border-ink bg-ink text-paper" : "border-rule text-ink hover:border-ink"),
                    done && right && "border-ink font-semibold text-ink",
                    done && picked && !result.ok && "border-pen text-pen line-through",
                    done && !right && !picked && "border-rule text-ink-soft",
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      )}

      {result && (
        <div className="space-y-1 text-sm">
          <p className={cn("flex flex-wrap items-center gap-x-2 font-medium", result.ok ? "text-ink" : "text-pen")}>
            {result.ok ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
            {result.ok
              ? (result.note ? givenText : result.expected)
              : <>{e.kind !== "choice" && <span className="line-through">{result.given || tc.blank}</span>}<span className="text-ink">{tc.rightAnswer}: <span className="font-semibold">{result.expected}</span></span></>}
          </p>
          {result.note && <p className="leading-relaxed text-ink">{result.note} {tc.rightAnswer}: <span className="font-semibold">{result.expected}</span></p>}
          {result.why ? (
            <p className="flex gap-2 rounded-md bg-[color-mix(in_srgb,var(--pen)_7%,transparent)] px-3 py-2 leading-relaxed text-ink">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" aria-label={tc.teacherSays} />
              <span>{result.why}</span>
            </p>
          ) : (
            result.explanation && !result.note && <p className="leading-relaxed text-ink-soft">{result.explanation}</p>
          )}
        </div>
      )}
    </>
  );
}

/** "___" drawn as a blank line. */
function WithGaps({ text }: { text: string }) {
  return (
    <>
      {text.split(/_{3,}/).map((part, i, all) => (
        <span key={i}>
          {part}
          {i < all.length - 1 && <span aria-label="___" className="mx-1 inline-block w-16 border-b-2 border-ink-soft align-baseline" />}
        </span>
      ))}
    </>
  );
}

function Highlighted({ sentence, part }: { sentence: string; part: string }) {
  const at = sentence.indexOf(part);
  if (at < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, at)}
      <span className="underline decoration-pen decoration-2 underline-offset-4">{part}</span>
      {sentence.slice(at + part.length)}
    </>
  );
}
