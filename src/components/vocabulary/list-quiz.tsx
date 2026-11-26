"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Volume2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListQuizQuestion } from "@/lib/vocab-quiz";
import type { VocabCard } from "@/types";

export interface ListQuizStrings {
  quizMeaning: string;
  quizWord: string;
  quizGap: string;
  quizListen: string;
  quizKeys: string;
  /** "You picked {x}, which is {y}." */
  quizYourPick: string;
  playAudio: string;
  correctLabel: string;
  wrongLabel: string;
  next: string;
}

interface Props {
  card: VocabCard;
  question: ListQuizQuestion;
  strings: ListQuizStrings;
  onResult: (correct: boolean) => void;
  onSpeak: (text: string) => void;
  isPlaying?: boolean;
}

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

/**
 * One multiple-choice question about a word. Keys 1–4 answer, Enter goes on.
 * The parent renders it with key={card.id}, so state resets per word.
 */
export function ListQuiz({ card, question, strings, onResult, onSpeak, isPlaying }: Props) {
  const [chosen, setChosen] = useState<number | null>(null);
  const spokeRef = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const answered = chosen !== null;
  const right = chosen === question.answer;
  const { kind, prompt, options, answer } = question;

  // "Listen" plays the word once on arrival.
  useEffect(() => {
    if (kind === "listen" && !spokeRef.current) {
      spokeRef.current = true;
      onSpeak(card.english);
    }
  }, [kind, card.english, onSpeak]);

  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (!answered && n >= 1 && n <= options.length) {
        e.preventDefault();
        setChosen(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, options.length]);

  const label = { meaning: strings.quizMeaning, word: strings.quizWord, gap: strings.quizGap, listen: strings.quizListen }[kind];
  const showPos = (kind === "meaning" || kind === "word") && card.partOfSpeech && card.partOfSpeech !== "word";

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6 pb-6 space-y-5">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
          {kind === "meaning" && (
            <p className="text-3xl font-bold leading-snug text-zinc-900 dark:text-zinc-100 break-words" data-testid="quiz-prompt">{prompt}</p>
          )}
          {kind === "word" && (
            <p className="text-2xl font-bold leading-snug text-zinc-900 dark:text-zinc-100 break-words" data-testid="quiz-prompt">{prompt}</p>
          )}
          {kind === "gap" && (
            <p className="text-lg leading-relaxed text-zinc-900 dark:text-zinc-100" data-testid="quiz-prompt">{prompt}</p>
          )}
          {kind === "listen" && (
            <Button variant="outline" onClick={() => onSpeak(card.english)} disabled={isPlaying} className="gap-2">
              <Volume2 className={cn("h-4 w-4", isPlaying && "animate-pulse")} />
              {strings.playAudio}
            </Button>
          )}
          {showPos && <p className="text-xs italic text-zinc-400">{card.partOfSpeech}</p>}
        </div>

        <div className="grid gap-2">
          {options.map((o, i) => {
            const isAnswer = i === answer;
            const isChosen = i === chosen;
            return (
              <button
                key={`${i}-${o.text}`}
                type="button"
                disabled={answered}
                onClick={() => setChosen(i)}
                aria-keyshortcuts={String(i + 1)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                  !answered && "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 hover:border-amber-400 hover:bg-amber-50/60 dark:hover:border-amber-600 dark:hover:bg-amber-950/30",
                  answered && isAnswer && "border-green-400 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200",
                  answered && isChosen && !isAnswer && "border-red-400 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
                  answered && !isAnswer && !isChosen && "border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs",
                    answered && isAnswer ? "border-green-400 text-green-700 dark:text-green-300" : "border-zinc-300 dark:border-zinc-600 text-zinc-500",
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="flex-1 break-words">{o.text}</span>
                {answered && isAnswer && <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />}
                {answered && isChosen && !isAnswer && <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />}
              </button>
            );
          })}
        </div>

        {answered ? (
          <>
            <div
              role="status"
              className={cn(
                "rounded-lg border px-3 py-3 space-y-1.5 text-sm",
                right ? "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/40" : "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/40",
              )}
            >
              <p className={cn("flex items-center gap-1.5 font-semibold", right ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300")}>
                {right ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {right ? strings.correctLabel : `${strings.wrongLabel}: ${options[answer].text}`}
              </p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-zinc-700 dark:text-zinc-300">
                <button
                  type="button"
                  onClick={() => onSpeak(card.english)}
                  aria-label={strings.playAudio}
                  className="rounded p-0.5 text-zinc-500 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <Volume2 className={cn("h-4 w-4", isPlaying && "animate-pulse")} />
                </button>
                <span className="font-bold">{card.english}</span>
                <span className="text-zinc-400">—</span>
                <span>{card.translation}</span>
              </p>
              {card.example && <p className="italic text-zinc-500 dark:text-zinc-400">“{card.example}”</p>}
              {!right && chosen !== null && (
                <p className="text-zinc-600 dark:text-zinc-400">{fill(strings.quizYourPick, { x: options[chosen].text, y: options[chosen].pair })}</p>
              )}
            </div>
            <Button ref={nextRef} onClick={() => onResult(right)} className="w-full gap-2 h-12">
              {strings.next} <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <p className="hidden sm:block text-center text-xs text-zinc-400">{strings.quizKeys}</p>
        )}
      </CardContent>
    </Card>
  );
}
