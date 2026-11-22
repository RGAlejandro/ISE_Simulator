"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "connecting" | "speaking" | "listening";

interface ExaminerOrbProps {
  outAnalyser: RefObject<AnalyserNode | null>;
  micAnalyser: RefObject<AnalyserNode | null>;
  state: OrbState;
  initials: string;
  className?: string;
}

function rms(analyser: AnalyserNode | null, buf: Uint8Array<ArrayBuffer>): number {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/**
 * The examiner's "face": a breathing ink orb that swells with her voice, and
 * an outer rose ring that ripples with the candidate's microphone, so both
 * sides of the conversation are visible at a glance. Audio-reactive via
 * AnalyserNodes; writes CSS variables directly (no React re-renders per frame).
 */
export function ExaminerOrb({ outAnalyser, micAnalyser, state, initials, className }: ExaminerOrbProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const buf = new Uint8Array(256);
    let out = 0;
    let mic = 0;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      // Smooth (fast attack, slow release) so the orb feels alive, not jittery.
      const o = Math.min(1, rms(outAnalyser.current, buf) * 4);
      const m = Math.min(1, rms(micAnalyser.current, buf) * 5);
      out = o > out ? out + (o - out) * 0.5 : out + (o - out) * 0.12;
      mic = m > mic ? mic + (m - mic) * 0.5 : mic + (m - mic) * 0.1;
      el.style.setProperty("--out", reduced ? "0" : out.toFixed(3));
      el.style.setProperty("--mic", reduced ? "0" : mic.toFixed(3));
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [outAnalyser, micAnalyser]);

  return (
    <div
      ref={rootRef}
      data-state={state}
      className={cn("relative grid aspect-square w-56 sm:w-64 place-items-center select-none", className)}
      style={{ ["--out" as string]: 0, ["--mic" as string]: 0 }}
      aria-hidden
    >
      {/* Candidate ring (mic) */}
      <div
        className="absolute inset-0 rounded-full border-2 border-rose-400/60 dark:border-rose-400/50 transition-opacity duration-300"
        style={{ transform: "scale(calc(0.86 + var(--mic) * 0.22))", opacity: "calc(0.25 + var(--mic) * 1.2)" }}
      />
      <div
        className="absolute inset-[6%] rounded-full border border-rose-300/40 dark:border-rose-500/30"
        style={{ transform: "scale(calc(0.9 + var(--mic) * 0.14))" }}
      />
      {/* Examiner halo (voice) */}
      <div
        className="absolute inset-[14%] rounded-full bg-brand/20 blur-2xl"
        style={{ transform: "scale(calc(0.9 + var(--out) * 0.5))", opacity: "calc(0.35 + var(--out))" }}
      />
      {/* Core */}
      <div
        className={cn(
          "relative grid h-[58%] w-[58%] place-items-center rounded-full bg-gradient-to-br from-[#1e2a4a] via-[#2c3d6b] to-[#7a2946] shadow-2xl shadow-brand/30",
          "ring-4 ring-white/70 dark:ring-zinc-900/70",
          state === "connecting" && "animate-pulse",
          state === "idle" && "orb-breathe",
        )}
        style={{ transform: "scale(calc(1 + var(--out) * 0.12))" }}
      >
        <span className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white/95">{initials}</span>
        <span
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.35),transparent_55%)]"
        />
      </div>
    </div>
  );
}
