"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { scoreToLevel, levelToStartScore, SCORE_TO_LEVEL, type CefrBand } from "@/lib/prompts/vocabulary";
import {
  Loader2,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
  Trophy,
} from "lucide-react";

const CEFR_LEVELS: CefrBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const SCORE_DELTA_CORRECT = 8;
const SCORE_DELTA_WRONG = 8;
const BATCH_SIZE = 5;

interface VocabCard {
  english: string;
  partOfSpeech: string;
  spanish: string;
  example: string;
}

type Phase = "setup" | "loading" | "studying" | "done";

const LEVEL_COLORS: Record<CefrBand, string> = {
  A1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  A2: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800",
  B1: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  B2: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  C1: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  C2: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800",
};

export function VocabularyClient() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedStart, setSelectedStart] = useState<CefrBand | "">("");

  // Adaptive state
  const [score, setScore] = useState(42);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session stats
  const [totalSeen, setTotalSeen] = useState(0);
  const [totalKnown, setTotalKnown] = useState(0);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [lastDelta, setLastDelta] = useState<"up" | "down" | "same" | null>(null);
  const [missedWords, setMissedWords] = useState<string[]>([]);
  const seenWordsRef = useRef<string[]>([]);

  const currentCard = cards[cardIndex];
  const currentLevel = scoreToLevel(score);

  const fetchNextBatch = useCallback(async (nextScore: number, seen: string[]) => {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/vocabulary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: nextScore, alreadySeen: seen }),
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
  }, []);

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
    if (!currentCard) return;

    // Track seen
    seenWordsRef.current = [...seenWordsRef.current, currentCard.english];

    // Update stats
    setTotalSeen((n) => n + 1);
    if (knew) {
      setTotalKnown((n) => n + 1);
    } else {
      setMissedWords((prev) => [...prev, currentCard.english]);
    }

    // Adjust score
    const delta = knew ? SCORE_DELTA_CORRECT : -SCORE_DELTA_WRONG;
    const newScore = Math.min(100, Math.max(0, score + delta));
    setScore(newScore);
    setScoreHistory((h) => [...h, newScore]);
    setLastDelta(
      newScore > score ? "up" : newScore < score ? "down" : "same"
    );

    // Next card or next batch
    const nextIndex = cardIndex + 1;
    if (nextIndex < cards.length) {
      setCardIndex(nextIndex);
      setIsFlipped(false);
    } else {
      fetchNextBatch(newScore, seenWordsRef.current);
    }
  }, [currentCard, score, cardIndex, cards.length, fetchNextBatch]);

  const handleStop = useCallback(() => {
    setPhase("done");
  }, []);

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
        </div>
      </div>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
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
              {/* Level band markers */}
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

          {/* Error (retry) */}
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

          {/* Flip card */}
          <div
            className="cursor-pointer select-none"
            style={{ perspective: "1200px" }}
            onClick={() => setIsFlipped((f) => !f)}
          >
            <div
              style={{
                transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                position: "relative",
                height: "260px",
              }}
            >
              {/* Front */}
              <Card
                style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}
                className="flex flex-col items-center justify-center h-full border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm"
              >
                <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center h-full">
                  <Badge variant="outline" className="text-xs capitalize text-zinc-400 border-zinc-200">
                    {currentCard.partOfSpeech}
                  </Badge>
                  <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight break-words">
                    {currentCard.english}
                  </p>
                  <p className="text-xs text-zinc-400 mt-auto">Tap to reveal</p>
                </CardContent>
              </Card>

              {/* Back */}
              <Card
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  position: "absolute",
                  inset: 0,
                }}
                className="flex flex-col h-full border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 shadow-sm"
              >
                <CardContent className="flex flex-col items-center justify-center gap-4 p-7 text-center h-full">
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs capitalize text-blue-500 border-blue-300 dark:border-blue-700">
                      {currentCard.partOfSpeech}
                    </Badge>
                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-200 leading-tight">
                      {currentCard.spanish}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                      {currentCard.english}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 px-4 py-3 w-full text-left">
                    <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1 font-medium">Example</p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                      &ldquo;{currentCard.example}&rdquo;
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action buttons */}
          {isFlipped ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="gap-2 h-12 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                onClick={() => handleAnswer(false)}
              >
                <XCircle className="h-5 w-5" />
                Still learning
              </Button>
              <Button
                className="gap-2 h-12 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAnswer(true)}
              >
                <CheckCircle className="h-5 w-5" />
                Know it
              </Button>
            </div>
          ) : (
            <div className="h-12 flex items-center justify-center text-sm text-zinc-400">
              Tap the card to see the translation
            </div>
          )}

          {/* Card progress within batch */}
          <div className="flex justify-center gap-1.5">
            {cards.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i < cardIndex
                    ? "w-6 bg-blue-400"
                    : i === cardIndex
                    ? "w-6 bg-blue-600"
                    : "w-3 bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
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

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="text-5xl mb-2">
              {accuracy >= 80 ? "🏆" : accuracy >= 60 ? "📚" : "💪"}
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Session complete</h2>
          </div>

          {/* Stats grid */}
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

          {/* Level progression */}
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

          {/* Missed words */}
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
          </div>
        </div>
      </div>
    );
  }

  return null;
}
