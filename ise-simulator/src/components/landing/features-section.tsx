"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PenTool, Mic, Volume2, BookMarked, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

type TabId = "written" | "oral" | "listening" | "vocabulary" | "grammar";

const TAB_STATIC = [
  {
    id: "written" as TabId,
    icon: PenTool,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900",
  },
  {
    id: "oral" as TabId,
    icon: Mic,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900",
  },
  {
    id: "listening" as TabId,
    icon: Volume2,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-100 dark:bg-cyan-900",
  },
  {
    id: "vocabulary" as TabId,
    icon: BookMarked,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900",
  },
  {
    id: "grammar" as TabId,
    icon: BookOpen,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900",
  },
];

// ——— Tab previews ———

function WrittenPreview() {
  return (
    <motion.div
      key="written"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35 }}
      className="h-full flex flex-col"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">ISE III</span>
        <span className="text-xs text-zinc-400">Reading Task 2 · Q16–20</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {["Blog A", "Article B", "Forum C", "Report D"].map((t, i) => (
          <div key={i} className="rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2.5">
            <div className="text-[10px] font-semibold text-zinc-500 mb-1">{t}</div>
            <div className="space-y-1">
              {[70, 50, 85].map((w, j) => (
                <div key={j} className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[
          { q: "Q16. Which text mentions environmental impact?", a: "C" },
          { q: "Q17. Who argues that cost is the main barrier?", a: "A" },
          { q: "Q18. Which source uses statistical data?", a: "D" },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
          >
            <span className="text-[11px] text-zinc-600 dark:text-zinc-400">{item.q}</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 ml-2 flex-shrink-0">{item.a}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function OralPreview() {
  return (
    <motion.div
      key="oral"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35 }}
      className="h-full space-y-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">ISE I</span>
        <span className="text-xs text-zinc-400">Topic Task · Conversation</span>
      </div>
      <div className="space-y-3">
        {/* AI message */}
        <div className="flex items-start gap-2">
          <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 text-xs">🤖</div>
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-none px-3.5 py-2.5 max-w-xs">
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              &ldquo;That&apos;s very interesting. Can you tell me more about why you chose this topic?&rdquo;
            </p>
          </div>
        </div>
        {/* User recording */}
        <div className="flex items-start gap-2 flex-row-reverse">
          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 text-xs">👤</div>
          <div className="bg-blue-600 rounded-2xl rounded-tr-none px-3.5 py-2.5 max-w-xs">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="h-2.5 w-2.5 rounded-full bg-red-400 flex-shrink-0"
              />
              <div className="flex items-end gap-0.5 h-7 overflow-hidden">
                {[3, 6, 4, 8, 5, 7, 3, 6, 9, 5, 7, 4].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [`${h * 2}px`, `${h * 3}px`, `${h * 2}px`] }}
                    transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05 }}
                    className="w-0.5 bg-white/70 rounded-full"
                    style={{ height: `${h * 2}px` }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-blue-100 flex-shrink-0">0:12</span>
            </div>
          </div>
        </div>
        {/* AI next */}
        <div className="flex items-start gap-2">
          <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 text-xs">🤖</div>
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-none px-3.5 py-2.5">
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} className="flex gap-1 items-center">
              <div className="h-2 w-2 rounded-full bg-zinc-400" />
              <div className="h-2 w-2 rounded-full bg-zinc-400" />
              <div className="h-2 w-2 rounded-full bg-zinc-400" />
            </motion.div>
          </div>
        </div>
      </div>
      <div className="flex justify-center pt-1">
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950 rounded-full border border-red-200 dark:border-red-800">
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }} className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-red-600 dark:text-red-400 font-medium">Recording — tap to stop</span>
        </div>
      </div>
    </motion.div>
  );
}

