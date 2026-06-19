"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flashcard, LEVEL_COLORS } from "@/components/vocabulary/flashcard";
import { SaveToListDialog } from "@/components/vocabulary/save-to-list-dialog";
import { WordDetailsDialog } from "@/components/vocabulary/word-details-dialog";
import { useEnglishTTS } from "@/hooks/use-english-tts";
import { useToast } from "@/components/ui/toaster";
import { useI18n } from "@/components/i18n/language-provider";
import { scoreToLevel, levelToStartScore, SCORE_TO_LEVEL, type CefrBand, type VocabCategory } from "@/lib/prompts/vocabulary";
import type { VocabCard, VocabularyListData } from "@/types";
import {
  Loader2,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
  Trophy,
  BookmarkCheck,
} from "lucide-react";

const CEFR_LEVELS: CefrBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const SCORE_DELTA_CORRECT = 8;
const SCORE_DELTA_WRONG = 8;

type Phase = "setup" | "loading" | "studying" | "done";

export function VocabularyClient() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedStart, setSelectedStart] = useState<CefrBand | "">("");
  const [category, setCategory] = useState<VocabCategory>("words");
  const categoryRef = useRef<VocabCategory>("words");
  categoryRef.current = category;

  const [score, setScore] = useState(42);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalSeen, setTotalSeen] = useState(0);
  const [totalKnown, setTotalKnown] = useState(0);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [lastDelta, setLastDelta] = useState<"up" | "down" | "same" | null>(null);
  const [missedWords, setMissedWords] = useState<string[]>([]);
  const [answerFlash, setAnswerFlash] = useState<"correct" | "wrong" | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const seenWordsRef = useRef<string[]>([]);
  const prevLocaleRef = useRef<string | null>(null);

  // Save / lists state
  const [lists, setLists] = useState<VocabularyListData[]>([]);
  const [savedMap, setSavedMap] = useState<Map<string, string | null>>(new Map()); // english (lower) -> listId
  const [saveOpen, setSaveOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const currentCard = cards[cardIndex];
  const currentLevel = scoreToLevel(score);

  const { dict, locale } = useI18n();
  const { show } = useToast();
  const ttsErrorShownRef = useRef(false);
  const handleTtsError = useCallback((msg: string) => {
    if (ttsErrorShownRef.current) return;
    ttsErrorShownRef.current = true;
    show(
      msg === "synthesis-failed"
        ? "Speech engine failed. On Linux, install speech-dispatcher + espeak-ng then restart your browser."
        : `Pronunciation failed (${msg}).`,
      "error"
    );
  }, [show]);
  const { speak: rawSpeak, isPlaying, supported: ttsSupported, voicesReady } = useEnglishTTS(handleTtsError);

  const speak = useCallback((text: string) => {
    if (!ttsSupported) {
      show("Your browser doesn't support speech synthesis.", "error");
      return;
    }
    if (!voicesReady) {
      show("No English voice installed. On Linux, install speech-dispatcher + espeak-ng.", "error");
      return;
    }
    rawSpeak(text);
  }, [rawSpeak, ttsSupported, voicesReady, show]);

  // Initial fetch — lists + saved english set
  useEffect(() => {
    Promise.all([
      fetch("/api/vocabulary/lists").then((r) => (r.ok ? r.json() : { lists: [] })),
      fetch("/api/vocabulary/saved").then((r) => (r.ok ? r.json() : { words: [] })),
    ])
      .then(([listsRes, savedRes]) => {
        setLists(listsRes.lists ?? []);
        const m = new Map<string, string | null>();
        for (const w of savedRes.words ?? []) {
          m.set(w.english.toLowerCase(), w.listId);
        }
        setSavedMap(m);
      })
      .catch(() => {});
  }, []);

  const fetchNextBatch = useCallback(async (nextScore: number, seen: string[]) => {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/vocabulary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: nextScore, alreadySeen: seen, locale, category: categoryRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setCards(data.cards);
      setCardIndex(0);
      setIsFlipped(false);
      setPhase("studying");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards. Try again.");
      setPhase(seen.length === 0 ? "setup" : "studying");
    }
  }, [locale]);

  // Re-fetch when the user changes language mid-session
  useEffect(() => {
    const prev = prevLocaleRef.current;
    prevLocaleRef.current = locale;
    if (prev !== null && prev !== locale && phase === "studying") {
      fetchNextBatch(score, seenWordsRef.current);
    }
  }, [locale, phase, score, fetchNextBatch]);

  const handleStart = useCallback(() => {
    if (!selectedStart) return;
    const startScore = levelToStartScore(selectedStart);
    setScore(startScore);
    setScoreHistory([startScore]);
    setTotalSeen(0);
    setTotalKnown(0);
    setMissedWords([]);
    setLastDelta(null);
    seenWordsRef.current = [];
    fetchNextBatch(startScore, []);
  }, [selectedStart, fetchNextBatch]);

  const handleAnswer = useCallback((knew: boolean) => {
    if (!currentCard || isExiting) return;

    const card = currentCard;
    const currentScore = score;
    const currentIndex = cardIndex;
    const currentCardsLen = cards.length;

    setAnswerFlash(knew ? "correct" : "wrong");
    setIsExiting(true);

    setTimeout(() => {
      seenWordsRef.current = [...seenWordsRef.current, card.english];
      setTotalSeen((n) => n + 1);
      if (knew) setTotalKnown((n) => n + 1);
      else setMissedWords((prev) => [...prev, card.english]);

      const delta = knew ? SCORE_DELTA_CORRECT : -SCORE_DELTA_WRONG;
      const newScore = Math.min(100, Math.max(0, currentScore + delta));
      setScore(newScore);
      setScoreHistory((h) => [...h, newScore]);
      setLastDelta(newScore > currentScore ? "up" : newScore < currentScore ? "down" : "same");

      const nextIndex = currentIndex + 1;
      if (nextIndex < currentCardsLen) {
        setCardIndex(nextIndex);
        setIsFlipped(false);
      } else {
        fetchNextBatch(newScore, seenWordsRef.current);
      }

      setAnswerFlash(null);
      setIsExiting(false);
    }, 300);
  }, [currentCard, isExiting, score, cardIndex, cards.length, fetchNextBatch]);

  const handleStop = useCallback(() => setPhase("done"), []);

  const handleRestart = useCallback(() => {
    setPhase("setup");
    setSelectedStart("");
    setCards([]);
    setCardIndex(0);
    setIsFlipped(false);
    setScore(42);
    setScoreHistory([]);
    setTotalSeen(0);
    setTotalKnown(0);
    setMissedWords([]);
    setLastDelta(null);
    seenWordsRef.current = [];
  }, []);

  // Save / list handlers
  const saveCurrentToList = async (listId: string | null) => {
    if (!currentCard) return;
    try {
      const res = await fetch("/api/vocabulary/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          english: currentCard.english,
          spanish: currentCard.translation,
          example: currentCard.example,
          partOfSpeech: currentCard.partOfSpeech,
          level: currentLevel.cefr,
          listId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSavedMap((prev) => {
        const next = new Map(prev);
        next.set(currentCard.english.toLowerCase(), listId);
        return next;
      });
      // Refresh list counts
      const listsRes = await fetch("/api/vocabulary/lists").then((r) => r.json()).catch(() => null);
      if (listsRes?.lists) setLists(listsRes.lists);
      const listName = listId ? lists.find((l) => l.id === listId)?.name : "Unfiled";
      show(`Saved to ${listName ?? "list"}`, "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "Save failed", "error");
    }
  };

  const removeCurrent = async () => {
    if (!currentCard) return;
    try {
      const savedRes = await fetch("/api/vocabulary/saved").then((r) => r.json());
      const wordRecord = savedRes.words?.find(
        (w: { id: string; english: string }) => w.english.toLowerCase() === currentCard.english.toLowerCase()
      );
      if (!wordRecord) return;
      const res = await fetch(`/api/vocabulary/saved/${wordRecord.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed");
      setSavedMap((prev) => {
        const next = new Map(prev);
        next.delete(currentCard.english.toLowerCase());
        return next;
      });
      const listsRes = await fetch("/api/vocabulary/lists").then((r) => r.json()).catch(() => null);
      if (listsRes?.lists) setLists(listsRes.lists);
      show("Removed from saved", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "Remove failed", "error");
    }
  };

  const createList = async (name: string, emoji: string, color: string): Promise<VocabularyListData> => {
    const res = await fetch("/api/vocabulary/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji, color }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Create failed");
    setLists((prev) => [data.list, ...prev]);
    return data.list;
  };

  const isCurrentSaved = currentCard ? savedMap.has(currentCard.english.toLowerCase()) : false;
  const currentListId = currentCard ? savedMap.get(currentCard.english.toLowerCase()) ?? null : null;

  // ── SETUP ─────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-16 px-4">
        <div className="mx-auto max-w-md space-y-10">
          <div className="text-center space-y-2">
            <div className="text-5xl mb-3">🃏</div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Adaptive Vocabulary
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Cards get harder as you get them right.<br />
              Easier when you struggle. Infinite session.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center">
              What do you want to practise?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "words", emoji: "🔤", label: "Words" },
                { id: "phrasal_verbs", emoji: "🔗", label: "Phrasal verbs" },
                { id: "idioms", emoji: "💬", label: "Idioms" },
              ] as { id: VocabCategory; emoji: string; label: string }[]).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`rounded-xl py-3 flex flex-col items-center gap-1 border-2 transition-all ${
                    category === c.id
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                      : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <span className="text-lg">{c.emoji}</span>
                  <span className="text-xs font-semibold leading-tight text-center">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center">
              Where do you want to start?
            </p>
            <div className="grid grid-cols-3 gap-3">
              {CEFR_LEVELS.map((l) => {
                const band = SCORE_TO_LEVEL.find((b) => b.cefr === l)!;
                return (
                  <button
                    key={l}
                    onClick={() => setSelectedStart(l)}
                    className={`rounded-xl py-4 flex flex-col items-center gap-1 border-2 transition-all ${
                      selectedStart === l
                        ? `${LEVEL_COLORS[l]} border-2`
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                  >
                    <span className="text-lg font-bold">{l}</span>
                    <span className="text-xs text-zinc-500">{band.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleStart}
            disabled={!selectedStart}
            size="lg"
            className="w-full gap-2"
          >
            Start Session
          </Button>

          <Link href="/vocabulary/saved" className="block">
            <Button variant="outline" size="lg" className="w-full gap-2">
              <BookmarkCheck className="h-4 w-4" />
              My saved words {savedMap.size > 0 && <span className="text-xs text-zinc-400 ml-1">({savedMap.size})</span>}
            </Button>
          </Link>

          {!ttsSupported && (
            <p className="text-center text-xs text-amber-600 dark:text-amber-400">
              Your browser doesn&apos;t support speech synthesis. Pronunciation playback will be unavailable.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-zinc-500">
          Generating {currentLevel.cefr} words...
        </p>
      </div>
    );
  }

  // ── STUDYING ───────────────────────────────────────────────────────
  if (phase === "studying" && currentCard) {
    const accuracy = totalSeen > 0 ? Math.round((totalKnown / totalSeen) * 100) : 0;
    const startScore = scoreHistory[0] ?? score;
    const netChange = score - startScore;

    return (
      <>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-6 px-4">
          <div className="mx-auto max-w-md space-y-5">

            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={`${LEVEL_COLORS[currentLevel.cefr]} text-sm font-bold px-3 py-1`}>
                  {currentLevel.cefr}
                </Badge>
                {lastDelta === "up" && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium animate-bounce">
                    <TrendingUp className="h-3.5 w-3.5" /> Harder
                  </span>
                )}
                {lastDelta === "down" && (
                  <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                    <TrendingDown className="h-3.5 w-3.5" /> Easier
                  </span>
                )}
                {lastDelta === "same" && (
                  <span className="flex items-center gap-1 text-xs text-zinc-400">
                    <Minus className="h-3.5 w-3.5" /> Same
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{totalKnown}/{totalSeen}</span>
                <span className="font-medium">{accuracy}%</span>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleStop}>
                  End
                </Button>
              </div>
            </div>

            {/* Difficulty bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>A1</span>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">
                  Score {score}/100
                  {netChange !== 0 && (
                    <span className={netChange > 0 ? "text-green-600 ml-1" : "text-red-500 ml-1"}>
                      ({netChange > 0 ? "+" : ""}{netChange})
                    </span>
                  )}
                </span>
                <span>C2</span>
              </div>
              <div className="relative">
                <Progress value={score} className="h-2.5" />
                <div className="absolute inset-0 flex pointer-events-none">
                  {[17, 34, 51, 68, 85].map((pct) => (
                    <div
                      key={pct}
                      className="absolute top-0 bottom-0 w-px bg-white dark:bg-zinc-950 opacity-60"
                      style={{ left: `${pct}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center justify-between">
                {error}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-red-600"
                  onClick={() => fetchNextBatch(score, seenWordsRef.current)}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />Retry
                </Button>
              </div>
            )}

            <div className={`transition-all duration-300 ease-in-out ${
              isExiting ? "opacity-0 scale-95 -translate-y-1" : "opacity-100 scale-100 translate-y-0"
            }`}>
              <Flashcard
                key={cardIndex}
                card={currentCard}
                isFlipped={isFlipped}
                onFlip={() => { if (!isExiting) setIsFlipped((f) => !f); }}
                onSpeak={speak}
                isPlaying={isPlaying}
                isSaved={isCurrentSaved}
                onToggleSave={() => setSaveOpen(true)}
                onOpenDetails={() => setDetailsOpen(true)}
              />
            </div>

            {isFlipped ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className={`gap-2 h-12 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-all duration-150 active:scale-95 ${
                    answerFlash === "wrong" ? "scale-95 bg-red-100 dark:bg-red-950 shadow-inner" : ""
                  }`}
                  disabled={isExiting}
                  onClick={() => handleAnswer(false)}
                >
                  <XCircle className="h-5 w-5" />
                  {dict.vocab.stillLearning}
                </Button>
                <Button
                  className={`gap-2 h-12 bg-green-600 hover:bg-green-700 text-white transition-all duration-150 active:scale-95 ${
                    answerFlash === "correct" ? "scale-95 brightness-110 shadow-inner" : ""
                  }`}
                  disabled={isExiting}
                  onClick={() => handleAnswer(true)}
                >
                  <CheckCircle className="h-5 w-5" />
                  {dict.vocab.knowIt}
                </Button>
              </div>
            ) : (
              <div className="h-12 flex items-center justify-center text-sm text-zinc-400">
                {dict.vocab.tapToReveal}
              </div>
            )}

            <div className="flex justify-center gap-1.5">
              {cards.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < cardIndex
                      ? "w-6 bg-amber-400"
                      : i === cardIndex
                      ? "w-6 bg-amber-600"
                      : "w-3 bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <SaveToListDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          lists={lists}
          currentListId={currentListId}
          word={currentCard.english}
          isSaved={isCurrentSaved}
          onSelectList={saveCurrentToList}
          onRemove={removeCurrent}
          onCreateList={createList}
        />

        <WordDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          word={currentCard.english}
          level={currentLevel.cefr}
          onSpeak={speak}
        />
      </>
    );
  }

  // ── DONE ────────────────────────────────────────────────────────────
  if (phase === "done") {
    const accuracy = totalSeen > 0 ? Math.round((totalKnown / totalSeen) * 100) : 0;
    const startScore = scoreHistory[0] ?? score;
    const startLevel = scoreToLevel(startScore);
    const endLevel = scoreToLevel(score);
    const improved = score > startScore;
    const declined = score < startScore;

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
        <div className="mx-auto max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="text-5xl mb-2">
              {accuracy >= 80 ? "🏆" : accuracy >= 60 ? "📚" : "💪"}
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Session complete</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="flex flex-col items-center pt-4 pb-4 gap-1">
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalSeen}</p>
                <p className="text-xs text-zinc-500">Cards seen</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center pt-4 pb-4 gap-1">
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{accuracy}%</p>
                <p className="text-xs text-zinc-500">Accuracy</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center pt-4 pb-4 gap-1">
                <p className={`text-2xl font-bold ${improved ? "text-green-600" : declined ? "text-red-500" : "text-zinc-900 dark:text-zinc-100"}`}>
                  {improved ? "+" : ""}{score - startScore}
                </p>
                <p className="text-xs text-zinc-500">Score change</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Level progression</p>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <Badge className={`${LEVEL_COLORS[startLevel.cefr]} text-sm font-bold`}>
                    {startLevel.cefr}
                  </Badge>
                  <p className="text-xs text-zinc-400 mt-1">Start</p>
                </div>
                <div className="flex-1 mx-4">
                  <Progress value={score} className="h-2" />
                </div>
                <div className="text-center">
                  <Badge className={`${LEVEL_COLORS[endLevel.cefr]} text-sm font-bold`}>
                    {endLevel.cefr}
                  </Badge>
                  <p className="text-xs text-zinc-400 mt-1">End</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {missedWords.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-4 space-y-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Still learning ({missedWords.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {missedWords.map((w, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-2 py-1 text-xs text-red-700 dark:text-red-300 font-medium"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <Button
              className="w-full gap-2"
              onClick={() => fetchNextBatch(score, seenWordsRef.current)}
            >
              <Trophy className="h-4 w-4" />
              Continue from {endLevel.cefr}
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={handleRestart}>
              <RotateCcw className="h-4 w-4" />
              New session
            </Button>
            <Link href="/vocabulary/saved" className="block">
              <Button variant="ghost" size="sm" className="w-full gap-2 text-zinc-500">
                <BookmarkCheck className="h-4 w-4" />
                View saved words
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
