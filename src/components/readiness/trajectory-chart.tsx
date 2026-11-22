"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/language-provider";
import { READY_LINE } from "@/lib/readiness";

interface Point {
  at: string;
  pPass: number;
}

interface TrajectoryChartProps {
  points: Point[];
  examDate: string | null;
  readyBy: string | null;
}

const H = 230;
const M = { t: 18, r: 52, b: 30, l: 40 };
const DAY = 86_400_000;

/**
 * Weekly chance-of-passing line (single series ⇒ no legend; the card title
 * names it). Ready line at 80 %, exam-day marker, optional projection to the
 * projected ready date. Crosshair + tooltip on hover, arrow keys on focus,
 * and a table view so no value is hover-only.
 */
export function TrajectoryChart({ points, examDate, readyBy }: TrajectoryChartProps) {
  const { dict, locale } = useI18n();
  const r = dict.readiness;
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }), [locale]);

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const times = points.map((p) => new Date(p.at).getTime());
    const t0 = times[0];
    let t1 = times[times.length - 1];
    const examT = examDate ? new Date(examDate).getTime() : null;
    const readyT = readyBy ? new Date(readyBy).getTime() : null;
    // Extend the axis to show exam day / projected ready date if they're within ~6 weeks.
    for (const t of [examT, readyT]) if (t && t > t1 && t - t1 < 42 * DAY) t1 = t;
    if (t1 === t0) t1 = t0 + 7 * DAY;
    const iw = width - M.l - M.r;
    const ih = H - M.t - M.b;
    const x = (t: number) => M.l + ((t - t0) / (t1 - t0)) * iw;
    const y = (p: number) => M.t + (1 - p) * ih;
    const xy = points.map((p, i) => [x(times[i]), y(p.pPass)] as const);
    const line = xy.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
    const area = `${line}L${xy[xy.length - 1][0].toFixed(1)},${y(0)}L${xy[0][0].toFixed(1)},${y(0)}Z`;
    const ticks = points.length <= 4 ? points.map((_, i) => i) : [0, Math.round((points.length - 1) / 3), Math.round(((points.length - 1) * 2) / 3), points.length - 1];
    return {
      x, y, xy, line, area, ticks,
      examX: examT && examT >= t0 && examT <= t1 ? x(examT) : null,
      projection: readyT && readyT <= t1 ? { x2: x(readyT), y2: y(READY_LINE) } : null,
    };
  }, [points, width, examDate, readyBy]);

  if (!geo) return <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">{r.trajectoryEmpty}</p>;

  const last = geo.xy[geo.xy.length - 1];
  const nearest = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = clientX - rect.left;
    let best = 0;
    geo.xy.forEach(([cx], i) => {
      if (Math.abs(cx - px) < Math.abs(geo.xy[best][0] - px)) best = i;
    });
    return best;
  };
  const a = active !== null ? geo.xy[active] : null;

  return (
    <div className="space-y-3">
      <div ref={boxRef} className="relative">
        <svg width={width} height={H} role="img" aria-label={r.trajectoryTitle} className="block max-w-full overflow-visible">
          {/* Recessive grid */}
          {[0, 0.5, 1].map((p) => (
            <g key={p}>
              <line x1={M.l} x2={width - M.r} y1={geo.y(p)} y2={geo.y(p)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
              <text x={M.l - 8} y={geo.y(p)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[11px] tabular-nums">
                {p * 100}%
              </text>
            </g>
          ))}
          {/* Ready line */}
          <line x1={M.l} x2={width - M.r} y1={geo.y(READY_LINE)} y2={geo.y(READY_LINE)} className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth={1} />
          <text x={width - M.r + 6} y={geo.y(READY_LINE)} dy="0.32em" className="fill-zinc-600 text-[11px] dark:fill-zinc-400">
            {READY_LINE * 100}%
          </text>
          {/* Exam day */}
          {geo.examX !== null && (
            <g>
              <line x1={geo.examX} x2={geo.examX} y1={M.t} y2={H - M.b} className="stroke-zinc-400 dark:stroke-zinc-600" strokeWidth={1} />
              <text x={geo.examX} y={M.t - 6} textAnchor="middle" className="fill-zinc-600 text-[11px] font-medium dark:fill-zinc-300">
                {r.exam}
              </text>
            </g>
          )}
          {/* Data */}
          <path d={geo.area} className="fill-[#2a78d6]/10 dark:fill-[#3987e5]/15" />
          {geo.projection && (
            <line x1={last[0]} y1={last[1]} x2={geo.projection.x2} y2={geo.projection.y2} strokeWidth={2} strokeLinecap="round" className="stroke-[#2a78d6]/45 dark:stroke-[#3987e5]/50" />
          )}
          <path d={geo.line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-[#2a78d6] dark:stroke-[#3987e5]" />
          <circle cx={last[0]} cy={last[1]} r={4} strokeWidth={2} className="fill-[#2a78d6] stroke-white dark:fill-[#3987e5] dark:stroke-zinc-900" />
          <text x={last[0] + 9} y={last[1]} dy="0.32em" className="fill-zinc-900 text-xs font-semibold dark:fill-zinc-50">
            {Math.round(points[points.length - 1].pPass * 100)}%
          </text>
          {/* X ticks */}
          {geo.ticks.map((i) => (
            <text key={i} x={geo.xy[i][0]} y={H - 8} textAnchor="middle" className="fill-zinc-500 text-[11px]">
              {fmt.format(new Date(points[i].at))}
            </text>
          ))}
          {/* Crosshair */}
          {a && (
            <g aria-hidden>
              <line x1={a[0]} x2={a[0]} y1={M.t} y2={H - M.b} className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth={1} />
              <circle cx={a[0]} cy={a[1]} r={5} strokeWidth={2} className="fill-[#2a78d6] stroke-white dark:fill-[#3987e5] dark:stroke-zinc-900" />
            </g>
          )}
          {/* Hit layer: the whole plot, snapping to the nearest week */}
          <rect
            x={M.l}
            y={M.t}
            width={width - M.l - M.r}
            height={H - M.t - M.b}
            fill="transparent"
            tabIndex={0}
            className="outline-none focus-visible:stroke-[#2a78d6]"
            onPointerMove={(e) => setActive(nearest(e.clientX))}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(points.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? points.length - 1) - 1));
              if (e.key === "ArrowRight") setActive((i) => Math.min(points.length - 1, (i ?? 0) + 1));
            }}
          />
        </svg>
        {a && active !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
            style={{ left: Math.min(width - 60, Math.max(60, a[0])), top: a[1] - 10 }}
            role="status"
          >
            <span className="font-semibold">{Math.round(points[active].pPass * 100)}%</span>
            <span className="ml-1.5 opacity-70">{fmt.format(new Date(points[active].at))}</span>
          </div>
        )}
      </div>

      <button type="button" onClick={() => setTable((v) => !v)} className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400">
        {table ? r.hideTable : r.showTable}
      </button>
      {table && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="py-1 font-medium">{r.colWeek}</th>
              <th className="py-1 text-right font-medium">{r.colChance}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {points.map((p) => (
              <tr key={p.at} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1 text-zinc-700 dark:text-zinc-300">{fmt.format(new Date(p.at))}</td>
                <td className="py-1 text-right text-zinc-900 dark:text-zinc-100">{Math.round(p.pPass * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
