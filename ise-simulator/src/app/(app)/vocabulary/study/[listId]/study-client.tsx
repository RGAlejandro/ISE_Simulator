"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flashcard, LEVEL_COLORS } from "@/components/vocabulary/flashcard";
import { WordDetailsDialog } from "@/components/vocabulary/word-details-dialog";
import { WordGame, type GameMode } from "@/components/vocabulary/word-game";
import { useEnglishTTS } from "@/hooks/use-english-tts";
import { useI18n } from "@/components/i18n/language-provider";
import {
  ArrowLeft, CheckCircle, XCircle, RotateCcw, Trophy, BookOpen,
  Layers, Keyboard, TextCursorInput, Ear,
} from "lucide-react";
import type { CefrBand } from "@/lib/prompts/vocabulary";
import type { VocabCard } from "@/types";

interface StudyCard extends VocabCard {
  id: string;
  level: CefrBand;
}

interface Props {
  listName: string;
  listEmoji: string;
  cards: StudyCard[];
}

type Phase = "mode" | "studying" | "done";
type StudyMode = "flashcards" | GameMode;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function StudyClient({ listName, listEmoji, cards: initialCards }: Props) {
  const [cards, setCards] = useState(() => shuffle(initialCards));
  const [phase, setPhase] = useState<Phase>("mode");
  const [mode, setMode] = useState<StudyMode>("flashcards");
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [missed, setMissed] = useState<StudyCard[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { speak, isPlaying } = useEnglishTTS();
  const { dict } = useI18n();

  const currentCard = cards[index];
  const progress = useMemo(() => (cards.length > 0 ? (index / cards.length) * 100 : 0), [index, cards.length]);

  const handleAnswer = useCallback((knew: boolean) => {
    if (!currentCard) return;
    if (knew) setKnown((n) => n + 1);
    else setMissed((prev) => [...prev, currentCard]);

    const next = index + 1;
    if (next < cards.length) {
      setIndex(next);
      setIsFlipped(false);
    } else {
      setPhase("done");
    }
  }, [currentCard, index, cards.length]);

  const restart = () => {
    setCards(shuffle(initialCards));
    setIndex(0);
    setIsFlipped(false);
    setKnown(0);
    setMissed([]);
    setPhase("studying");
  };

  const changeMode = () => {
    setCards(shuffle(initialCards));
    setIndex(0);
    setIsFlipped(false);
    setKnown(0);
    setMissed([]);
    setPhase("mode");
  };

  const startMode = (m: StudyMode) => {
    setMode(m);
    setPhase("studying");
  };

  const reviewMissed = () => {
    if (missed.length === 0) return;
    setCards(shuffle(missed));
    setIndex(0);
    setIsFlipped(false);
    setKnown(0);
    setMissed([]);
    setPhase("studying");
  };

  // ── MODE SELECT ──
  if (phase === "mode") {
    const g = dict.vocab.games;
    const modes: { key: StudyMode; icon: typeof Layers; label: string; description: string }[] = [
      { key: "flashcards", icon: Layers, label: g.modeFlashcards, description: g.modeFlashcardsDesc },
      { key: "complete", icon: Keyboard, label: g.modeComplete, description: g.modeCompleteDesc },
      { key: "gapfill", icon: TextCursorInput, label: g.modeGapfill, description: g.modeGapfillDesc },
      { key: "dictation", icon: Ear, label: g.modeDictation, description: g.modeDictationDesc },
    ];
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-6 px-4">
        <div className="mx-auto max-w-md space-y-5">
          <div className="flex items-center justify-between">
            <Link href="/vocabulary/saved">
              <Button variant="ghost" size="sm" className="gap-1 text-zinc-500">
                <ArrowLeft className="h-4 w-4" />
                Saved
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl">{listEmoji}</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[160px]">{listName}</span>
            </div>
            <span className="text-xs text-zinc-400 font-mono">{cards.length}</span>
          </div>

          <div className="text-center space-y-1 pt-2">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{g.chooseMode}</h2>
            <p className="text-sm text-zinc-500">{g.chooseModeSubtitle}</p>
          </div>

          <div className="space-y-3">
            {modes.map(({ key, icon: Icon, label, description }) => (
              <button
                key={key}
                onClick={() => startMode(key)}
                className="w-full text-left flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 p-4 transition-colors"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{label}</p>
                  <p className="text-xs text-zinc-500">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "studying" && currentCard) {
    return (
      <>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-6 px-4">
          <div className="mx-auto max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <Link href="/vocabulary/saved">
                <Button variant="ghost" size="sm" className="gap-1 text-zinc-500">
                  <ArrowLeft className="h-4 w-4" />
                  Saved
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-xl">{listEmoji}</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[160px]">{listName}</span>
              </div>
              <span className="text-xs text-zinc-400 font-mono">{index + 1}/{cards.length}</span>
            </div>

            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span><CheckCircle className="inline h-3.5 w-3.5 text-green-500 mr-1" />{known}</span>
              <span><XCircle className="inline h-3.5 w-3.5 text-red-500 mr-1" />{missed.length}</span>
              <Badge className={`${LEVEL_COLORS[currentCard.level]} text-[10px] font-bold`}>{currentCard.level}</Badge>
            </div>

            {mode === "flashcards" ? (
              <>
                <Flashcard
                  card={currentCard}
                  isFlipped={isFlipped}
                  onFlip={() => setIsFlipped((f) => !f)}
                  onSpeak={speak}
                  isPlaying={isPlaying}
                  onOpenDetails={() => setDetailsOpen(true)}
                />

                {isFlipped ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="gap-2 h-12 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                      onClick={() => handleAnswer(false)}
                    >
                      <XCircle className="h-5 w-5" />
                      {dict.vocab.stillLearning}
                    </Button>
                    <Button
                      className="gap-2 h-12 bg-green-600 hover:bg-green-700 text-white"
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
              </>
            ) : (
              <WordGame
                key={currentCard.id}
                card={currentCard}
                mode={mode}
                strings={dict.vocab.games}
                onResult={handleAnswer}
                onSpeak={speak}
                isPlaying={isPlaying}
              />
            )}
          </div>
        </div>

        <WordDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          word={currentCard.english}
          level={currentCard.level}
          onSpeak={speak}
        />
      </>
    );
  }

  // ── DONE ──
  const total = cards.length;
  const accuracy = total > 0 ? Math.round((known / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl mb-2">
            {accuracy === 100 ? "🏆" : accuracy >= 70 ? "🎯" : "📚"}
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">List complete</h2>
          <p className="text-sm text-zinc-500">{listEmoji} {listName}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex flex-col items-center pt-4 pb-4 gap-1">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{known}/{total}</p>
              <p className="text-xs text-zinc-500">Mastered</p>
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
              <p className="text-2xl font-bold text-red-500">{missed.length}</p>
              <p className="text-xs text-zinc-500">Still learning</p>
            </CardContent>
          </Card>
        </div>

        {missed.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                To review ({missed.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {missed.map((w) => (
                  <span
                    key={w.id}
                    className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-2 py-1 text-xs text-red-700 dark:text-red-300 font-medium"
                  >
                    {w.english}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {missed.length > 0 && (
            <Button onClick={reviewMissed} className="w-full gap-2">
              <Trophy className="h-4 w-4" />
              Review missed ({missed.length})
            </Button>
          )}
          <Button onClick={restart} variant="outline" className="w-full gap-2">
            <RotateCcw className="h-4 w-4" />
            Restart list
          </Button>
          <Button onClick={changeMode} variant="outline" className="w-full gap-2">
            <Layers className="h-4 w-4" />
            {dict.vocab.games.changeMode}
          </Button>
          <Link href="/vocabulary/saved" className="block">
            <Button variant="ghost" className="w-full gap-2 text-zinc-500">
              <BookOpen className="h-4 w-4" />
              Back to saved
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