function ListeningPreview() {
  return (
    <motion.div
      key="listening"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35 }}
      className="h-full space-y-4"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">ISE II</span>
        <span className="text-xs text-zinc-400">Round 2 — Detailed Notes</span>
      </div>
      {/* Audio player */}
      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">The Impact of Social Media</span>
          <span className="text-[11px] text-zinc-400 font-mono">1:34 / 2:10</span>
        </div>
        <div className="relative h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
          <motion.div
            animate={{ width: ["0%", "73%"] }}
            transition={{ duration: 3, ease: "linear" }}
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-0.5 h-7 overflow-hidden">
            {[2, 4, 6, 3, 7, 5, 8, 4, 6, 3, 5, 7, 4, 6].map((h, i) => (
              <motion.div
                key={i}
                animate={{ height: [`${h * 2}px`, `${h * 3}px`, `${h * 2}px`] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.07 }}
                className="w-0.5 bg-cyan-400 rounded-full"
                style={{ height: `${h * 2}px` }}
              />
            ))}
          </div>
          <span className="text-[10px] text-zinc-400 ml-auto">AI reading aloud...</span>
        </div>
      </div>
      {/* Notes area */}
      <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
        <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">Your notes</p>
        <div className="space-y-1.5">
          {["Social media use up 30% since 2020", "73% of teens use platforms daily", "Mental health concerns — anxiety link"].map((line, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.4 + 0.5 }}
              className="flex items-start gap-1.5">
              <span className="text-cyan-500 flex-shrink-0 text-xs">–</span>
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400">{line}</span>
            </motion.div>
          ))}
          <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
            className="inline-block w-0.5 h-3 bg-zinc-400" />
        </div>
      </div>
    </motion.div>
  );
}

function VocabularyPreview() {
  const [flipped, setFlipped] = useState(false);
  return (
    <motion.div
      key="vocabulary"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35 }}
      className="h-full space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full">C1 Level</span>
          <span className="text-xs text-zinc-400">Card 7 of ∞</span>
        </div>
        <div className="text-xs text-zinc-400">Score: <span className="text-green-500 font-semibold">72</span>/100</div>
      </div>

      {/* Flip card */}
      <div
        className="relative mx-auto cursor-pointer"
        style={{ perspective: 800, height: 160 }}
        onClick={() => setFlipped(!flipped)}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{ transformStyle: "preserve-3d" }}
          className="w-full h-full"
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-2xl border-2 border-pink-200 dark:border-pink-800 bg-gradient-to-br from-pink-50 to-white dark:from-pink-950 dark:to-zinc-900 flex flex-col items-center justify-center p-4"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">substantiate</p>
            <p className="text-xs text-zinc-400 mt-1">verb</p>
            <p className="text-[10px] text-pink-400 mt-4">tap to reveal →</p>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl border-2 border-pink-400 dark:border-pink-600 bg-gradient-to-br from-pink-100 to-pink-50 dark:from-pink-900 dark:to-pink-950 flex flex-col items-center justify-center p-4"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-lg font-bold text-pink-700 dark:text-pink-300">corroborar</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 text-center italic">&ldquo;The evidence substantiates her claim.&rdquo;</p>
          </div>
        </motion.div>
      </div>

      <div className="flex gap-2 justify-center">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium">
          <XCircle className="h-3.5 w-3.5" /> Still learning
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-xs text-green-600 dark:text-green-400 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" /> Know it
        </button>
      </div>
    </motion.div>
  );
}

function GrammarPreview() {
  const [selected, setSelected] = useState<number | null>(null);
  const correct = 2;
  return (
    <motion.div
      key="grammar"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35 }}
      className="h-full space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">B2</span>
          <span className="text-xs text-zinc-400">Multiple Choice · Q4</span>
        </div>
        <span className="text-xs text-zinc-400">3/10 answered</span>
      </div>
      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Choose the correct form:</p>
        <p className="text-xs text-zinc-500 italic">&ldquo;If I ___ more time, I would have studied harder.&rdquo;</p>
        <div className="space-y-2 mt-1">
          {["had", "have had", "had had", "would have"].map((opt, i) => {
            const isSelected = selected === i;
            const showResult = selected !== null;
            const isCorrect = i === correct;
            let cls = "w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all ";
            if (!showResult) {
              cls += isSelected
                ? "border-green-400 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400";
            } else {
              if (isCorrect) cls += "border-green-400 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300";
              else if (isSelected) cls += "border-red-400 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400";
              else cls += "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600";
            }
            return (
              <button key={i} onClick={() => setSelected(i)} disabled={selected !== null} className={cls}>
                <span className="font-mono mr-2">{["A", "B", "C", "D"][i]}.</span>{opt}
              </button>
            );
          })}
        </div>
      </div>
      {selected !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 rounded-lg px-3 py-2 border border-green-200 dark:border-green-800"
        >
          ✓ &ldquo;Had had&rdquo; is the past perfect — required in the third conditional to talk about hypothetical past situations.
        </motion.div>
      )}
    </motion.div>
  );
}

