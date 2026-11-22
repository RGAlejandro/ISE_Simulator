"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, CheckCircle2, Loader2, PenTool, Repeat, Sparkles, Trophy, Volume2, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { WordGame } from "@/components/vocabulary/word-game";
import { useEnglishTTS } from "@/hooks/use-english-tts";
import { useI18n } from "@/components/i18n/language-provider";
import { canGapFill, exerciseForBox } from "@/lib/srs";
import { cn } from "@/lib/utils";

export interface ReviewCard {
  id: string;
  english: string;
  translation: string;
  example: string;
  partOfSpeech: string;
  level: string;
  notes: string | null;
  box: number;
}

interface Props {
  cards: ReviewCard[];
  stats: { total: number; learned: number; learning: number; newWords: number; dueReviews: number };
  nextDueAt: string | null;
}

interface QueueItem {
  card: ReviewCard;
  retry: boolean;
}

interface SentenceResult {
  wordId: string;
  ok: boolean;
  feedback: string;
  improved: string;
}

const PRODUCE_COUNT = 3;

export function ReviewClient({ cards, stats, nextDueAt }: Props) {
  const { dict, t, locale } = useI18n();
  const r = dict.vocab.review;
  const g = dict.vocab.games;
  const { show } = useToast();
  const { speak, isPlaying } = useEnglishTTS();

  const [phase, setPhase] = useState<"intro" | "session" | "summary">("intro");
  const [sessionKey, setSessionKey] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [introduced, setIntroduced] = useState<Set<string>>(new Set());
  const [firstTry, setFirstTry] = useState<Map<string, boolean>>(new Map());
  const [finishing, setFinishing] = useState(false);

  const [sentences, setSentences] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<SentenceResult[] | null>(null);

  const pending = useRef<Promise<unknown>[]>([]);

  const onSpeak = useCallback((text: string) => speak(text), [speak]);

  const start = () => {
    setSessionKey(crypto.randomUUID().replace(/-/g, ""));
    setQueue(cards.map((card) => ({ card, retry: false })));
    setIndex(0);
    setIntroduced(new Set());
    setFirstTry(new Map());
    setPhase("session");
  };

  const finish = async (results: Map<string, boolean>) => {
    setFinishing(true);
    await Promise.allSettled(pending.current);
    pending.current = [];
    try {
      // Closes the session server-side; the answers themselves are already saved.
      await fetch("/api/vocabulary/review/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey }),
      });
    } catch {
      /* best effort */
    }
    setFirstTry(results);
    setFinishing(false);
    setPhase("summary");
  };

  const onResult = (correct: boolean) => {
    const item = queue[index];
    const results = new Map(firstTry);
    if (!results.has(item.card.id)) {
      results.set(item.card.id, correct);
      setFirstTry(results);
      const p = fetch("/api/vocabulary/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: item.card.id, correct, sessionKey }),
      })
        .then((res) => { if (!res.ok) show(r.saveError, "error"); })
        .catch(() => show(r.saveError, "error"));
      pending.current.push(p);
    }
    // Missed words come back once at the end of the session.
    const nextQueue = !correct && !item.retry ? [...queue, { card: item.card, retry: true }] : queue;
    if (nextQueue !== queue) setQueue(nextQueue);
    if (index + 1 < nextQueue.length) setIndex(index + 1);
    else void finish(results);
  };

  const checkSentences = async () => {
    const items = Object.entries(sentences)
      .map(([wordId, sentence]) => ({ wordId, sentence: sentence.trim() }))
      .filter((it) => it.sentence.split(/\s+/).length >= 3);
    if (items.length === 0 || checking) return;
    setChecking(true);
    try {
      const res = await fetch("/api/vocabulary/review/sentences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChecked(data.results);
    } catch (err) {
      show(err instanceof Error && err.message ? err.message : r.checkError, "error");
    } finally {
      setChecking(false);
    }
  };

  // ── Intro ────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    const newInSession = cards.filter((c) => c.box === 0).length;
    return (
      <Shell back={r.backToVocab}>
        <header className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
            <Repeat className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {r.title.split(" ")[0]} <span className="marker-underline italic">{r.title.split(" ").slice(1).join(" ")}</span>
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{r.subtitle}</p>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={r.dueToday} value={cards.length} tone="amber" />
          <Stat label={r.newWords} value={stats.newWords} tone="blue" />
          <Stat label={r.learning} value={stats.learning} tone="zinc" />
          <Stat label={r.learned} value={stats.learned} tone="green" />
        </div>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4 text-center">
          {stats.total === 0 ? (
            <>
              <Brain className="mx-auto h-10 w-10 text-zinc-300" />
              <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">{r.noWords}</p>
              <p className="text-sm text-zinc-500">{r.addWordsHint}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/vocabulary/reading"><Button variant="outline" className="gap-1.5"><BookOpen className="h-4 w-4" /> {dict.vocab.reading.title}</Button></Link>
                <Link href="/writing"><Button variant="outline" className="gap-1.5"><PenTool className="h-4 w-4" /> Writing</Button></Link>
              </div>
            </>
          ) : cards.length === 0 ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
              <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">{r.allDone}</p>
              {nextDueAt && (
                <p className="text-sm text-zinc-500">
                  {t("vocab.review.nextDue", { date: new Date(nextDueAt).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }) })}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-center gap-1.5">
                {cards.length - newInSession > 0 && (
                  <Badge variant="outline" className="gap-1"><Repeat className="h-3 w-3" />{cards.length - newInSession}</Badge>
                )}
                {newInSession > 0 && (
                  <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                    +{newInSession} {r.newWords.toLowerCase()}
                  </Badge>
                )}
              </div>
              <Button size="lg" onClick={start} className="w-full gap-2 bg-amber-600 hover:bg-amber-700">
                {r.start} ({cards.length}) <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </section>
      </Shell>
    );
  }

  // ── Session ──────────────────────────────────────────────────────────────
  if (phase === "session") {
    const item = queue[index];
    if (!item || finishing) {
      return (
        <Shell back={r.backToVocab}>
          <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
        </Shell>
      );
    }
    const { card } = item;
    const showIntro = card.box === 0 && !item.retry && !introduced.has(card.id);
    const baseMode = card.box === 0 ? "complete" : exerciseForBox(card.box);
    const mode = baseMode === "gapfill" && !canGapFill(card.example, card.english) ? "complete" : baseMode;

    return (
      <Shell back={r.backToVocab}>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{t("vocab.review.progress", { n: index + 1, total: queue.length })}</span>
            {item.retry && <Badge variant="warning" className="text-[10px]"><Repeat className="h-3 w-3 mr-1" />{g.wrongLabel}</Badge>}
          </div>
          <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>
        </div>

        {showIntro ? (
          <Card>
            <CardContent className="pt-6 pb-6 space-y-5 text-center">
              <Badge className="bg-blue-600 text-white"><Sparkles className="h-3 w-3 mr-1" />{r.newWord}</Badge>
              <div className="space-y-1">
                <p className="font-display text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{card.english}</p>
                {card.partOfSpeech && <p className="text-xs italic text-zinc-400">{card.partOfSpeech} · {card.level}</p>}
              </div>
              <p className="text-lg font-medium text-amber-700 dark:text-amber-300">{card.translation}</p>
              <p className="font-serif italic leading-relaxed text-zinc-700 dark:text-zinc-300">“{card.example}”</p>
              {card.notes && <p className="text-xs text-zinc-500">{card.notes}</p>}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => speak(card.english)} disabled={isPlaying}>
                  <Volume2 className={cn("h-4 w-4", isPlaying && "animate-pulse")} /> {g.playAudio}
                </Button>
                <Button className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700" onClick={() => setIntroduced((prev) => new Set(prev).add(card.id))}>
                  {r.gotIt} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <WordGame
            key={`${card.id}-${index}`}
            card={{ english: card.english, partOfSpeech: card.partOfSpeech, translation: card.translation, example: card.example }}
            mode={mode}
            strings={{
              typeAnswer: g.typeAnswer,
              check: g.check,
              next: g.next,
              correctLabel: g.correctLabel,
              wrongLabel: g.wrongLabel,
              playAudio: g.playAudio,
              translationHint: g.translationHint,
              completePrompt: g.completePrompt,
              gapfillPrompt: g.gapfillPrompt,
              dictationPrompt: g.dictationPrompt,
            }}
            onResult={onResult}
            onSpeak={onSpeak}
            isPlaying={isPlaying}
          />
        )}
      </Shell>
    );
  }

  // ── Summary + production ─────────────────────────────────────────────────
  const reviewed = queue.filter((q) => !q.retry).map((q) => q.card);
  const correctCount = reviewed.filter((c) => firstTry.get(c.id)).length;
  const produceWords = [
    ...reviewed.filter((c) => firstTry.get(c.id)),
    ...reviewed.filter((c) => !firstTry.get(c.id)),
  ].slice(0, PRODUCE_COUNT);
  const resultFor = (id: string) => checked?.find((c) => c.wordId === id) ?? null;

  return (
    <Shell back={r.backToVocab}>
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm text-center space-y-4">
        <Trophy className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{r.sessionDone}</h1>
        <div className="flex justify-center gap-8">
          <div>
            <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{correctCount}/{reviewed.length}</p>
            <p className="text-xs text-zinc-500">{r.firstTry}</p>
          </div>
        </div>
      </section>

      {produceWords.length > 0 && (
        <section className="rounded-2xl border border-blue-200/70 dark:border-blue-900/60 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm space-y-4">
          <div>
            <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <PenTool className="h-5 w-5 text-blue-600" /> {r.produceTitle}
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">{r.produceHint}</p>
          </div>
          <ul className="space-y-4">
            {produceWords.map((c) => {
              const res = resultFor(c.id);
              return (
                <li key={c.id} className="space-y-2">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {c.english} <span className="font-normal text-zinc-400">· {c.translation}</span>
                  </p>
                  <textarea
                    value={sentences[c.id] ?? ""}
                    onChange={(e) => setSentences((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder={t("vocab.review.sentencePlaceholder", { word: c.english })}
                    rows={2}
                    disabled={checked !== null}
                    className="w-full resize-none rounded-xl border border-zinc-200 dark:border-zinc-800 bg-[var(--paper)] dark:bg-zinc-950 px-3 py-2 font-serif text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                  />
                  {res && (
                    <div className={cn(
                      "rounded-lg px-3 py-2 text-sm space-y-1",
                      res.ok ? "bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
                    )}>
                      <p className="flex items-center gap-1.5 font-semibold">
                        {res.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {res.ok ? r.sentenceOk : r.sentenceFix}
                      </p>
                      {res.feedback && <p className="text-xs leading-relaxed">{res.feedback}</p>}
                      {res.improved && <p className="font-serif text-xs italic"><span className="not-italic font-semibold">{r.better}:</span> {res.improved}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {checked === null && (
            <Button
              onClick={checkSentences}
              disabled={checking || !Object.values(sentences).some((s) => s.trim().split(/\s+/).length >= 3)}
              className="w-full gap-2"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {checking ? r.checking : r.checkSentences}
            </Button>
          )}
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Link href="/vocabulary" className="flex-1"><Button variant="outline" className="w-full">{r.finish}</Button></Link>
        <Link href="/writing" className="flex-1"><Button className="w-full gap-1.5"><PenTool className="h-4 w-4" /> Writing</Button></Link>
      </div>
    </Shell>
  );
}

function Shell({ back, children }: { back: string; children: React.ReactNode }) {
  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10 space-y-6">
        <Link href="/vocabulary">
          <Button variant="ghost" size="sm" className="gap-1 text-zinc-500 -ml-2">
            <ArrowLeft className="h-4 w-4" /> {back}
          </Button>
        </Link>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "blue" | "zinc" | "green" }) {
  const tones = {
    amber: "text-amber-600 dark:text-amber-400",
    blue: "text-blue-600 dark:text-blue-400",
    zinc: "text-zinc-700 dark:text-zinc-300",
    green: "text-green-600 dark:text-green-400",
  };
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
      <p className={cn("text-2xl font-bold tabular-nums", tones[tone])}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
