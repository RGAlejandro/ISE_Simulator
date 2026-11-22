"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BookOpen, CheckCircle2, Circle, GraduationCap, Loader2, NotebookPen, PenTool, Sparkles, Timer, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { BAND_STYLES } from "@/components/writing/feedback-view";
import { bandFromScore, type ErrorTagStat } from "@/lib/writing";
import { cn } from "@/lib/utils";
import type { ExamLevel, WritingTaskType } from "@/types";

export interface LevelOption {
  value: ExamLevel;
  label: string;
  cefr: string;
  genres: Record<WritingTaskType, string[]>;
  topics: string[];
}

export interface PracticeSummary {
  id: string;
  level: ExamLevel;
  taskType: WritingTaskType;
  genre: string;
  topic: string;
  title: string;
  versions: number;
  firstScore: number | null;
  lastScore: number | null;
  updatedAt: string;
}

interface Props {
  isPro: boolean;
  writingToday: number;
  canStart: boolean;
  freeLimit: number;
  levels: LevelOption[];
  defaultLevel: ExamLevel;
  initialType: WritingTaskType | null;
  initialGenre: string | null;
  practices: PracticeSummary[];
  notebook: { texts: number; tags: ErrorTagStat[] };
}

type Mode = "exam" | "learn";

const chip = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
    active
      ? "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-950/50 dark:text-blue-200"
      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600",
  );

