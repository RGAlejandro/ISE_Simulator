"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MousePointerClick, Brain, Trophy } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

/* ── Preview 1: Module Selector ─────────────────────────── */
function ModulePreview() {
  const [active, setActive] = useState(0);
  const modules = [
    { emoji: "✍️", label: "Written Exam" },
    { emoji: "🎙️", label: "Oral Exam" },
    { emoji: "🎧", label: "Listening" },
    { emoji: "📖", label: "Grammar" },
    { emoji: "📚", label: "Vocabulary" },
  ];
  useEffect(() => {
    const t = setInterval(() => setActive(v => (v + 1) % modules.length), 1100);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="p-3 space-y-1.5">
      <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider text-center mb-2">
        ISE II · Select module
      </p>
      {modules.map((m, i) => (
        <div
          key={m.label}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
            i === active
              ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
              : "bg-zinc-800 text-zinc-400"
          }`}
        >
          <span className="text-sm leading-none">{m.emoji}</span>
          <span>{m.label}</span>
          {i === active && (
            <span className="ml-auto text-[9px] bg-white/25 px-1.5 py-0.5 rounded-full">✓</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Preview 2: AI Examiner ─────────────────────────────── */
const AI_MSGS = [
  "Describe the photo you see…",
  "What can you infer from it?",
  "Analysing your response…",
  "Good, keep going…",
];
function AIPreview() {
  const [mi, setMi] = useState(0);
  const [dots, setDots] = useState("");
  useEffect(() => {
    const t1 = setInterval(() => setMi(v => (v + 1) % AI_MSGS.length), 2000);
    const t2 = setInterval(() => setDots(d => (d.length >= 3 ? "" : d + ".")), 450);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);
  const bars = [4, 8, 13, 9, 15, 7, 5, 11, 15, 8, 4, 10, 13, 6, 4];
  return (
    <div className="p-3">
      <div className="flex items-start gap-2 mb-3">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center flex-shrink-0 ring-2 ring-purple-500/30">
          <Brain className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="bg-zinc-800 rounded-2xl rounded-tl-none px-3 py-2 text-xs text-zinc-200 leading-snug max-w-[148px] min-h-[36px] border border-zinc-700/50">
          {AI_MSGS[mi]}{dots}
        </div>
      </div>
      <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-700/50">
        <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
        <div className="flex items-end gap-px flex-1">
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-purple-400"
              style={{
                height: `${h}px`,
                transformOrigin: "bottom",
                animationName: "waveBar",
                animationDuration: `${0.8 + (i % 4) * 0.12}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDelay: `${i * 0.06}s`,
              }}
            />
          ))}
        </div>
        <span className="text-[10px] text-zinc-500 flex-shrink-0 font-medium">REC</span>
      </div>
    </div>
  );
}

