"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEnglishTTS } from "@/hooks/use-english-tts";
import { useSttRecorder } from "@/hooks/use-stt-recorder";
import { MicWaveform } from "@/components/exam/mic-waveform";
import {
  ACCENTS, DIFFICULTY_META, getAccent, scorePronunciation,
  type AccentId, type PronDifficulty, type PronunciationScore,
} from "@/lib/pronunciation";
import {
  Mic, ArrowLeft, ArrowRight, Volume2, Square, Loader2, Sparkles, Check,
  PenLine, Wand2, RotateCcw, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "setup" | "practice";
type Mode = "manual" | "generate";
const DIFFS: PronDifficulty[] = ["easy", "normal", "advanced"];
const MAX_TEXT = 5000;

export function PronunciationClient() {
  const [step, setStep] = useState<Step>("setup");
  const [accent, setAccent] = useState<AccentId | "">("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [difficulty, setDifficulty] = useState<PronDifficulty>("normal");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Practice state
  const [transcript, setTranscript] = useState<string | null>(null);
  const [result, setResult] = useState<PronunciationScore | null>(null);
  const [tips, setTips] = useState<string[] | null>(null);
  const [loadingTips, setLoadingTips] = useState(false);

  const accentCfg = getAccent(accent || undefined);
  const { speak, stop, isPlaying } = useEnglishTTS((m) => setError(m));
  const { start, stop: stopRec, isRecording, isTranscribing, stream } = useSttRecorder({
    onTranscript: (t) => {
      setTranscript(t);
      setResult(scorePronunciation(text, t));
    },
    onError: (m) => setError(m),
  });

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/pronunciation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accent, difficulty, topic: topic.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      setText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const startPractice = () => {
    if (!text.trim()) { setError("Add or generate a text first."); return; }
    setError(null);
    setTranscript(null);
    setResult(null);
    setTips(null);
    setStep("practice");
  };

  const reset = () => {
    stop();
    setTranscript(null);
    setResult(null);
    setTips(null);
    setError(null);
  };

  const getTips = async () => {
    if (!transcript || !result) return;
    setLoadingTips(true);
    setError(null);
    try {
      const missedWords = result.words.filter((w) => !w.ok).map((w) => w.text);
      const res = await fetch("/api/pronunciation/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accent, target: text, transcript, missedWords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get tips");
      setTips(data.tips);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get tips");
    } finally {
      setLoadingTips(false);
    }
  };

  // ───────────────────────── SETUP ─────────────────────────
  if (step === "setup") {
    return (
      <div className="paper-bg min-h-[calc(100dvh-4rem)]">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />
          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
            <Link href="/practice" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-4">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to practice
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
                <Mic className="h-5 w-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Pronunciation
              </h1>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Pick an accent, choose a text, then read it aloud and get instant feedback.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* 1 — Accent */}
          <section className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-1">1 · Choose an accent</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">The model voice and the feedback adapt to it.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setAccent(a.id); setError(null); }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 p-4 transition-all text-left",
                    accent === a.id
                      ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/30 ring-2 ring-sky-500/20"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                  )}
                >
                  <span className="text-2xl">{a.flag}</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{a.label}</span>
                  {accent === a.id && <Check className="h-4 w-4 ml-auto text-sky-600" />}
                </button>
              ))}
            </div>
          </section>

          {/* 2 — Text source */}
          {accent && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6"
            >
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-1">2 · Choose your text</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Write your own, or let the AI generate one.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => { setMode("manual"); setText(""); }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 p-4 transition-all text-left",
                    mode === "manual"
                      ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/30"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                  )}
                >
                  <PenLine className="h-5 w-5 text-sky-600 dark:text-sky-300 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Write my own</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Paste any text to read.</p>
                  </div>
                </button>
                <button
                  onClick={() => { setMode("generate"); setText(""); }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 p-4 transition-all text-left",
                    mode === "generate"
                      ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/30"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                  )}
                >
                  <Wand2 className="h-5 w-5 text-sky-600 dark:text-sky-300 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Generate a text</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">AI writes one for you.</p>
                  </div>
                </button>
              </div>

              {mode === "manual" && (
                <div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
                    rows={8}
                    placeholder="Paste or type the text you want to read aloud…"
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className={cn(
                    "mt-1 text-[11px] tabular-nums text-right",
                    text.length >= MAX_TEXT ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400",
                  )}>
                    {text.length}/{MAX_TEXT}{text.length >= MAX_TEXT ? " — max length reached" : ""}
                  </p>
                </div>
              )}

              {mode === "generate" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2 block">Difficulty</label>
                    <div className="grid grid-cols-3 gap-2">
                      {DIFFS.map((d) => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={cn(
                            "rounded-xl border-2 py-3 text-sm font-semibold transition-all",
                            difficulty === d
                              ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                          )}
                        >
                          {DIFFICULTY_META[d].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2 block">Theme (optional)</label>
                    <input
                      value={topic}
                      onChange={(e) => setTopic(e.target.value.slice(0, 120))}
                      placeholder="e.g. travelling, technology, cooking…"
                      className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <Button onClick={generate} disabled={generating} variant="outline" className="gap-2">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generating ? "Generating…" : text ? "Regenerate" : "Generate text"}
                  </Button>
                  {text && (
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                      {text}
                    </div>
                  )}
                </div>
              )}

              {text.trim() && (
                <div className="mt-5 flex justify-end">
                  <Button onClick={startPractice} className="gap-2 bg-sky-600 hover:bg-sky-700">
                    Start practice <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </motion.section>
          )}
        </div>
      </div>
    );
  }

  // ───────────────────────── PRACTICE ─────────────────────────
  const scoreColor = result
    ? result.score >= 85 ? "text-emerald-600 dark:text-emerald-400"
      : result.score >= 60 ? "text-sky-600 dark:text-sky-400"
      : "text-amber-600 dark:text-amber-400"
    : "";

  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { reset(); setStep("setup"); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> New text
          </button>
          <Badge variant="outline" className="gap-1.5">{accentCfg.flag} {accentCfg.label}</Badge>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Passage */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-sky-600 dark:text-sky-300" /> Read this aloud
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (isPlaying ? stop() : speak(text, { voice: accentCfg.voice }))}
              className="gap-1.5"
            >
              <Volume2 className={cn("h-3.5 w-3.5", isPlaying && "animate-pulse")} />
              {isPlaying ? "Stop" : "Listen"}
            </Button>
          </div>

          <p className="text-lg leading-relaxed text-zinc-800 dark:text-zinc-100">
            {result
              ? result.words.map((w, i) => (
                  <span
                    key={i}
                    className={cn(
                      "rounded px-0.5",
                      w.ok
                        ? "text-zinc-800 dark:text-zinc-100"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 underline decoration-wavy decoration-amber-500",
                    )}
                  >
                    {w.text}{" "}
                  </span>
                ))
              : text}
          </p>
        </div>

        {/* Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 text-center"
          >
            <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400">Reading accuracy</p>
            <p className={cn("text-5xl font-display font-semibold tracking-tight mt-1", scoreColor)}>{result.score}%</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {result.matched} of {result.total} words recognised. Highlighted words were unclear to the recogniser.
            </p>
            {!tips && (
              <Button onClick={getTips} disabled={loadingTips} variant="outline" className="mt-4 gap-2">
                {loadingTips ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loadingTips ? "Analysing…" : "Get pronunciation tips"}
              </Button>
            )}
            {tips && (
              <ul className="mt-4 space-y-2 text-left">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-sky-500" /> {tip}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {/* Mic controls */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
          {isRecording && <MicWaveform stream={stream} className="mb-4 h-12 w-full" />}
          <div className="flex items-center justify-center gap-3">
            {result && !isRecording && (
              <Button onClick={reset} variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" /> Try again
              </Button>
            )}
            {isTranscribing ? (
              <Button disabled className="gap-2 bg-sky-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Transcribing…
              </Button>
            ) : isRecording ? (
              <Button onClick={stopRec} className="gap-2 bg-red-600 hover:bg-red-700 animate-pulse">
                <Square className="h-4 w-4" /> Stop & score
              </Button>
            ) : (
              <Button onClick={() => { setError(null); start(); }} className="gap-2 bg-sky-600 hover:bg-sky-700">
                <Mic className="h-4 w-4" /> {result ? "Record again" : "Record your reading"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
