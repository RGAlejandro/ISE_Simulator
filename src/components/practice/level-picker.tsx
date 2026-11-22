"use client";

import { EXAM_LEVELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ExamLevel = "ISE_FOUNDATION" | "ISE_I" | "ISE_II" | "ISE_III" | "ISE_IV";

/** ISE level buttons, ink style. Shared by the practice setup and the translation drill. */
export function LevelPicker({ value, onChange }: { value: string; onChange: (l: ExamLevel) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {EXAM_LEVELS.map((l) => {
        const active = value === l.value;
        return (
          <button
            key={l.value}
            type="button"
            onClick={() => onChange(l.value as ExamLevel)}
            aria-pressed={active}
            className={cn(
              "min-w-0 rounded-md border px-2.5 py-2 text-left transition-colors",
              active ? "border-ink bg-ink text-paper" : "border-rule text-ink hover:border-ink",
            )}
          >
            <span className="block text-sm font-semibold">{l.value === "ISE_FOUNDATION" ? "Foundation" : l.label}</span>
            <span className={cn("block text-[10px] uppercase tracking-wide", active ? "text-paper/70" : "text-ink-soft")}>{l.cefr}</span>
          </button>
        );
      })}
    </div>
  );
}
