"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Mic, Star } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      setVal(Math.round((to * i) / 50));
      if (i >= 50) clearInterval(t);
    }, 25);
    return () => clearInterval(t);
  }, [to]);
  return <>{val}{suffix}</>;
}

type Phase = "loading" | "exam" | "feedback";

function LoadingPhase() {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-6 space-y-4 min-h-[260px]"
    >
      <div className="flex items-center gap-3 mb-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent flex-shrink-0"
        />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Generating your ISE II exam...</span>
      </div>
      {[80, 55, 90, 45, 70].map((w, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
          className="h-3 rounded-full bg-zinc-200 dark:bg-zinc-700"
          style={{ width: `${w}%` }}
        />
      ))}
    </motion.div>
  );
}

function ExamPhase() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4 }}
      className="p-5 space-y-4 min-h-[260px]"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">ISE II</span>
        <span className="text-xs text-zinc-400">Reading Task 1 — Q11</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">The Future of Remote Work</p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Remote work has fundamentally transformed modern employment. Studies show that productivity increased by an average of 13% for remote employees...
        </p>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Q11. Fill in the gap from the passage:</p>
        <p className="text-[11px] text-zinc-500 italic">&ldquo;Productivity increased by _______ for remote employees.&rdquo;</p>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-2 px-3 py-2 rounded-md border border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-700"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span className="text-xs text-green-700 dark:text-green-300 font-medium">an average of 13%</span>
        </motion.div>
      </div>
      <div className="flex justify-between text-[10px] text-zinc-400">
        <span>Q11 of 30</span>
        <span>37% complete</span>
      </div>
    </motion.div>
  );
}

function FeedbackPhase() {
  const scores = [
    { label: "Grammar", score: 8 },
    { label: "Vocabulary", score: 9 },
    { label: "Task Fulfillment", score: 8 },
    { label: "Organisation", score: 7 },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4 }}
      className="p-5 space-y-3 min-h-[260px]"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">Extended Writing — AI Feedback</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Overall Score</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-blue-600">8.0</span>
          <span className="text-sm text-zinc-400">/10</span>
        </div>
      </div>
      <div className="space-y-2">
        {scores.map((s, i) => (
          <div key={s.label}>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-zinc-500 dark:text-zinc-400">{s.label}</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">{s.score}/10</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${s.score * 10}%` }}
                transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
              />
            </div>
          </div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 p-3"
      >
        <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed italic">
          &ldquo;Strong vocabulary range and well-structured arguments. Minor tense inconsistencies in paragraph 2 — review present perfect usage.&rdquo;
        </p>
      </motion.div>
    </motion.div>
  );
}

function DemoWindow() {
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    let cancelled = false;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;

    function runCycle() {
      if (cancelled) return;
      setPhase("loading");
      t1 = setTimeout(() => { if (!cancelled) setPhase("exam"); }, 1500);
      t2 = setTimeout(() => { if (!cancelled) setPhase("feedback"); }, 5500);
      t3 = setTimeout(() => { if (!cancelled) runCycle(); }, 11000);
    }

    runCycle();
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-2xl shadow-blue-100/40 dark:shadow-blue-900/20 bg-white dark:bg-zinc-900">
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 h-5 max-w-[200px] rounded bg-zinc-200 dark:bg-zinc-700 flex items-center px-2">
          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">isesimulator.com/exam/written</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[9px] text-green-500 font-medium"
          >
            ● Live
          </motion.span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "loading" && <LoadingPhase key="loading" />}
        {phase === "exam" && <ExamPhase key="exam" />}
        {phase === "feedback" && <FeedbackPhase key="feedback" />}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
        <div className="flex gap-1">
          {(["loading", "exam", "feedback"] as Phase[]).map((p) => (
            <div
              key={p}
              className={`h-1.5 rounded-full transition-all duration-500 ${phase === p ? "w-6 bg-blue-500" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"}`}
            />
          ))}
        </div>
        <span className="text-[10px] text-zinc-400">
          {phase === "loading" ? "Generating..." : phase === "exam" ? "Answering..." : "Results ready"}
        </span>
      </div>
    </div>
  );
}

