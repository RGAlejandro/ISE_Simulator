"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Volume2, BookMarked, BookOpen } from "lucide-react";

type Demo = { id: string; label: string; icon: typeof Mic; accent: string };
const DEMOS: Demo[] = [
  { id: "oral", label: "Oral exam", icon: Mic, accent: "text-rose-500" },
  { id: "listening", label: "Listening", icon: Volume2, accent: "text-purple-500" },
  { id: "vocab", label: "Vocabulary", icon: BookMarked, accent: "text-amber-500" },
  { id: "grammar", label: "Grammar", icon: BookOpen, accent: "text-emerald-500" },
];

function OralDemo() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="h-7 w-7 rounded-full bg-rose-100 dark:bg-rose-900 grid place-items-center text-xs shrink-0">🤖</div>
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-xs text-zinc-700 dark:text-zinc-300 max-w-xs">
          &ldquo;Interesting point. Can you give me an example from your own experience?&rdquo;
        </div>
      </div>
      <div className="flex items-start gap-2 flex-row-reverse">
        <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 grid place-items-center text-xs shrink-0">👤</div>
        <div className="bg-brand-solid rounded-2xl rounded-tr-none px-3.5 py-2.5 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
          <div className="flex items-end gap-0.5 h-6">
            {[4, 7, 5, 9, 6, 8, 4, 7, 5, 8].map((h, i) => (
              <motion.span key={i} className="w-0.5 rounded-full bg-white/80"
                animate={{ height: [`${h * 2}px`, `${h * 3}px`, `${h * 2}px`] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.06 }}
                style={{ height: `${h * 2}px` }} />
            ))}
          </div>
          <span className="text-[10px] text-white/70">0:14</span>
        </div>
      </div>
    </div>
  );
}

function ListeningDemo() {
  const words = "Renewable energy has become cheaper than fossil fuels in most markets".split(" ");
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % (words.length + 3)), 380);
    return () => clearInterval(id);
  }, [words.length]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        <Volume2 className="h-4 w-4 text-purple-500" /> AI reading aloud · follow along
      </div>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        {words.map((w, i) => (
          <span key={i} className={i === active ? "rounded bg-purple-500 px-0.5 text-white" : ""}>{w} </span>
        ))}
      </p>
    </div>
  );
}

function VocabDemo() {
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setFlip((f) => !f), 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid place-items-center py-2" style={{ perspective: 800 }}>
      <motion.div animate={{ rotateY: flip ? 180 : 0 }} transition={{ duration: 0.5 }}
        style={{ transformStyle: "preserve-3d" }} className="relative h-28 w-56">
        <div className="absolute inset-0 rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 grid place-items-center" style={{ backfaceVisibility: "hidden" }}>
          <p className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">substantiate</p>
        </div>
        <div className="absolute inset-0 rounded-2xl border-2 border-amber-400 bg-amber-100 dark:bg-amber-900 grid place-items-center" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">corroborar</p>
        </div>
      </motion.div>
    </div>
  );
}

function GrammarDemo() {
  const opts = ["had", "have had", "had had", "would have"];
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setSel((s) => (s === null ? 2 : null)), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 italic">&ldquo;If I ___ more time, I would have studied harder.&rdquo;</p>
      {opts.map((o, i) => (
        <div key={i} className={`px-3 py-2 rounded-lg border text-xs transition-colors ${
          sel === i ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
          : "border-zinc-200 dark:border-zinc-700 text-zinc-500"}`}>
          <span className="font-mono mr-2">{["A", "B", "C", "D"][i]}.</span>{o}
        </div>
      ))}
    </div>
  );
}

const RENDER: Record<string, React.ReactNode> = {
  oral: <OralDemo />, listening: <ListeningDemo />, vocab: <VocabDemo />, grammar: <GrammarDemo />,
};

export function SeeInActionSection() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % DEMOS.length), 5000);
    return () => clearInterval(id);
  }, []);
  const active = DEMOS[i];

  return (
    <section className="py-16 sm:py-24 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            See it in action
          </h2>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">Real modules, running live. No screenshots.</p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {DEMOS.map((d, idx) => {
            const Icon = d.icon;
            return (
              <button key={d.id} onClick={() => setI(idx)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                  i === idx ? "border-brand bg-brand/5 text-brand"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300"}`}>
                <Icon className={`h-4 w-4 ${i === idx ? d.accent : ""}`} /> {d.label}
              </button>
            );
          })}
        </div>

        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-5 min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.div key={active.id}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.35 }}>
              {RENDER[active.id]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-1.5 mt-4">
          {DEMOS.map((d, idx) => (
            <span key={d.id} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-brand" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
