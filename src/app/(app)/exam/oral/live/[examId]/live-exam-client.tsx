"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Headphones, Loader2, Mic, MicOff, PhoneOff, Radio, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { MicWaveform } from "@/components/exam/mic-waveform";
import { ExaminerOrb, type OrbState } from "@/components/exam/live/examiner-orb";
import { LiveTranscript } from "@/components/exam/live/live-transcript";
import { CoachHud } from "@/components/exam/live/coach-hud";
import { useLiveSession, type LivePlanItem } from "@/hooks/use-live-session";
import { computeLiveMetrics } from "@/lib/live-metrics";
import { cn } from "@/lib/utils";

interface Props {
  examId: string;
  levelLabel: string;
  plan: LivePlanItem[];
  persona: { name: string; accent: string; flag: string };
  /** ready = can start; saved = transcript stored but not yet marked; expired = too old to connect. */
  initialState: "ready" | "saved" | "expired";
}

function fmt(sec: number) {
  const s = Math.max(0, Math.abs(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveExamClient({ examId, levelLabel, plan, persona, initialState }: Props) {
  const { dict, t } = useI18n();
  const l = dict.live;
  const router = useRouter();
  const goToResults = () => router.push(`/results/${examId}?type=oral`);
  const live = useLiveSession({ examId, plan, onEvaluated: goToResults });
  const [markingSaved, setMarkingSaved] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const metrics = useMemo(
    () => computeLiveMetrics(live.turns, live.task, live.taskElapsed),
    [live.turns, live.task, live.taskElapsed],
  );
  const initials = persona.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2);
  const current = plan[live.taskIndex];
  const remaining = current ? current.minutes * 60 - live.taskElapsed : 0;
  const started = !["idle", "connecting"].includes(live.status) || live.turns.length > 0;
  const busy = live.status === "ending" || live.status === "saving" || live.status === "evaluating";

  const orbState: OrbState =
    live.status === "idle" || live.status === "error"
      ? "idle"
      : live.status === "connecting" || live.status === "reconnecting"
        ? "connecting"
        : live.examinerSpeaking
          ? "speaking"
          : "listening";

  const statusText =
    live.status === "connecting"
      ? l.connecting
      : live.status === "reconnecting"
        ? l.reconnecting
        : live.examinerSpeaking
          ? l.statusSpeaking
          : l.statusThinking;

  // A previous run saved the transcript but marking failed: mark it directly.
  const markSaved = async () => {
    setMarkingSaved(true);
    setSavedError(null);
    const res = await fetch("/api/exam/oral/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId }),
    }).catch(() => null);
    if (res?.ok) return goToResults();
    setMarkingSaved(false);
    setSavedError(l.errorSave);
  };

  const errorText = live.error
    ? { mic: l.errorMic, connect: l.errorConnect, dropped: l.errorDropped, save: l.errorSave, expired: l.errorExpired }[live.error.kind]
    : null;

  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
              <Radio className="h-3.5 w-3.5" />
              {l.badge}
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {l.title} <span className="marker-underline italic">{l.titleAccent}</span>
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {levelLabel} · {persona.flag} {persona.name}
              {live.model && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 dark:bg-zinc-800">{t("live.model", { model: live.model })}</span>}
            </p>
          </div>

          {/* Task stepper */}
          <ol className="flex flex-wrap items-center gap-2" aria-label={l.planTitle}>
            {plan.map((p, i) => {
              const done = started && i < live.taskIndex;
              const active = started && i === live.taskIndex;
              return (
                <li
                  key={p.task}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active && "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100",
                    done && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
                    !active && !done && "border-zinc-200 bg-white/70 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60",
                  )}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
                  {l.task[p.task]}
                  {active ? (
                    <span className={cn("tabular-nums", remaining < 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-500")}>
                      {remaining < 0 ? l.overtime : t("live.timeLeft", { t: fmt(remaining) })}
                    </span>
                  ) : (
                    <span className="text-zinc-400">{t("live.minutes", { n: p.minutes })}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6 min-w-0">
            {/* Stage */}
            <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 p-6 sm:p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
              {initialState === "saved" ? (
                <div className="py-10 text-center space-y-4">
                  <p className="text-zinc-600 dark:text-zinc-300">{l.errorSave}</p>
                  <Button onClick={markSaved} disabled={markingSaved} className="gap-2">
                    {markingSaved ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    {l.markSoFar}
                  </Button>
                  {savedError && <p className="text-sm text-rose-600">{savedError}</p>}
                </div>
              ) : initialState === "expired" ? (
                <div className="py-10 text-center space-y-4">
                  <p className="text-zinc-600 dark:text-zinc-300">{l.errorExpired}</p>
                  <Button asChild><Link href="/exam/oral/setup">{l.newSession}</Link></Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-5">
                  <ExaminerOrb outAnalyser={live.outAnalyser} micAnalyser={live.micAnalyser} state={orbState} initials={initials} />
                  <div className="text-center">
                    <p className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">{persona.name}</p>
                    <p className="text-sm text-zinc-500">{persona.flag} {persona.accent}</p>
                  </div>

                  {live.status === "idle" ? (
                    <div className="w-full max-w-md space-y-4">
                      <div className="rounded-2xl bg-zinc-50 p-4 text-sm ring-1 ring-zinc-200 dark:bg-zinc-800/50 dark:ring-zinc-700">
                        <p className="mb-2 font-semibold text-zinc-800 dark:text-zinc-100">{l.checklistTitle}</p>
                        <ul className="space-y-2 text-zinc-600 dark:text-zinc-300">
                          <li className="flex gap-2"><Headphones className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />{l.checkHeadphones}</li>
                          <li className="flex gap-2"><Mic className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />{l.checkQuiet}</li>
                          <li className="flex gap-2"><Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />{l.checkTalk}</li>
                        </ul>
                      </div>
                      <Button size="lg" onClick={live.start} className="w-full gap-2 bg-rose-600 text-white hover:bg-rose-700">
                        <Radio className="h-4 w-4" />
                        {l.start}
                      </Button>
                    </div>
                  ) : live.status === "error" ? (
                    <div className="w-full max-w-md space-y-3 text-center">
                      <p className="flex items-center justify-center gap-2 text-sm text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="h-4 w-4" />
                        {errorText}
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {live.error?.kind === "save" || (live.error?.kind === "dropped" && live.turns.some((x) => x.role === "CANDIDATE")) ? (
                          <Button onClick={live.retrySave} className="gap-2"><RotateCcw className="h-4 w-4" />{live.error?.kind === "save" ? l.retry : l.markSoFar}</Button>
                        ) : live.error?.kind === "expired" ? (
                          <Button asChild><Link href="/exam/oral/setup">{l.newSession}</Link></Button>
                        ) : (
                          <Button onClick={live.start} className="gap-2"><RotateCcw className="h-4 w-4" />{l.retry}</Button>
                        )}
                        <Button asChild variant="outline"><Link href="/exam/oral/setup">{l.classic}</Link></Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={cn("flex items-center gap-2 text-sm font-medium", live.examinerSpeaking ? "text-brand" : "text-rose-700 dark:text-rose-300")}>
                        <span className={cn("h-2 w-2 rounded-full", live.examinerSpeaking ? "bg-brand animate-pulse" : "bg-rose-500")} />
                        {statusText}
                      </p>
                      <MicWaveform stream={live.muted ? null : live.micStream} className="h-10 w-full max-w-sm" />
                      <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={live.toggleMute} disabled={busy} className="gap-2">
                          {live.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          {live.muted ? l.unmute : l.mute}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy || live.status === "connecting"}
                          onClick={() => window.confirm(l.endConfirm) && live.endNow()}
                          className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                        >
                          <PhoneOff className="h-4 w-4" />
                          {l.end}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Ending / marking overlay */}
              <AnimatePresence>
                {busy && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80"
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
                      <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {live.status === "ending" ? l.ending : live.status === "saving" ? l.saving : l.evaluating}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Transcript */}
            <section className="rounded-3xl border border-zinc-200 bg-white/85 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
              <h2 className="mb-3 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{l.transcript}</h2>
              <LiveTranscript
                turns={live.turns}
                examinerName={persona.name.split(" ")[0]}
                youLabel={l.you}
                emptyLabel={l.transcriptEmpty}
                taskLabel={(task) => l.task[task as keyof typeof l.task] ?? task}
                streaming={live.status === "live"}
                className="h-[320px] sm:h-[380px]"
              />
            </section>
          </div>

          {/* Coach */}
          <aside className="lg:sticky lg:top-20 h-fit rounded-3xl border border-zinc-200 bg-white/85 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{l.coachTitle}</h2>
            <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{l.coachSubtitle}</p>
            <CoachHud metrics={metrics} emphasiseQuestions={live.task === "COLLABORATIVE"} />
          </aside>
        </div>
      </div>
    </div>
  );
}
