"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LEVEL_COLORS } from "@/components/vocabulary/flashcard";
import { useI18n } from "@/components/i18n/language-provider";
import { READING_TOPICS } from "@/lib/prompts/reading";
import { SCORE_TO_LEVEL, type CefrBand } from "@/lib/prompts/vocabulary";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Loader2, MousePointerClick, Sparkles } from "lucide-react";
import type { VocabularyListData } from "@/types";

const CEFR_LEVELS: CefrBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
/** A personalised text needs a few words to weave in (mirrors the API). */
const MIN_LIST_WORDS = 3;

interface HistoryItem {
  id: string;
  title: string;
  level: CefrBand;
  topic: string;
  score: number | null;
  total: number | null;
  completed: boolean;
  lookups: number;
  createdAt: string;
}

interface Props {
  isPro: boolean;
  readingsToday: number;
  canStart: boolean;
  freeLimit: number;
  lists: VocabularyListData[];
  history: HistoryItem[];
}

export function ReadingSetupClient({ isPro, readingsToday, canStart, freeLimit, lists, history }: Props) {
  const { dict, t, locale } = useI18n();
  const r = dict.vocab.reading;
  const router = useRouter();

  const [level, setLevel] = useState<CefrBand | "">(history[0]?.level ?? "");
  const [topic, setTopic] = useState<string>("random");
  const [listId, setListId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(!canStart);

  const usableLists = lists.filter((l) => l.wordCount >= MIN_LIST_WORDS);

  const chooseLevel = (l: CefrBand) => {
    setLevel(l);
    if (!READING_TOPICS[l].includes(topic)) setTopic("random");
  };

  const start = async () => {
    if (!level || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/vocabulary/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, topic, listId, locale }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setLimitHit(true);
        setStarting(false);
        return;
      }
      if (!res.ok) throw new Error(data.error);
      router.push(`/vocabulary/reading/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : r.startError);
      setStarting(false);
    }
  };

  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10 space-y-8">
        <Link href="/vocabulary">
          <Button variant="ghost" size="sm" className="gap-1 text-zinc-500 -ml-2">
            <ArrowLeft className="h-4 w-4" /> {r.backToVocab}
          </Button>
        </Link>

        <header className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
            <BookOpen className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Reading <span className="marker-underline italic">Explorer</span>
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{r.subtitle}</p>
        </header>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7 shadow-sm">
          {starting ? (
            <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
              <div className="relative">
                <BookOpen className="h-10 w-10 text-amber-500 animate-pulse" />
                <Loader2 className="absolute -right-3 -bottom-2 h-5 w-5 animate-spin text-amber-600" />
              </div>
              <div className="space-y-1">
                <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{r.generating}</p>
                <p className="text-sm text-zinc-500">{r.generatingHint}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-7">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{r.levelLabel}</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {CEFR_LEVELS.map((l) => {
                    const band = SCORE_TO_LEVEL.find((b) => b.cefr === l)!;
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => chooseLevel(l)}
                        aria-pressed={level === l}
                        className={cn(
                          "rounded-xl py-3 flex flex-col items-center gap-0.5 border-2 transition-all",
                          level === l
                            ? LEVEL_COLORS[l]
                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600",
                        )}
                      >
                        <span className="text-base font-bold">{l}</span>
                        <span className="text-[10px] text-zinc-500 leading-tight text-center px-1">{band.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {level && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{r.topicLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {["random", ...READING_TOPICS[level]].map((tp) => (
                      <button
                        key={tp}
                        type="button"
                        onClick={() => setTopic(tp)}
                        aria-pressed={topic === tp}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          topic === tp
                            ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200"
                            : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600",
                        )}
                      >
                        {tp === "random" ? (
                          <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> {r.surpriseMe}</span>
                        ) : (
                          tp
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {usableLists.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{r.listLabel}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{r.listHint}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[null, ...usableLists].map((l) => {
                      const active = listId === (l?.id ?? null);
                      return (
                        <button
                          key={l?.id ?? "none"}
                          type="button"
                          onClick={() => setListId(l?.id ?? null)}
                          aria-pressed={active}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors",
                            active
                              ? "border-amber-400 bg-amber-50/70 dark:border-amber-600 dark:bg-amber-950/40"
                              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                          )}
                        >
                          <span className="text-lg">{l ? l.emoji : "✨"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{l ? l.name : r.noList}</span>
                            {l && <span className="text-xs text-zinc-500">{l.wordCount} {r.words}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {limitHit ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3 text-sm text-amber-900 dark:text-amber-200">
                  <p>{r.limitReached}</p>
                  <Link href="/pricing" className="block">
                    <Button className="w-full bg-amber-600 hover:bg-amber-700">{dict.common.upgrade}</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={start}
                    disabled={!level}
                    size="lg"
                    className="w-full gap-2 bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
                  >
                    {r.start} <ArrowRight className="h-4 w-4" />
                  </Button>
                  {!isPro && (
                    <p className="text-center text-xs text-zinc-500">
                      {t("vocab.reading.limitInfo", { used: readingsToday, limit: freeLimit })}
                    </p>
                  )}
                </div>
              )}

              <p className="flex items-start gap-2 text-xs text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-5">
                <MousePointerClick className="h-4 w-4 shrink-0 text-amber-500" /> {r.tapHint}
              </p>
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">{r.historyTitle}</h2>
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/vocabulary/reading/${h.id}`}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                  >
                    <Badge className={cn(LEVEL_COLORS[h.level], "text-[10px] font-bold shrink-0")}>{h.level}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-semibold text-zinc-900 dark:text-zinc-100">{h.title}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {h.topic} · {t("vocab.reading.lookedUpCount", { n: h.lookups })} · {new Date(h.createdAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                    {h.completed ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400 shrink-0">
                        <CheckCircle2 className="h-4 w-4" /> {h.score}/{h.total}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-600 shrink-0">{r.inProgress}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