/* ── Preview 3: Feedback Report ─────────────────────────── */
function FeedbackPreview() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);
  const scores = [
    { label: "Grammar",    value: 87, color: "bg-emerald-500" },
    { label: "Vocabulary", value: 92, color: "bg-emerald-400" },
    { label: "Fluency",    value: 78, color: "bg-teal-400"    },
    { label: "Task",       value: 85, color: "bg-green-500"   },
  ];
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">AI Report</span>
        <div className="flex items-baseline gap-0.5">
          <span className="text-xl font-bold text-emerald-400">85</span>
          <span className="text-xs text-zinc-500">/100</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {scores.map(s => (
          <div key={s.label}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-zinc-400">{s.label}</span>
              <span className="text-zinc-300 font-semibold">{s.value}%</span>
            </div>
            <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${s.color} rounded-full transition-all duration-700 ease-out`}
                style={{ width: ready ? `${s.value}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5">
        <p className="text-[10px] text-emerald-400 leading-tight">✓ Focus on fluency before exam day.</p>
      </div>
    </div>
  );
}

/* ── Steps config ───────────────────────────────────────── */
type StepDef = {
  step: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  hoverHint: string;
  tapHint: string;
  color: string;
  ring: string;
  iconBg: string;
  iconColor: string;
  glow: string;
  Preview: React.ComponentType;
};

const steps: StepDef[] = [
  {
    step: "01",
    icon: MousePointerClick,
    title: "Choose your module",
    description: "Pick your ISE level and the skill you want to practise — written exam, oral simulation, listening, grammar, or vocabulary flashcards.",
    hoverHint: "hover to preview",
    tapHint: "tap to preview",
    color: "bg-blue-500",
    ring: "ring-blue-500/40",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
    glow: "shadow-blue-500/40",
    Preview: ModulePreview,
  },
  {
    step: "02",
    icon: Brain,
    title: "Practice with AI",
    description: "The AI generates unique content every session. Speak to the examiner, fill in your answers, flip vocab cards — fully interactive.",
    hoverHint: "hover to preview",
    tapHint: "tap to preview",
    color: "bg-purple-500",
    ring: "ring-purple-500/40",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-400",
    glow: "shadow-purple-500/40",
    Preview: AIPreview,
  },
  {
    step: "03",
    icon: Trophy,
    title: "Get instant feedback",
    description: "Receive detailed scores on grammar, vocabulary, task fulfillment, and more. Know exactly what to fix before exam day.",
    hoverHint: "hover to preview",
    tapHint: "tap to preview",
    color: "bg-emerald-500",
    ring: "ring-emerald-500/40",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    glow: "shadow-emerald-500/40",
    Preview: FeedbackPreview,
  },
];

/* ── StepCard ───────────────────────────────────────────── */
function StepCard({ step, idx }: { step: StepDef; idx: number }) {
  const [hovered, setHovered] = useState(false);
  const Icon = step.icon;
  const Preview = step.Preview;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: idx * 0.2, duration: 0.5 }}
      className="relative flex flex-col items-center text-center"
    >
      {/* Step number circle */}
      <div className="relative mb-6">
        <motion.div
          whileInView={{ scale: [0.8, 1.05, 1] }}
          viewport={{ once: true }}
          transition={{ delay: idx * 0.2 + 0.3, duration: 0.5 }}
          className={`relative z-10 h-16 w-16 rounded-full ${step.color} flex items-center justify-center text-white text-xl font-bold shadow-lg`}
        >
          {step.step}
        </motion.div>
        <span
          className={`absolute inset-0 rounded-full ${step.color} opacity-40 animate-ping`}
          style={{ animationDuration: "2s", animationDelay: `${idx * 0.4}s` }}
        />
      </div>

      {/* Icon box — hover/tap target for preview popup */}
      <div
        className="relative mb-4"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setHovered(v => !v)}
      >
        <div
          className={`h-16 w-16 rounded-2xl ${step.iconBg} flex items-center justify-center ring-2 ${step.ring} cursor-pointer transition-all duration-300 ${
            hovered ? `scale-110 shadow-xl ${step.glow}` : "shadow-sm"
          }`}
        >
          <Icon className={`h-7 w-7 ${step.iconColor} transition-transform duration-300 ${hovered ? "scale-110" : ""}`} />
        </div>

        {/* Hover/tap hint */}
        <p className={`absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-500 transition-opacity duration-200 ${hovered ? "opacity-0" : "opacity-100"}`}>
          <span className="hidden md:inline">{step.hoverHint}</span>
          <span className="md:hidden">{step.tapHint}</span>
        </p>

        {/* Animated popup */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50"
            >
              <div className="w-52 rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-2xl shadow-black/70 overflow-hidden">
                <Preview />
              </div>
              {/* Arrow */}
              <div className="flex justify-center -mt-px">
                <div className="h-[7px] w-[7px] rotate-45 bg-zinc-900 border-r border-b border-zinc-700/80 -mt-[4px]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 mt-3">
        {step.title}
      </h3>
      <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-sm max-w-xs">
        {step.description}
      </p>
    </motion.div>
  );
}

/* ── Main export ────────────────────────────────────────── */
export function HowItWorksSection() {
  const t = useT();

  const translatedSteps: StepDef[] = [
    {
      ...steps[0],
      title: t("landing.howItWorks.step1Title"),
      description: t("landing.howItWorks.step1Desc"),
      hoverHint: t("landing.howItWorks.hoverHint"),
      tapHint: t("landing.howItWorks.tapHint"),
    },
    {
      ...steps[1],
      title: t("landing.howItWorks.step2Title"),
      description: t("landing.howItWorks.step2Desc"),
      hoverHint: t("landing.howItWorks.hoverHint"),
      tapHint: t("landing.howItWorks.tapHint"),
    },
    {
      ...steps[2],
      title: t("landing.howItWorks.step3Title"),
      description: t("landing.howItWorks.step3Desc"),
      hoverHint: t("landing.howItWorks.hoverHint"),
      tapHint: t("landing.howItWorks.tapHint"),
    },
  ];

  return (    <section className="py-14 sm:py-20 lg:py-28 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16 lg:mb-20"
        >
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            {t("landing.howItWorks.title")}
          </h2>
          <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400">
            {t("landing.howItWorks.subtitle")}
          </p>
        </motion.div>

        <div className="relative grid grid-cols-1 gap-8 sm:gap-10 md:gap-12 md:grid-cols-3">

          {/* Animated connecting line (desktop only) */}
          <div className="hidden md:block absolute top-8 left-[calc(16.666%+1rem)] right-[calc(16.666%+1rem)] h-0.5">
            <div className="relative w-full h-full bg-zinc-200 dark:bg-zinc-700 rounded-full">
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeInOut", delay: 0.5 }}
                style={{ originX: 0 }}
                className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"
              />
            </div>
          </div>

          {translatedSteps.map((step, idx) => (
            <StepCard key={step.step} step={step} idx={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
