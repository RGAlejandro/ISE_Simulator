import { cn } from "@/lib/utils";

interface Props {
  data: { label: string; value: number; color?: string }[];
  formatValue?: (v: number) => string;
  className?: string;
}

export function BarChart({ data, formatValue, className }: Props) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className={cn("space-y-3", className)}>
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span className="truncate">{d.label}</span>
              <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{formatValue ? formatValue(d.value) : d.value}</span>
            </div>
            <div className="mt-1 h-2.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: d.color ?? "linear-gradient(90deg,#3b82f6,#6366f1)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
