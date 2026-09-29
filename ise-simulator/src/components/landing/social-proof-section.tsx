"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  { quote: "The AI examiner actually feels like the real oral. I stopped panicking on exam day.", name: "Sara M.", meta: "Passed ISE II · Merit" },
  { quote: "Went from B1 to B2 level in six weeks of daily practice. The feedback is brutal but fair.", name: "Marco R.", meta: "ISE II candidate" },
  { quote: "As a teacher I use it with my whole class. The listening transcripts are gold.", name: "Elena P.", meta: "Trinity prep tutor" },
];

const STATS = [
  { to: 1.2, prefix: "+", suffix: " bands", label: "Average improvement" },
  { to: 12000, suffix: "+", label: "Exams practised", big: true },
  { to: 4.8, suffix: "★", label: "Student rating" },
];

function Stat({ to, prefix = "", suffix = "", label, big, run }: { to: number; prefix?: string; suffix?: string; label: string; big?: boolean; run: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    const steps = 40; let i = 0;
    const id = setInterval(() => { i++; setV((to * i) / steps); if (i >= steps) clearInterval(id); }, 1000 / steps);
    return () => clearInterval(id);
  }, [to, run]);
  const shown = big ? Math.round(v).toLocaleString() : v.toFixed(1);
  return (
    <div className="text-center">
      <div className="font-display text-3xl sm:text-4xl font-bold text-brand tabular-nums">{prefix}{shown}{suffix}</div>
      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

export function SocialProofSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <section className="paper-bg py-16 sm:py-24 border-y border-zinc-200/70 dark:border-zinc-800">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-3xl mx-auto mb-14">
          {STATS.map((s) => <Stat key={s.label} {...s} run={inView} />)}
        </div>

        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-center text-zinc-900 dark:text-zinc-50 mb-10">
          Loved by ISE students
        </motion.h2>

        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure key={t.name}
              initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: i * 0.12 }}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm flex flex-col">
              <Quote className="h-6 w-6 text-brand/30 mb-3" />
              <blockquote className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</blockquote>
              <div className="flex gap-0.5 mt-4">
                {[...Array(5)].map((_, s) => <Star key={s} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}
              </div>
              <figcaption className="mt-2 text-xs">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{t.name}</span>
                <span className="text-zinc-400"> · {t.meta}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
