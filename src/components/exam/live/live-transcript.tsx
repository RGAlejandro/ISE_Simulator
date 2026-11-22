"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { LiveTurn } from "@/lib/live-metrics";

interface LiveTranscriptProps {
  turns: LiveTurn[];
  examinerName: string;
  youLabel: string;
  emptyLabel: string;
  taskLabel: (task: string) => string;
  /** The last turn is still being streamed. */
  streaming: boolean;
  className?: string;
}

/** Streaming two-sided transcript with task dividers; sticks to the bottom unless the reader scrolls up. */
export function LiveTranscript({ turns, examinerName, youLabel, emptyLabel, taskLabel, streaming, className }: LiveTranscriptProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = boxRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  return (
    <div
      ref={boxRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      className={cn("overflow-y-auto overscroll-contain pr-1 space-y-3", className)}
      aria-live="polite"
    >
      {turns.length === 0 && <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>}
      {turns.map((turn, i) => {
        const showDivider = i === 0 || turns[i - 1].task !== turn.task;
        const mine = turn.role === "CANDIDATE";
        const isLast = i === turns.length - 1;
        return (
          <div key={turn.id}>
            {showDivider && (
              <div className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700/80 dark:text-rose-300/80">
                <span className="h-px flex-1 bg-rose-200 dark:bg-rose-900" />
                {taskLabel(turn.task)}
                <span className="h-px flex-1 bg-rose-200 dark:bg-rose-900" />
              </div>
            )}
            <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  mine
                    ? "rounded-br-md bg-rose-50 text-rose-950 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-50 dark:ring-rose-900"
                    : "rounded-bl-md bg-white text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800",
                )}
              >
                <p className={cn("mb-0.5 text-[11px] font-semibold", mine ? "text-rose-700 dark:text-rose-300" : "text-brand")}>
                  {mine ? youLabel : examinerName}
                </p>
                <p>
                  {turn.text}
                  {isLast && streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-current opacity-60" />}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
