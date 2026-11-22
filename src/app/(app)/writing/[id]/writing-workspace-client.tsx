"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, BookOpen, Camera, ChevronDown, Clock, GraduationCap, ImagePlus,
  Keyboard, Loader2, PenLine, Plus, RotateCcw, Sparkles, Timer, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { useI18n } from "@/components/i18n/language-provider";
import { FeedbackView, TaskCard, BAND_STYLES } from "@/components/writing/feedback-view";
import { SourceTexts } from "@/components/writing/source-texts";
import { PhraseBank } from "@/components/writing/phrase-bank";
import { phraseForInsert } from "@/lib/writing-phrases";
import { MAX_DRAFTS, MIN_SUBMIT_WORDS, bandFromScore, countWords } from "@/lib/writing";
import { cn } from "@/lib/utils";
import type { WritingDraftData, WritingTaskContent, WritingTaskType } from "@/types";

type Mode = "exam" | "learn";
type InputKind = "typed" | "photo";

interface Props {
  practiceId: string;
  levelLabel: string;
  cefr: string;
  taskType: WritingTaskType;
  genre: string;
  topic: string;
  task: WritingTaskContent;
  initialDrafts: WritingDraftData[];
  initialMode: Mode;
}

const MAX_PHOTOS = 3;

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.abs(totalSeconds));
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function WritingWorkspaceClient({
  practiceId, levelLabel, cefr, taskType, genre, topic, task, initialDrafts, initialMode,
}: Props) {
  const { dict, t, locale } = useI18n();
  const w = dict.writing;
  const { show } = useToast();

  const [drafts, setDrafts] = useState(initialDrafts);
  const latest = drafts[drafts.length - 1] ?? null;
  const nextVersion = (latest?.version ?? 0) + 1;
  const canRewrite = drafts.length < MAX_DRAFTS;

  const [phase, setPhase] = useState<"write" | "feedback">(latest ? "feedback" : "write");
  const [viewVersion, setViewVersion] = useState(latest?.version ?? 0);
  const [mode, setMode] = useState<Mode>(initialMode);

  const [text, setText] = useState(latest?.text ?? "");
  const [inputKind, setInputKind] = useState<InputKind>("typed");
  const [source, setSource] = useState<InputKind>("typed");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [illegible, setIllegible] = useState<number | null>(null);

  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [typingStart, setTypingStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [asideTab, setAsideTab] = useState<"task" | "bank">("task");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const storageKey = `ise-writing-${practiceId}-v${nextVersion}`;

  // Restore an unsent draft for this version (autosaved below).
  useEffect(() => {
    if (phase !== "write") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setText(stored);
    } catch {
      /* storage unavailable */
    }
  }, [phase, storageKey]);

  // Autosave while writing.
  useEffect(() => {
    if (phase !== "write") return;
    const id = setTimeout(() => {
      try {
        if (text.trim() && text !== latest?.text) window.localStorage.setItem(storageKey, text);
      } catch {
        /* storage unavailable */
      }
    }, 600);
    return () => clearTimeout(id);
  }, [text, phase, storageKey, latest?.text]);

  // Clock tick for the exam timer.
  useEffect(() => {
    if (timerStart === null || phase !== "write") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timerStart, phase]);

  const words = countWords(text);
  const { min, max } = task.wordLimit;
  const remaining = timerStart === null ? task.minutes * 60 : task.minutes * 60 - Math.floor((Math.max(now, timerStart) - timerStart) / 1000);

  const startTimer = () => {
    const ts = Date.now();
    setTimerStart(ts);
    setNow(ts);
  };

  const onType = (value: string) => {
    setText(value);
    if (typingStart === null) setTypingStart(Date.now());
    if (mode === "exam" && timerStart === null) startTimer();
  };

  const insertPhrase = (phrase: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const spacer = before && !/\s$/.test(before) ? " " : "";
    const inserted = spacer + phraseForInsert(phrase);
    const next = before + inserted + text.slice(end);
    onType(next);
    // Select the "…" placeholder so typing replaces it.
    const dots = inserted.indexOf("…");
    const selStart = start + (dots >= 0 ? dots : inserted.length);
    const selEnd = dots >= 0 ? selStart + 1 : selStart;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(selStart, selEnd);
    });
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const added = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_PHOTOS - photos.length)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...added]);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const transcribe = async () => {
    if (photos.length === 0 || transcribing) return;
    setTranscribing(true);
    setError(null);
    try {
      const fd = new FormData();
      photos.forEach((p) => fd.append("files", p.file));
      const res = await fetch(`/api/writing/${practiceId}/transcribe`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setText(data.text);
      setSource("photo");
      setIllegible(data.illegible ?? 0);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : w.transcribeError);
    } finally {
      setTranscribing(false);
    }
  };

  const submit = async () => {
    if (submitting || words < MIN_SUBMIT_WORDS) return;
    setSubmitting(true);
    setError(null);
    // Handwritten texts are only timed with the exam timer; typing time says nothing about them.
    const started = timerStart ?? (source === "typed" ? typingStart : null);
    try {
      const res = await fetch(`/api/writing/${practiceId}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          source,
          secondsUsed: started ? Math.round((Date.now() - started) / 1000) : undefined,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* storage unavailable */
      }
      setDrafts((prev) => [...prev, data.draft]);
      setViewVersion(data.draft.version);
      setPhase("feedback");
      setTimerStart(null);
      setTypingStart(null);
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotos([]);
      setIllegible(null);
      if (data.award?.xpGained) show(t("writing.xpEarned", { n: data.award.xpGained }), "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : w.markError);
    } finally {
      setSubmitting(false);
    }
  };

  const startRewrite = () => {
    if (!latest || !canRewrite) return;
    setText(latest.text);
    setSource(latest.source);
    setInputKind("typed");
    setPhase("write");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const viewed = drafts.find((d) => d.version === viewVersion) ?? latest;
  const previousOfViewed = viewed ? drafts.find((d) => d.version === viewed.version - 1) ?? null : null;
  const taskLabel = taskType === "READING_INTO_WRITING" ? "Task 3" : "Task 4";

  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 min-w-0">
            <Link href="/writing">
              <Button variant="ghost" size="sm" className="gap-1 text-zinc-500 -ml-2">
                <ArrowLeft className="h-4 w-4" /> {w.backToLab}
              </Button>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-600 text-white">{levelLabel}</Badge>
              <Badge variant="outline">{taskLabel}</Badge>
              <Badge variant="outline">{topic}</Badge>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 first-letter:uppercase">
              {genre} <span className="text-zinc-400 font-normal">·</span> <span className="marker-underline italic">{task.title}</span>
            </h1>
          </div>

          {phase === "write" ? (
            <div className="inline-flex shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
              {(["exam", "learn"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    mode === m ? "bg-blue-600 text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  )}
                >
                  {m === "exam" ? <Timer className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                  {m === "exam" ? w.modeExam : w.modeLearn}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 shrink-0">
              {canRewrite && (
                <Button onClick={startRewrite} className="gap-1.5">
                  <RotateCcw className="h-4 w-4" /> {t("writing.rewrite", { n: nextVersion })}
                </Button>
              )}
              <Link href="/writing">
                <Button variant="outline" className="gap-1.5"><Plus className="h-4 w-4" /> {w.newTask}</Button>
              </Link>
            </div>
          )}
        </div>

        {phase === "feedback" && viewed ? (
          <div className="space-y-5">
            {drafts.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {drafts.map((d) => {
                  const band = bandFromScore(d.score);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setViewVersion(d.version)}
                      aria-pressed={d.version === viewed.version}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm transition-colors",
                        d.version === viewed.version
                          ? "border-blue-500 bg-white dark:bg-zinc-900"
                          : "border-transparent bg-white/60 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700",
                      )}
                    >
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("writing.version", { n: d.version })}</span>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums", BAND_STYLES[band])}>{d.score.toFixed(1)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <FeedbackView draft={viewed} previous={previousOfViewed} taskType={taskType} task={task} cefr={cefr} />

            <div className="rounded-2xl border border-dashed border-blue-300 dark:border-blue-800 bg-white/70 dark:bg-zinc-900/70 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <PenLine className="h-6 w-6 shrink-0 text-blue-600" />
              <p className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                {canRewrite ? w.rewriteHint : t("writing.maxDrafts", { n: MAX_DRAFTS })}
              </p>
              {canRewrite ? (
                <Button onClick={startRewrite} className="gap-1.5 shrink-0">
                  <RotateCcw className="h-4 w-4" /> {t("writing.rewrite", { n: nextVersion })}
                </Button>
              ) : (
                <Link href="/writing"><Button variant="outline" className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> {w.newTask}</Button></Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            {/* Task side */}
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
              {mode === "learn" && (
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
                  {(["task", "bank"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setAsideTab(tab)}
                      aria-pressed={asideTab === tab}
                      className={cn(
                        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                        asideTab === tab ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                      )}
                    >
                      {tab === "task" ? <BookOpen className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      {tab === "task" ? w.taskHeading : w.phraseBank}
                    </button>
                  ))}
                </div>
              )}

              {mode === "learn" && asideTab === "bank" ? (
                <div className="rounded-2xl border border-blue-200/70 dark:border-blue-900/60 bg-white dark:bg-zinc-900 p-4">
                  <PhraseBank
                    genre={genre}
                    taskType={taskType}
                    strings={{ phraseBank: w.phraseBank, structure: w.structure, register: w.register }}
                    onInsert={inputKind === "typed" || source === "photo" ? insertPhrase : undefined}
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{w.taskHeading}</p>
                    <TaskCard task={task} />
                  </div>

                  {task.sources && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setSourcesOpen((o) => !o)}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          <BookOpen className="h-3.5 w-3.5" /> {w.sourcesTitle}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          {sourcesOpen ? w.hideSources : w.showSources}
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", sourcesOpen && "rotate-180")} />
                        </span>
                      </button>
                      {sourcesOpen && (
                        <>
                          <p className="text-xs text-zinc-500">{w.sourcesHint}</p>
                          <SourceTexts sources={task.sources} />
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </aside>

            {/* Editor side */}
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
              {submitting ? (
                <div className="flex min-h-[28rem] flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="relative">
                    <PenLine className="h-10 w-10 text-blue-500 animate-pulse" />
                    <Loader2 className="absolute -right-3 -bottom-2 h-5 w-5 animate-spin text-blue-600" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{w.marking}</p>
                    <p className="text-sm text-zinc-500">{w.markingHint}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
                    <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5">
                      {(["typed", "photo"] as InputKind[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setInputKind(k)}
                          aria-pressed={inputKind === k}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            inputKind === k ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500",
                          )}
                        >
                          {k === "typed" ? <Keyboard className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                          {k === "typed" ? w.inputTyped : w.inputHandwritten}
                        </button>
                      ))}
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                          words < min
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : words > max
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                              : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
                        )}
                      >
                        {t("writing.wordCount", { n: words })}
                        <span className="font-normal opacity-80">
                          {" · "}
                          {words < min
                            ? t("writing.underLimit", { n: min - words })
                            : words > max
                              ? t("writing.overLimit", { n: words - max })
                              : `${min}–${max}`}
                        </span>
                      </span>
                      {mode === "exam" && (
                        timerStart === null ? (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={startTimer}>
                            <Clock className="h-3.5 w-3.5" /> {w.timerStart} · {task.minutes}:00
                          </Button>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                              remaining <= 0
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                : remaining <= 300
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                            )}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            {remaining <= 0 ? `${w.timeUp} +${formatClock(remaining)}` : formatClock(remaining)}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Photo upload */}
                  {inputKind === "photo" && source !== "photo" && (
                    <div className="space-y-4 p-4 sm:p-6">
                      <div>
                        <p className="font-display font-semibold text-zinc-900 dark:text-zinc-100">{w.photoTitle}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{w.photoHint}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {photos.map((p, i) => (
                          <div key={p.url} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={`${i + 1}`} className="h-full w-full object-cover" />
                            <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 text-xs font-semibold text-white">{i + 1}</span>
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              aria-label={w.removePhoto}
                              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {photos.length < MAX_PHOTOS && (
                          <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                            <ImagePlus className="h-6 w-6" />
                            <span className="text-xs font-medium">{w.addPhotos}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                              multiple
                              className="sr-only"
                              onChange={(e) => {
                                addPhotos(e.target.files);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                      <Button onClick={transcribe} disabled={photos.length === 0 || transcribing} className="w-full gap-2">
                        {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        {transcribing ? w.transcribing : w.transcribe}
                      </Button>
                    </div>
                  )}

                  {/* Text editor (typed, or reviewing a transcription) */}
                  {(inputKind === "typed" || source === "photo") && (
                    <div className="p-4 sm:p-6 space-y-3">
                      {source === "photo" && illegible !== null && (
                        <div className="space-y-2">
                          <p className="flex gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs leading-relaxed text-blue-900 dark:text-blue-200">
                            <Camera className="h-4 w-4 shrink-0" /> {w.transcriptionReady}
                          </p>
                          {illegible > 0 && (
                            <p className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                              <AlertTriangle className="h-4 w-4 shrink-0" /> {t("writing.illegibleWarning", { n: illegible })}
                            </p>
                          )}
                        </div>
                      )}
                      <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => onType(e.target.value)}
                        placeholder={w.editorPlaceholder}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="sentences"
                        rows={18}
                        className="w-full resize-y rounded-xl border border-zinc-200 dark:border-zinc-800 bg-[var(--paper)] dark:bg-zinc-950 px-4 py-3 font-serif text-[15px] sm:text-base leading-8 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                      />
                    </div>
                  )}

                  {/* Submit */}
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 sm:px-6 py-4 space-y-2">
                    {error && (
                      <div className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                        {error}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <p className="flex-1 text-xs text-zinc-500">
                        {words < MIN_SUBMIT_WORDS ? t("writing.minWords", { n: MIN_SUBMIT_WORDS }) : ""}
                      </p>
                      {latest && (
                        <Button variant="ghost" onClick={() => setPhase("feedback")}>{dict.common.cancel}</Button>
                      )}
                      <Button
                        size="lg"
                        onClick={submit}
                        disabled={words < MIN_SUBMIT_WORDS || (inputKind === "photo" && source !== "photo")}
                        className="gap-2"
                      >
                        <PenLine className="h-4 w-4" />
                        {latest ? t("writing.submitRewrite", { n: nextVersion }) : w.submit}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
