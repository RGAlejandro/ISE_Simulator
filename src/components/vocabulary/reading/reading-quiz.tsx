"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { buildSegments, isAnswerCorrect } from "@/lib/reading";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Search, Sparkles, XCircle, BookOpen } from "lucide-react";
import type { ReadingAnswer, ReadingQuestion } from "@/types";

interface Props {
  questions: ReadingQuestion[];
  onFinish: (answers: ReadingAnswer[]) => void;
}

const TYPE_ICON = { context: Sparkles, find: Search, comprehension: BookOpen } as const;

export function ReadingQuiz({ questions, onFinish }: Props) {
  const { dict, t } = useI18n();
  const r = dict.vocab.reading;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ReadingAnswer[]>(() => questions.map(() => null));
  const [checked, setChecked] = useState(false);
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const q = questions[index];
  const answer = answers[index];
  const correct = checked && isAnswerCorrect(q, answer);
  const isLast = index === questions.length - 1;

  useEffect(() => {
    if (q.type === "find") inputRef.current?.focus();
  }, [q]);

  // Keyboard flow: once answered, Enter/Space moves on.
  useEffect(() => {
    if (checked) nextRef.current?.focus();
  }, [checked]);

  const commit = (value: ReadingAnswer) => {
    if (checked) return;
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
    setChecked(true);
  };

  const next = () => {
    if (!checked) return;
    if (isLast) {
      onFinish(answers);
      return;
    }
    setIndex((i) => i + 1);
    setChecked(false);
    setTyped("");
  };

  const typeLabel = q.type === "context" ? r.typeContext : q.type === "find" ? r.typeFind : r.typeComprehension;
  const Icon = TYPE_ICON[q.type];

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5 sm:p-6 space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50 px-2.5 py-1 font-semibold text-amber-800 dark:text-amber-200">
            <Icon className="h-3.5 w-3.5" /> {typeLabel}
          </span>
          <span className="font-mono text-zinc-400">{t("vocab.reading.question", { n: index + 1, total: questions.length })}</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
            style={{ width: `${((index + (checked ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {q.type === "context" && (
        <div className="space-y-3">
          <p className="font-display text-base leading-relaxed text-zinc-700 dark:text-zinc-300 border-l-2 border-amber-400 pl-3 italic">
            {buildSegments(q.sentence, [q.word]).map((seg, i) =>
              seg.kind === "target" ? (
                <mark key={i} className="marker-underline bg-transparent not-italic font-semibold text-zinc-900 dark:text-zinc-50">{seg.text}</mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{q.question}</p>
        </div>
      )}

      {q.type === "comprehension" && (
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">{q.question}</p>
      )}

      {q.type === "find" && (
        <div className="space-y-2">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">{q.clue}</p>
          {q.paragraph && (
            <p className="text-xs font-medium text-zinc-500">
              {r.paragraph} {q.paragraph}
            </p>
          )}
        </div>
      )}

      {(q.type === "context" || q.type === "comprehension") && (
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const isPicked = answer === i;
            const isRight = q.answer === i;
            return (
              <button
                key={i}
                type="button"
                disabled={checked}
                onClick={() => commit(i)}
                className={cn(
                  "w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                  !checked && "border-zinc-200 dark:border-zinc-700 hover:border-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-950/30",
                  checked && isRight && "border-green-400 bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-200",
                  checked && isPicked && !isRight && "border-red-400 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200",
                  checked && !isPicked && !isRight && "border-zinc-200 dark:border-zinc-800 opacity-60",
                )}
              >
                <span className="font-mono text-xs font-bold text-zinc-400 mt-0.5">{String.fromCharCode(65 + i)}</span>
                <span className="flex-1">{opt}</span>
                {checked && isRight && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
                {checked && isPicked && !isRight && <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
              </button>
            );
          })}
        </div>
      )}

      {q.type === "find" && (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={checked ? String(answer ?? "") : typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (checked) next();
              else if (typed.trim()) commit(typed.trim());
            }}
            disabled={checked}
            placeholder={r.findPlaceholder}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={60}
            className={cn(
              "w-full rounded-xl border px-4 py-3 text-base font-medium focus:outline-none focus:ring-2",
              !checked && "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-amber-500",
              checked && correct && "border-green-400 bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-200",
              checked && !correct && "border-red-400 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200",
            )}
          />
        </div>
      )}

      {checked && (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm space-y-1",
            correct ? "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200" : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200",
          )}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            {correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {correct ? r.correct : r.incorrect}
            {!correct && q.type === "find" && (
              <span className="font-normal">
                — {r.correctAnswer}: <strong>{q.answer}</strong>
              </span>
            )}
          </p>
          {q.explanation && <p className="text-zinc-700 dark:text-zinc-300">{q.explanation}</p>}
        </div>
      )}

      {checked ? (
        <Button ref={nextRef} onClick={next} className="w-full h-11 gap-2 bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500">
          {isLast ? r.seeResults : r.next} <ArrowRight className="h-4 w-4" />
        </Button>
      ) : q.type === "find" ? (
        <Button onClick={() => commit(typed.trim())} disabled={!typed.trim()} className="w-full h-11 bg-amber-600 hover:bg-amber-700">
          {r.check}
        </Button>
      ) : null}
    </div>
  );
}
