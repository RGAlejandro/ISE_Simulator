import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "blue" | "green" | "purple" | "amber" | "rose" | "zinc";

const TONES: Record<Tone, { ring: string; bg: string; icon: string; trend: string }> = {
  blue:   { ring: "ring-blue-200/60 dark:ring-blue-900/40",     bg: "from-blue-50 to-transparent dark:from-blue-950/40",       icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",       trend: "text-blue-600 dark:text-blue-300" },
  green:  { ring: "ring-emerald-200/60 dark:ring-emerald-900/40", bg: "from-emerald-50 to-transparent dark:from-emerald-950/40", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300", trend: "text-emerald-600 dark:text-emerald-300" },
  purple: { ring: "ring-purple-200/60 dark:ring-purple-900/40", bg: "from-purple-50 to-transparent dark:from-purple-950/40",   icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300", trend: "text-purple-600 dark:text-purple-300" },
  amber:  { ring: "ring-amber-200/60 dark:ring-amber-900/40",   bg: "from-amber-50 to-transparent dark:from-amber-950/40",     icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",     trend: "text-amber-600 dark:text-amber-300" },
  rose:   { ring: "ring-rose-200/60 dark:ring-rose-900/40",     bg: "from-rose-50 to-transparent dark:from-rose-950/40",       icon: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",         trend: "text-rose-600 dark:text-rose-300" },
  zinc:   { ring: "ring-zinc-200/60 dark:ring-zinc-800/60",     bg: "from-zinc-50 to-transparent dark:from-zinc-900/40",       icon: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",            trend: "text-zinc-600 dark:text-zinc-300" },
};

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
  trend?: { value: number; suffix?: string };
}

export function StatCard({ label, value, hint, icon, tone = "blue", trend }: Props) {
  const t = TONES[tone];
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 sm:p-5 ring-1",
      t.ring,
    )}>
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", t.bg)} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
          {hint && <p className="mt-1 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 leading-tight">{hint}</p>}
          {trend && (
            <p className={cn("mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-medium tabular-nums", t.trend)}>
              {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}{trend.suffix ?? ""}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn("flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl", t.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
