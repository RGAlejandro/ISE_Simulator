"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

// Product facts only. No testimonials or usage figures until there are real ones to show.
const FACTS = [
  { to: 5, label: "ISE levels, from Foundation (A2) to ISE IV (C2)" },
  { to: 4, label: "skills marked against Trinity's official criteria" },
  { to: 3, label: "languages: English, Spanish and French" },
];

function Fact({ to, label, run }: { to: number; label: string; run: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    const steps = 20; let i = 0;
    const id = setInterval(() => { i++; setV(Math.round((to * i) / steps)); if (i >= steps) clearInterval(id); }, 600 / steps);
    return () => clearInterval(id);
  }, [to, run]);
  return (
    <div className="text-center">
      <div className="font-display text-3xl sm:text-4xl font-bold text-brand tabular-nums">{v}</div>
      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

export function SocialProofSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <section className="paper-bg py-16 sm:py-20 border-y border-zinc-200/70 dark:border-zinc-800">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-center text-zinc-900 dark:text-zinc-50 mb-10">
          Built around the real exam
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {FACTS.map((f) => <Fact key={f.label} {...f} run={inView} />)}
        </div>
      </div>
    </section>
  );
}
