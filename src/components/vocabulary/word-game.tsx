"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VocabCard } from "@/types";

export type GameMode = "complete" | "gapfill" | "dictation";

interface WordGameStrings {
  typeAnswer: string;
  check: string;
  next: string;
  correctLabel: string;
  wrongLabel: string;
  playAudio: string;
  translationHint: string;
  completePrompt: string;
  gapfillPrompt: string;
  dictationPrompt: string;
}

interface WordGameProps {
  card: VocabCard;
  mode: GameMode;
  strings: WordGameStrings;
  onResult: (correct: boolean) => void;
  onSpeak: (text: string) => void;
  isPlaying?: boolean;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Mask roughly half of the letters of a word, always keeping the first
 * letter visible. Deterministic per word so the pattern doesn't change
 * on re-render. Spaces/hyphens stay visible.
 */
function maskWord(word: string): string {
  const chars = word.split("");
  let letterIndex = 0;
  return chars
    .map((ch) => {
      if (!/[a-zA-Z]/.test(ch)) return ch;
      const i = letterIndex++;
      if (i === 0) return ch;
      // Stable pseudo-random: hide based on char code parity mix
      const hide = (word.charCodeAt(i % word.length) + i) % 2 === 0;
      return hide ? "_" : ch;
    })
    .join("");
}

/** Replace the target word (case-insensitive, basic inflection tolerance) with a gap. */
function gapSentence(example: string, word: string): { sentence: string; found: boolean } {
  // Try exact word, then word + common suffixes (s, es, ed, ing, d)
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}(s|es|ed|ing|d)?\\b`, "i");
  if (re.test(example)) {
    return { sentence: example.replace(re, "______"), found: true };
  }
  return { sentence: example, found: false };
}

export function WordGame({ card, mode, strings, onResult, onSpeak, isPlaying }: WordGameProps) {
  // NOTE: parent must render this component with key={card.id} so state
  // resets naturally when the card changes.
  const [input, setInput] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSpokeRef = useRef<string | null>(null);

  const masked = useMemo(() => maskWord(card.english), [card.english]);
  const gap = useMemo(() => gapSentence(card.example, card.english), [card.example, card.english]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Dictation: auto-play the word once per card
  useEffect(() => {
    if (mode === "dictation" && autoSpokeRef.current !== card.english) {
      autoSpokeRef.current = card.english;
      onSpeak(card.english);
    }
  }, [mode, card.english, onSpeak]);

  const check = useCallback(() => {
    if (result || !input.trim()) return;
    const correct = normalize(input) === normalize(card.english);
    setResult(correct ? "correct" : "wrong");
  }, [result, input, card.english]);

  const next = useCallback(() => {
    if (!result) return;
    onResult(result === "correct");
  }, [result, onResult]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (result) next();
    else check();
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6 pb-6 space-y-5">
        {/* Prompt area per mode */}
        {mode === "complete" && (
          <div className="space-y-3 text-center">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{strings.completePrompt}</p>
            <p className="font-mono text-2xl tracking-[0.3em] text-zinc-900 dark:text-zinc-100" data-testid="masked-word">
              {masked}
            </p>
            <p className="text-sm text-zinc-500">
              {strings.translationHint}: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{card.translation}</span>
            </p>
          </div>
        )}

        {mode === "gapfill" && (
          <div className="space-y-3 text-center">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{strings.gapfillPrompt}</p>
            <p className="text-lg leading-relaxed text-zinc-900 dark:text-zinc-100">
              {gap.found ? gap.sentence : `______ — ${card.example}`}
            </p>
            <p className="text-sm text-zinc-500">
              {strings.translationHint}: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{card.translation}</span>
            </p>
          </div>
        )}

        {mode === "dictation" && (
          <div className="space-y-3 text-center">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{strings.dictationPrompt}</p>
            <Button
              variant="outline"
              onClick={() => onSpeak(card.english)}
              disabled={isPlaying}
              className="gap-2"
            >
              <Volume2 className={cn("h-4 w-4", isPlaying && "animate-pulse")} />
              {strings.playAudio}
            </Button>
          </div>
        )}

        {/* Answer input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={strings.typeAnswer}
          disabled={!!result}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            "w-full rounded-md border px-3 py-3 text-center text-lg font-medium focus:outline-none focus:ring-2",
            !result && "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-amber-500",
            result === "correct" && "border-green-400 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300",
            result === "wrong" && "border-red-400 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
          )}
        />

        {/* Result feedback */}
        {result === "correct" && (
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" /> {strings.correctLabel}
          </p>
        )}
        {result === "wrong" && (
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" /> {strings.wrongLabel}:{" "}
            <span className="font-bold">{card.english}</span>
          </p>
        )}

        {/* Action button */}
        {result ? (
          <Button onClick={next} className="w-full gap-2 h-12">
            {strings.next} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={check} disabled={!input.trim()} className="w-full h-12">
            {strings.check}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
