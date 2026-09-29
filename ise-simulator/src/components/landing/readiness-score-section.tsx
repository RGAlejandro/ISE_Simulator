"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarClock, Sparkles } from "lucide-react";

const SKILLS = [
  { label: "Reading", score: 82, color: "bg-blue-500" },
  { label: "Writing", score: 64, color: "bg-rose-500" },
  { label: "Speaking", score: 79, color: "bg-purple-500" },
  { label: "Listening", score: 88, color: "bg-emerald-500" },
];
const OVERALL = 78;

function useCountUp(target: number, run: boolean, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    const steps = 40;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setV(Math.round((target * i) / steps));
      if (i >= steps) clearInterval(id);
    }, ms / steps);
    return () => clearInterval(id);
  }, [target, run, ms]);
  return v;
}

export function ReadinessScoreSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const overall = useCountUp(OVERALL, inView);
  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <section className="paper-bg py-16 sm:py-24 border-y border-zinc-200/70 dark:border-zinc-800">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-white/70 dark:bg-zinc-900/70 px-3 py-1 text-xs font-medium text-brand">
            <Sparkles className="h-3 w-3" /> Trinity Readiness Score
          </span>
          <h2 className="font-display mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
            Know if you&apos;d{" "}
            <span className="marker-underline italic text-brand">pass today</span>
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-300 max-w-lg">
            Every exam you take feeds one number: your probability of passing — broken
            down by skill, with a predicted date you&apos;ll be ready for your real exam.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {[
              "See exactly which skill is holding you back",
              "A study plan that adapts to your exam date",
              "Watch the score climb every week",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-0.5 text-brand">✓</span> {f}
              </li>
            ))}
          </ul>
          <Link href="/sign-up" className="inline-block mt-7">
            <Button size="lg" className="gap-2 bg-brand-solid text-white hover:opacity-90">
              Get your score <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>

        {/* Animated score card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl shadow-brand/5 p-6 sm:p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">ISE II · B2</p>
              <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">Your readiness</p>
            </div>
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-3 py-1">
              HIGH
            </span>
          </div>

          <div className="flex items-center gap-6">
            {/* Ring */}
            <div className="relative h-32 w-32 shrink-0">
              <svg className="h-32 w-32 -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r={R} fill="none" strokeWidth="10" className="stroke-zinc-100 dark:stroke-zinc-800" />
                <motion.circle
                  cx="64" cy="64" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
                  className="stroke-brand"
                  strokeDasharray={C}
                  initial={{ strokeDashoffset: C }}
                  animate={inView ? { strokeDashoffset: C * (1 - OVERALL / 100) } : {}}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">{overall}</span>
                <span className="text-[10px] text-zinc-400">/ 100</span>
              </div>
            </div>

            {/* Skill bars */}
            <div className="flex-1 space-y-2.5">
              {SKILLS.map((s, i) => (
                <div key={s.label}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-zinc-500 dark:text-zinc-400">{s.label}</span>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">{s.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${s.color}`}
                      initial={{ width: 0 }}
                      animate={inView ? { width: `${s.score}%` } : {}}
                      transition={{ duration: 0.9, delay: 0.3 + i * 0.12, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 1.1 }}
            className="mt-6 flex items-center gap-2 rounded-xl bg-brand/5 border border-brand/15 px-4 py-3"
          >
            <CalendarClock className="h-4 w-4 text-brand shrink-0" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              At this pace you&apos;ll be ready by <strong className="text-brand">28 January</strong>.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
