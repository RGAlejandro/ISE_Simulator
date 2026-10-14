interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export function Donut({ data, size = 180, thickness = 22, centerLabel, centerValue }: Props) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const R = size / 2;
  const r = R - thickness / 2;
  const C = 2 * Math.PI * r;

  const segments = data.reduce<{ slice: Slice; len: number; offset: number }[]>((acc, s) => {
    const len = (s.value / total) * C;
    const offset = acc.length === 0 ? 0 : acc[acc.length - 1].offset + acc[acc.length - 1].len;
    acc.push({ slice: s, len, offset });
    return acc;
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={R} cy={R} r={r} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-zinc-100 dark:text-zinc-800" />
          {segments.map(({ slice, len, offset }) => (
            <circle
              key={slice.label}
              cx={R}
              cy={R}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${C}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {(centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {data.map((s) => {
          const pct = ((s.value / total) * 100).toFixed(1);
          return (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
              <span className="text-zinc-700 dark:text-zinc-300">{s.label}</span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{s.value} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
