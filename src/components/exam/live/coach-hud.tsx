"use client";

import { Gauge, Lightbulb, MessageCircleQuestion, MicVocal, Sparkles, Waves } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { LiveMetrics } from "@/lib/live-metrics";

interface CoachHudProps {
  metrics: LiveMetrics;
  /** Highlight the questions tile (Collaborative task: the candidate must lead). */
  emphasiseQuestions?: boolean;
  /** Show live nudges (hidden on the results report). */
  showNudges?: boolean;
  className?: string;
}

function Tile({ icon: Icon, label, children, hint, highlight }: { icon: typeof Gauge; label: string; children: React.ReactNode; hint?: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white/80 p-3 dark:bg-zinc-900/80",
        highlight ? "border-rose-300 ring-2 ring-rose-200/60 dark:border-rose-800 dark:ring-rose-900/40" : "border-zinc-200 dark:border-zinc-800",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

/** Live Coach: delivery metrics computed locally from the transcript (pace, talk share, range, fillers, connectors). */
export function CoachHud({ metrics: m, emphasiseQuestions, showNudges = true, className }: CoachHudProps) {
  const { dict } = useI18n();
  const l = dict.live;
  const talkPct = Math.round(m.talkShare * 100);
  const paceOk = m.wpm >= 110 && m.wpm <= 170;

  return (
    <div className={cn("space-y-3", className)}>
      {showNudges && m.nudges.length > 0 && (
        <div className="space-y-2">
          {m.nudges.map((n) => (
            <div
              key={n}
              className={cn(
                "flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
                n === "onTrack"
                  ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900"
                  : "bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900",
              )}
            >
              {n === "onTrack" ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> : <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{l.nudge[n]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Tile icon={Gauge} label={l.pace}>
          <p className="font-display text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {m.wpm || "—"} <span className="text-xs font-sans font-normal text-zinc-500">{l.paceUnit}</span>
          </p>
          <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={cn("h-full rounded-full transition-all duration-500", paceOk ? "bg-emerald-500" : "bg-amber-500")}
              style={{ width: `${Math.min(100, (m.wpm / 200) * 100)}%` }}
            />
          </div>
        </Tile>
        <Tile icon={MicVocal} label={l.talkShare}>
          <p className="font-display text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{m.candidateWords ? `${talkPct}%` : "—"}</p>
          <div className="relative mt-1.5 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={cn("h-full rounded-full transition-all duration-500", talkPct >= 60 ? "bg-emerald-500" : "bg-rose-500")}
              style={{ width: `${talkPct}%` }}
            />
            {/* Target: the candidate should do most of the talking. */}
            <span className="absolute top-[-3px] h-3 w-px bg-zinc-400 dark:bg-zinc-500" style={{ left: "60%" }} />
          </div>
        </Tile>
        <Tile icon={Waves} label={l.range}>
          <p className="font-display text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {m.candidateWords >= 20 ? `${Math.round(m.lexicalRange * 100)}` : "—"}
            <span className="text-xs font-sans font-normal text-zinc-500">/100</span>
          </p>
        </Tile>
        <Tile icon={MessageCircleQuestion} label={l.questions} highlight={emphasiseQuestions}>
          <p className="font-display text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{m.candidateQuestions}</p>
        </Tile>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{l.fillers}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {m.fillers.length === 0 ? (
            <span className="text-xs text-zinc-500">{l.none}</span>
          ) : (
            m.fillers.map((f) => (
              <span key={f.term} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                {f.term} <span className="font-semibold tabular-nums">×{f.count}</span>
              </span>
            ))
          )}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{l.connectors}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {m.connectors.length === 0 ? (
            <span className="text-xs text-zinc-500">{l.none}</span>
          ) : (
            m.connectors.map((c) => (
              <span key={c} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                {c}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
