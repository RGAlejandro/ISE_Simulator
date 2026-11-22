"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { buildAnnotatedSegments } from "@/lib/writing";
import type { WritingIssue, WritingUpgrade } from "@/types";

export type AnnotationRef = { kind: "issue" | "upgrade"; index: number };

interface Props {
  text: string;
  issues: WritingIssue[];
  upgrades: WritingUpgrade[];
  selected: AnnotationRef | null;
  onSelect: (ref: AnnotationRef) => void;
}

/**
 * The candidate's draft with mistakes (red wavy underline) and Word Upgrade
 * candidates (amber dotted underline). Offsets come from the server, which
 * already guaranteed they point at real, non-overlapping spans.
 */
export function AnnotatedText({ text, issues, upgrades, selected, onSelect }: Props) {
  const segments = useMemo(() => buildAnnotatedSegments(text, issues, upgrades), [text, issues, upgrades]);

  return (
    <div className="whitespace-pre-wrap font-serif text-[15px] sm:text-base leading-8 text-zinc-800 dark:text-zinc-200">
      {segments.map((seg, i) => {
        if (seg.kind === "text") return <span key={i}>{seg.text}</span>;
        const isSelected = selected?.kind === seg.kind && selected.index === seg.index;
        const isIssue = seg.kind === "issue";
        return (
          <button
            key={i}
            type="button"
            id={`ann-${seg.kind}-${seg.index}`}
            onClick={() => onSelect({ kind: seg.kind, index: seg.index })}
            aria-pressed={isSelected}
            className={cn(
              "inline rounded-sm px-0.5 -mx-0.5 text-left underline underline-offset-4 decoration-2 transition-colors cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              isIssue
                ? "decoration-wavy decoration-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                : "decoration-dotted decoration-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40",
              isSelected && (isIssue ? "bg-red-100 dark:bg-red-950/60" : "bg-amber-100 dark:bg-amber-950/60"),
            )}
          >
            {seg.text}
          </button>
        );
      })}
    </div>
  );
}