const PREVIEWS: Record<TabId, React.ReactNode> = {
  written: <WrittenPreview />,
  oral: <OralPreview />,
  listening: <ListeningPreview />,
  vocabulary: <VocabularyPreview />,
  grammar: <GrammarPreview />,
};

export function FeaturesSection() {
  const [active, setActive] = useState<TabId>("written");
  const t = useT();

  const TABS = [
    { ...TAB_STATIC[0], label: t("landing.features.writtenLabel"), description: t("landing.features.writtenDesc") },
    { ...TAB_STATIC[1], label: t("landing.features.oralLabel"), description: t("landing.features.oralDesc") },
    { ...TAB_STATIC[2], label: t("landing.features.listeningLabel"), description: t("landing.features.listeningDesc") },
    { ...TAB_STATIC[3], label: t("landing.features.vocabularyLabel"), description: t("landing.features.vocabularyDesc") },
    { ...TAB_STATIC[4], label: t("landing.features.grammarLabel"), description: t("landing.features.grammarDesc") },
  ];

  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <section id="features" className="py-14 sm:py-20 lg:py-28 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-14 lg:mb-16"
        >
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            {t("landing.features.title")}
          </h2>
          <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto">
            {t("landing.features.subtitle")}
          </p>
        </motion.div>

        {/* Interactive showcase */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-8 items-start"
        >
          {/* Left: Tab list */}
          <div className="lg:col-span-2 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={`flex-shrink-0 lg:flex-shrink text-left flex items-start gap-3 rounded-2xl border p-4 transition-all duration-200 cursor-pointer min-w-[180px] lg:min-w-0 ${
                    isActive
                      ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 shadow-sm"
                      : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  }`}
                >
                  <div className={`h-9 w-9 rounded-xl ${tab.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-4.5 w-4.5 ${tab.color}`} style={{ height: 18, width: 18 }} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-none mb-1 ${isActive ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}>
                      {tab.label}
                    </p>
                    {isActive && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed"
                      >
                        {tab.description}
                      </motion.p>
                    )}
                  </div>
                  {isActive && (
                    <motion.div layoutId="activeTab" className={`ml-auto w-1 self-stretch rounded-full ${tab.bg}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Preview panel */}
          <div className="lg:col-span-3">
            <div className={`rounded-2xl border-2 overflow-hidden ${
              active === "written" ? "border-blue-200 dark:border-blue-900" :
              active === "oral" ? "border-purple-200 dark:border-purple-900" :
              active === "listening" ? "border-cyan-200 dark:border-cyan-900" :
              active === "vocabulary" ? "border-pink-200 dark:border-pink-900" :
              "border-green-200 dark:border-green-900"
            }`}>
              {/* Header bar */}
              <div className={`flex items-center gap-2 px-4 py-3 border-b ${
                active === "written" ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900" :
                active === "oral" ? "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-900" :
                active === "listening" ? "bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-900" :
                active === "vocabulary" ? "bg-pink-50 dark:bg-pink-950 border-pink-200 dark:border-pink-900" :
                "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900"
              }`}>
                <div className={`h-8 w-8 rounded-lg ${activeTab.bg} flex items-center justify-center`}>
                  <activeTab.icon className={`h-4 w-4 ${activeTab.color}`} />
                </div>
                <span className={`text-sm font-semibold ${activeTab.color}`}>{activeTab.label}</span>
              </div>

              {/* Preview content */}
              <div className="bg-white dark:bg-zinc-900 p-5 min-h-[340px]">
                <AnimatePresence mode="wait">
                  {PREVIEWS[active]}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