export function WritingHubClient({
  isPro, writingToday, canStart, freeLimit, levels, defaultLevel, initialType, initialGenre, practices: initialPractices, notebook,
}: Props) {
  const { dict, t, locale } = useI18n();
  const w = dict.writing;
  const router = useRouter();

  const [level, setLevel] = useState<ExamLevel>(defaultLevel);
  const [taskType, setTaskType] = useState<WritingTaskType>(initialType ?? "EXTENDED_WRITING");
  const levelOpt = levels.find((l) => l.value === level) ?? levels[0];
  const [genre, setGenre] = useState<string>(
    initialGenre && levelOpt.genres[initialType ?? "EXTENDED_WRITING"].includes(initialGenre) ? initialGenre : "random",
  );
  const [topic, setTopic] = useState("random");
  const [mode, setMode] = useState<Mode>("exam");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(!canStart);
  const [practices, setPractices] = useState(initialPractices);

  const genres = levelOpt.genres[taskType];

  const chooseLevel = (l: ExamLevel) => {
    setLevel(l);
    const opt = levels.find((x) => x.value === l)!;
    if (!opt.genres[taskType].includes(genre)) setGenre("random");
    if (!opt.topics.includes(topic)) setTopic("random");
  };

  const chooseType = (tt: WritingTaskType) => {
    setTaskType(tt);
    if (!levelOpt.genres[tt].includes(genre)) setGenre("random");
  };

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, taskType, genre, topic }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setLimitHit(true);
        setStarting(false);
        return;
      }
      if (!res.ok) throw new Error(data.error);
      router.push(`/writing/${data.id}?mode=${mode}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : w.startError);
      setStarting(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(w.deleteConfirm)) return;
    const res = await fetch(`/api/writing/${id}`, { method: "DELETE" });
    if (res.ok) setPractices((prev) => prev.filter((p) => p.id !== id));
  };

  // Genre coverage at the selected level (any task type, submitted texts only).
  const levelGenres = Array.from(new Set([...levelOpt.genres.READING_INTO_WRITING, ...levelOpt.genres.EXTENDED_WRITING]));
  const practisedCount: Record<string, number> = {};
  for (const p of practices) if (p.level === level && p.versions > 0) practisedCount[p.genre] = (practisedCount[p.genre] ?? 0) + 1;
  const coveredGenres = levelGenres.filter((g) => practisedCount[g]).length;
  const maxTag = notebook.tags[0]?.count ?? 1;

  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        <header className="space-y-3 max-w-2xl">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            <PenTool className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Writing <span className="marker-underline italic">Lab</span>
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{w.subtitle}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Setup */}
          <section className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7 shadow-sm">
            {starting ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="relative">
                  <PenTool className="h-10 w-10 text-blue-500 animate-pulse" />
                  <Loader2 className="absolute -right-3 -bottom-2 h-5 w-5 animate-spin text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{w.generating}</p>
                  {taskType === "READING_INTO_WRITING" && <p className="text-sm text-zinc-500">{w.generatingTask3}</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-7">
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">{w.setupTitle}</h2>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{w.levelLabel}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {levels.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => chooseLevel(l.value)}
                        aria-pressed={level === l.value}
                        className={cn(
                          "rounded-xl border-2 py-2.5 flex flex-col items-center gap-0.5 transition-all",
                          level === l.value
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                        )}
                      >
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{l.label.replace("ISE ", "")}</span>
                        <span className="text-[10px] text-zinc-500">{l.cefr}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{w.taskLabel}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["READING_INTO_WRITING", "EXTENDED_WRITING"] as WritingTaskType[]).map((tt) => (
                      <button
                        key={tt}
                        type="button"
                        onClick={() => chooseType(tt)}
                        aria-pressed={taskType === tt}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-colors",
                          taskType === tt
                            ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                        )}
                      >
                        {tt === "READING_INTO_WRITING"
                          ? <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                          : <PenTool className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />}
                        <span>
                          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tt === "READING_INTO_WRITING" ? w.task3 : w.task4}</span>
                          <span className="block text-xs text-zinc-500 mt-0.5">{tt === "READING_INTO_WRITING" ? w.task3Desc : w.task4Desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{w.genreLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {["random", ...genres].map((g) => (
                      <button key={g} type="button" onClick={() => setGenre(g)} aria-pressed={genre === g} className={chip(genre === g)}>
                        {g === "random" ? <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> {w.surpriseMe}</span> : g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{w.topicLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {["random", ...levelOpt.topics].map((tp) => (
                      <button key={tp} type="button" onClick={() => setTopic(tp)} aria-pressed={topic === tp} className={chip(topic === tp)}>
                        {tp === "random" ? <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> {w.surpriseMe}</span> : tp}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{w.modeLabel}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["exam", "learn"] as Mode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        aria-pressed={mode === m}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-colors",
                          mode === m
                            ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                        )}
                      >
                        {m === "exam" ? <Timer className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /> : <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />}
                        <span>
                          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{m === "exam" ? w.modeExam : w.modeLearn}</span>
                          <span className="block text-xs text-zinc-500 mt-0.5">{m === "exam" ? w.modeExamDesc : w.modeLearnDesc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                {limitHit ? (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-4 space-y-3 text-sm text-blue-900 dark:text-blue-200">
                    <p>{w.limitReached}</p>
                    <Link href="/pricing" className="block"><Button className="w-full">{dict.common.upgrade}</Button></Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button onClick={start} size="lg" className="w-full gap-2">
                      {w.start} <ArrowRight className="h-4 w-4" />
                    </Button>
                    {!isPro && (
                      <p className="text-center text-xs text-zinc-500">{t("writing.limitInfo", { used: writingToday, limit: freeLimit })}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Notebook + genres */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  <NotebookPen className="h-5 w-5 text-red-500" /> {w.errorsTitle}
                </h2>
                {notebook.texts > 0 && (
                  <p className="text-xs text-zinc-500">
                    {notebook.texts === 1 ? w.errorsSubtitleOne : t("writing.errorsSubtitle", { n: notebook.texts })}
                  </p>
                )}
              </div>
              {notebook.tags.length === 0 ? (
                <p className="text-sm text-zinc-500">{w.errorsEmpty}</p>
              ) : (
                <ul className="space-y-3">
                  {notebook.tags.map((tag) => (
                    <li key={tag.tag} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{w.tags[tag.tag]}</span>
                        <span className="text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">×{tag.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${(tag.count / maxTag) * 100}%` }} />
                      </div>
                      {tag.examples[0] && (
                        <p className="font-serif text-xs leading-snug text-zinc-500">
                          <span className="line-through decoration-red-400">{tag.examples[0].quote}</span>
                          {" → "}
                          <span className="text-green-700 dark:text-green-400">{tag.examples[0].correction}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {notebook.tags.length > 0 && (
                <Link href="/grammar" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  {w.practiseGrammar} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{w.genresTitle}</h2>
                <p className="text-xs text-zinc-500">{t("writing.genresSubtitle", { done: coveredGenres, total: levelGenres.length, level: levelOpt.label })}</p>
              </div>
              <ul className="space-y-1.5">
                {levelGenres.map((g) => (
                  <li key={g} className="flex items-center gap-2 text-sm">
                    {practisedCount[g]
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      : <Circle className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />}
                    <span className={cn("first-letter:uppercase", practisedCount[g] ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500")}>{g}</span>
                    {practisedCount[g] ? <span className="ml-auto text-xs tabular-nums text-zinc-400">×{practisedCount[g]}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {/* History */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">{w.historyTitle}</h2>
          {practices.length === 0 ? (
            <p className="text-sm text-zinc-500">{w.historyEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {practices.map((p) => {
                const band = p.lastScore !== null ? bandFromScore(p.lastScore) : null;
                return (
                  <li key={p.id} className="group flex items-center gap-2">
                    <Link
                      href={`/writing/${p.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                    >
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <Badge className="bg-blue-600 text-white text-[10px]">{p.level.replace("ISE_", "").replace("FOUNDATION", "F")}</Badge>
                        <span className="text-[10px] font-medium text-zinc-400">{p.taskType === "READING_INTO_WRITING" ? "T3" : "T4"}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display font-semibold text-zinc-900 dark:text-zinc-100">{p.title}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {p.genre} · {p.topic} · {new Date(p.updatedAt).toLocaleDateString(locale)}
                          {" · "}
                          {p.versions === 0 ? w.notSubmitted : p.versions === 1 ? w.versionOne : t("writing.versions", { n: p.versions })}
                        </p>
                      </div>
                      {band && p.lastScore !== null && (
                        <span className="flex shrink-0 items-center gap-1.5">
                          {p.firstScore !== null && p.versions > 1 && (
                            <span className="text-xs tabular-nums text-zinc-400">{p.firstScore.toFixed(1)} →</span>
                          )}
                          <span className={cn("rounded-md px-2 py-0.5 text-sm font-bold tabular-nums", BAND_STYLES[band])}>{p.lastScore.toFixed(1)}</span>
                        </span>
                      )}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      title={w.delete}
                      aria-label={w.delete}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