export function HeroSection() {
  const t = useT();
  return (
    <section className="relative overflow-hidden min-h-[calc(100dvh-4rem)] sm:min-h-screen flex items-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/20 dark:from-zinc-950 dark:via-blue-950/20 dark:to-purple-950/10">

      {/* Animated background orbs — scaled down on mobile */}
      <motion.div
        animate={{ y: [0, -40, 0], x: [0, 20, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-16 right-[5%] h-[250px] w-[250px] sm:h-[500px] sm:w-[500px] rounded-full bg-blue-200/30 dark:bg-blue-800/15 blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ y: [0, 30, 0], x: [0, -15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute bottom-0 left-[5%] h-[200px] w-[200px] sm:h-[400px] sm:w-[400px] rounded-full bg-purple-200/30 dark:bg-purple-800/15 blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] sm:h-[600px] sm:w-[600px] rounded-full bg-indigo-100/20 dark:bg-indigo-900/10 blur-3xl pointer-events-none"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* LEFT — Text + CTA */}
          <div className="space-y-8">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-4 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 shadow-sm">
                <motion.span
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0"
                />
                {t("landing.hero.badge")}
              </div>
            </motion.div>

            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl xl:text-6xl leading-[1.1]"
            >
              {t("landing.hero.title")}{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t("landing.hero.titleAccent")}
              </span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-lg"
            >
              {t("landing.hero.subtitle")}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Link href="/sign-up">
                <Button size="lg" className="text-base px-8 gap-2 w-full sm:w-auto shadow-lg shadow-blue-200 dark:shadow-blue-900/50">
                  {t("landing.hero.ctaPrimary")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="text-base px-8 w-full sm:w-auto bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
                  {t("landing.hero.ctaSecondary")}
                </Button>
              </Link>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-4 pt-1"
            >
              <div className="flex -space-x-2">
                {[
                  { bg: "bg-blue-500", letter: "S" },
                  { bg: "bg-purple-500", letter: "M" },
                  { bg: "bg-emerald-500", letter: "A" },
                  { bg: "bg-orange-500", letter: "L" },
                  { bg: "bg-pink-500", letter: "K" },
                ].map(({ bg, letter }, i) => (
                  <div
                    key={i}
                    className={`h-8 w-8 rounded-full border-2 border-white dark:border-zinc-950 ${bg} flex items-center justify-center text-xs text-white font-bold shadow-sm`}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Loved by ISE students worldwide</p>
              </div>
            </motion.div>
          </div>

          {/* RIGHT — Animated product demo */}
          <motion.div
            initial={{ opacity: 0, x: 40, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10"
            >
              <DemoWindow />
            </motion.div>

            {/* Floating badge — bottom left */}
            <motion.div
              initial={{ opacity: 0, x: -20, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="absolute -bottom-5 -left-6 z-20 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-700 px-4 py-3 hidden sm:flex items-center gap-2.5"
            >
              <div className="h-9 w-9 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">Instant results</div>
                <div className="text-xs text-zinc-400 mt-0.5">AI evaluates in seconds</div>
              </div>
            </motion.div>

            {/* Floating badge — top right */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 1.3, duration: 0.5 }}
              className="absolute -top-5 -right-6 z-20 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-700 px-4 py-3 hidden sm:flex items-center gap-2.5"
            >
              <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">Real voice exams</div>
                <div className="text-xs text-zinc-400 mt-0.5">Speak to the AI examiner</div>
              </div>
            </motion.div>

            {/* Glow behind demo */}
            <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-blue-400/20 to-purple-400/20 dark:from-blue-600/10 dark:to-purple-600/10 blur-2xl scale-110" />
          </motion.div>
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 sm:mt-16 lg:mt-24 grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-200 dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-sm"
        >
          {[
            { to: 5, suffix: "", label: "ISE Levels", sub: "Foundation to ISE IV" },
            { to: 4, suffix: "", label: "Practice Modules", sub: "Written · Oral · Listening · Practice" },
            { to: 100, suffix: "%", label: "AI Content", sub: "Unique every session" },
            { to: 30, suffix: "s", label: "Feedback Time", sub: "Instant AI evaluation" },
          ].map((item, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 px-3 sm:px-6 py-4 sm:py-6 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                <CountUp to={item.to} suffix={item.suffix} />
              </div>
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-1">{item.label}</div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{item.sub}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
