"use client";

import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";
import { buildSegments, normalizeWord, splitSentences } from "@/lib/reading";
import type { ReadingTargetWord } from "@/types";

export interface WordTap {
  /** Word (or key-word expression) as it appears in the text. */
  word: string;
  paragraph: number;
  sentence: number;
  /** Index into targetWords when a key word was tapped. */
  target: number | null;
}

/** Stable id of a word occurrence; matches the server's lookup key. */
export function tapKey(word: string, paragraph: number, sentence: number): string {
  return `${normalizeWord(word)}|${paragraph}|${sentence}`;
}

interface Props {
  paragraphs: string[];
  targetWords: ReadingTargetWord[];
  /** Mark key words with the highlighter. */
  highlight: boolean;
  /** Words can be tapped (off during the quiz so it can't give answers away). */
  interactive: boolean;
  /** tapKey()s of words already looked up — shown with a dotted underline. */
  lookedUp?: Set<string>;
  selectedKey?: string | null;
  onWordTap?: (tap: WordTap) => void;
  className?: string;
}

export function ReadingPassage({
  paragraphs, targetWords, highlight, interactive, lookedUp, selectedKey, onWordTap, className,
}: Props) {
  const structure = useMemo(() => {
    const phrases = targetWords.map((t) => t.word);
    return paragraphs.map((p) => splitSentences(p).map((s) => buildSegments(s, phrases)));
  }, [paragraphs, targetWords]);

  // One delegated handler instead of a closure per word.
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!interactive || !onWordTap) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-word]");
    if (!el) return;
    const { word, p, s, t } = el.dataset;
    if (!word || p === undefined || s === undefined) return;
    onWordTap({ word, paragraph: Number(p), sentence: Number(s), target: t !== undefined ? Number(t) : null });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!(e.target as HTMLElement).dataset.word) return;
    e.preventDefault();
    handleClick(e as unknown as React.MouseEvent<HTMLElement>);
  };

  return (
    <article
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn("font-display text-[1.0625rem] sm:text-lg leading-8 sm:leading-9 text-zinc-800 dark:text-zinc-200", className)}
    >
      {structure.map((sentences, p) => (
        <div key={p} className="relative mb-5 last:mb-0">
          <span
            aria-hidden
            className="absolute -left-7 top-1.5 hidden sm:block font-mono text-[11px] text-zinc-400 dark:text-zinc-600 select-none"
          >
            {p + 1}
          </span>
          <p>
            {sentences.map((segments, s) => (
              <Fragment key={s}>
                {s > 0 && " "}
                {segments.map((seg, i) => {
                  if (seg.kind === "text") return <Fragment key={i}>{seg.text}</Fragment>;
                  const isTarget = seg.kind === "target";
                  const fromList = isTarget && !!targetWords[seg.target]?.fromList;
                  const key = tapKey(seg.text, p, s);
                  const selected = selectedKey === key;
                  return (
                    <span
                      key={i}
                      data-word={seg.text}
                      data-p={p}
                      data-s={s}
                      data-t={isTarget ? seg.target : undefined}
                      // Only key words are tab stops — hundreds of focusable words would be unusable.
                      role={interactive && isTarget ? "button" : undefined}
                      tabIndex={interactive && isTarget ? 0 : undefined}
                      className={cn(
                        "rounded-[3px] transition-colors",
                        interactive && "cursor-pointer hover:bg-amber-100/80 dark:hover:bg-amber-900/40",
                        isTarget && highlight && "marker-underline font-medium text-zinc-900 dark:text-zinc-50",
                        fromList && highlight && "underline decoration-sky-500 decoration-2 underline-offset-[6px]",
                        !isTarget && interactive && lookedUp?.has(key) &&
                          "underline decoration-dotted decoration-amber-500 decoration-2 underline-offset-[5px]",
                        selected && "bg-amber-200 dark:bg-amber-800/70 ring-2 ring-amber-300/70 dark:ring-amber-700/70",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                      )}
                    >
                      {seg.text}
                    </span>
                  );
                })}
              </Fragment>
            ))}
          </p>
        </div>
      ))}
    </article>
  );
}
