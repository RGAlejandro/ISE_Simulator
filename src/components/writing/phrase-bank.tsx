"use client";

import { useMemo } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { GENRE_GUIDES, READING_INTO_WRITING_SECTION, genreFamily } from "@/lib/writing-phrases";
import type { WritingTaskType } from "@/types";

interface Props {
  genre: string;
  taskType: WritingTaskType;
  strings: { phraseBank: string; structure: string; register: string };
  /** Insert a phrase at the editor cursor. */
  onInsert?: (phrase: string) => void;
}

/** Learning-mode sidebar: genre structure, register and functional phrases (tap to insert). */
export function PhraseBank({ genre, taskType, strings, onInsert }: Props) {
  const guide = GENRE_GUIDES[genreFamily(genre)];
  const sections = useMemo(
    () => (taskType === "READING_INTO_WRITING" ? [READING_INTO_WRITING_SECTION, ...guide.sections] : guide.sections),
    [guide, taskType],
  );

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{strings.structure}</p>
        <ol className="space-y-1.5 list-decimal pl-4 text-zinc-700 dark:text-zinc-300 marker:text-blue-500">
          {guide.structure.map((s) => <li key={s} className="leading-snug">{s}</li>)}
        </ol>
        <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs leading-snug text-blue-900 dark:text-blue-200">
          <span className="font-semibold">{strings.register}:</span> {guide.register}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{strings.phraseBank}</p>
        {sections.map((section, i) => (
          <details key={section.title} open={i < 2} className="group rounded-lg border border-zinc-200 dark:border-zinc-800">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">
              {section.title}
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="space-y-1 px-2 pb-2">
              {section.phrases.map((p) => (
                <li key={p}>
                  {onInsert ? (
                    <button
                      type="button"
                      onClick={() => onInsert(p)}
                      className="group/p flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left font-serif text-[13px] leading-snug text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    >
                      <Plus className="mt-0.5 h-3 w-3 shrink-0 text-blue-400 opacity-0 group-hover/p:opacity-100" />
                      {p}
                    </button>
                  ) : (
                    <span className="block px-1.5 py-1 font-serif text-[13px] leading-snug text-zinc-700 dark:text-zinc-300">{p}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
