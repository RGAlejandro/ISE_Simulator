"use client";

import { Badge } from "@/components/ui/badge";
import type { ReadingText } from "@/types";

/** Task 3 source texts A–D, laid out like the Trinity multi-text reading (D = infographic). */
export function SourceTexts({ sources }: { sources: ReadingText[] }) {
  return (
    <div className="space-y-3">
      {sources.map((s) => (
        <article key={s.letter} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <header className="flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/50 px-4 py-2.5">
            <Badge className="bg-brand-solid text-white text-xs shrink-0">{s.letter}</Badge>
            <span className="font-display font-semibold text-sm text-zinc-900 dark:text-zinc-100">{s.title}</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{s.source}</Badge>
            {s.author && <span className="w-full sm:w-auto text-[11px] text-zinc-400">{s.author}</span>}
          </header>
          <div className="px-4 py-3 space-y-3">
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{s.content}</p>
            {s.isGraph && s.graphData && <InfographicBars data={s.graphData} />}
          </div>
        </article>
      ))}
    </div>
  );
}

function InfographicBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2 rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs">
          <span className="truncate text-zinc-600 dark:text-zinc-400" title={d.label}>{d.label}</span>
          <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-300">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
