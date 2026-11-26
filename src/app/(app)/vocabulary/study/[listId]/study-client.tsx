"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flashcard, LEVEL_COLORS } from "@/components/vocabulary/flashcard";
import { WordDetailsDialog } from "@/components/vocabulary/word-details-dialog";
import { WordGame, type GameMode } from "@/components/vocabulary/word-game";
import { ListQuiz } from "@/components/vocabulary/list-quiz";
import { useEnglishTTS } from "@/hooks/use-english-tts";
import { useI18n } from "@/components/i18n/language-provider";
import {
  ArrowLeft, CheckCircle, XCircle, RotateCcw, Trophy, BookOpen,
  Layers, Keyboard, TextCursorInput, Ear, ArrowRight, ListChecks, Flame,
} from "lucide-react";
import type { CefrBand } from "@/lib/prompts/vocabulary";
import { QUIZ_SENSES, buildListQuiz, canQuiz, quizPool, type ListQuizQuestion, type QuizSense, type QuizWord } from "@/lib/vocab-quiz";
import type { VocabCard } from "@/types";

interface StudyCard extends VocabCard {
  id: string;
  level: CefrBand;
}

interface Props {
  listName: string;
  listEmoji: string;
  cards: StudyCard[];
  /** The learner's other saved words: wrong options for the quiz when the list is short. */
  extraWords: QuizWord[];
}

type Phase = "mode" | "studying" | "done";
type StudyMode = "flashcards" | "quiz" | GameMode;

interface ModeOption {
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: { value: string; label: string }[];
}

/** Small switch under a mode (direction, hints, text/audio). Picking doesn't start the mode. */
function ModeChoice({ label, value, onChange, choices }: ModeOption) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-0.5 text-xs">
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={value === c.value}
          onClick={() => onChange(c.value)}
          className={`rounded-md px-2.5 py-1 transition-colors ${
            value === c.value
              ? "bg-amber-100 dark:bg-amber-900/60 font-semibold text-amber-800 dark:text-amber-200"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function StudyClient({ listName, listEmoji, cards: initialCards, extraWords }: Props) {
  const [cards, setCards] = useState(() => shuffle(initialCards));
  const [phase, setPhase] = useState<Phase>("mode");
  const [mode, setMode] = useState<StudyMode>("flashcards");
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [missed, setMissed] = useState<StudyCard[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Flashcards: translation first. Complete the word: no letter hints.
  const [reverse, setReverse] = useState(false);
  const [hints, setHints] = useState(true);
  // Quiz: reading/spelling only by default; listening is opt-in.
  const [sense, setSense] = useState<QuizSense>("text");
  // Quiz: one question per card, dealt when a round starts. Streak = right answers in a row.
  const [quiz, setQuiz] = useState<Record<string, ListQuizQuestion>>({});
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const { speak, isPlaying } = useEnglishTTS();
  const { dict, t } = useI18n();
  const quizReady = useMemo(() => canQuiz(quizPool(initialCards, extraWords)), [initialCards, extraWords]);

  const currentCard = cards[index];
  const progress = useMemo(() => (cards.length > 0 ? (index / cards.length) * 100 : 0), [index, cards.length]);

  const handleAnswer = useCallback((knew: boolean) => {
    if (!currentCard) return;
    if (knew) setKnown((n) => n + 1);
    else setMissed((prev) => [...prev, currentCard]);
    const run = knew ? streak + 1 : 0;
    setStreak(run);
    setBestStreak((b) => Math.max(b, run));

    const next = index + 1;
    if (next < cards.length) {
      setIndex(next);
      setIsFlipped(false);
    } else {
      setPhase("done");
    }
  }, [currentCard, index, cards.length, streak]);

  /** Starts a round over `deck` (already shuffled). The quiz skips words it can't ask about. */
  const begin = (deck: StudyCard[], m: StudyMode) => {
    let next = deck;
    if (m === "quiz") {
      const questions = buildListQuiz(deck, { list: initialCards, extra: extraWords, kinds: QUIZ_SENSES[sense] });
      next = deck.filter((c) => questions[c.id]);
      if (next.length === 0) return;
      setQuiz(questions);
    }
    setMode(m);
    setCards(next);
    setIndex(0);
    setIsFlipped(false);
    setKnown(0);
    setMissed([]);
    setStreak(0);
    setBestStreak(0);
    setPhase("studying");
  };

  const restart = () => begin(shuffle(initialCards), mode);

  const changeMode = () => {
    setCards(shuffle(initialCards));
    setIndex(0);
    setIsFlipped(false);
    setKnown(0);
    setMissed([]);
    setPhase("mode");
  };

  const startMode = (m: StudyMode) => begin(cards, m);

  const reviewMissed = () => {
    if (missed.length === 0) return;
    begin(shuffle(missed), mode);
  };

  // ── MODE SELECT ──
  if (phase === "mode") {
    const g = dict.vocab.games;
    const modes: { key: StudyMode; icon: typeof Layers; label: string; description: string; option?: ModeOption; disabled?: boolean }[] = [
      {
        key: "flashcards", icon: Layers, label: g.modeFlashcards, description: g.modeFlashcardsDesc,
        option: {
          label: g.directionLabel, value: reverse ? "tr" : "en", onChange: (v) => setReverse(v === "tr"),
          choices: [{ value: "en", label: g.directionEnFirst }, { value: "tr", label: g.directionTrFirst }],
        },
      },
      {
        key: "quiz", icon: ListChecks, label: g.modeQuiz,
        description: quizReady ? g.modeQuizDesc : g.quizNeedsWords, disabled: !quizReady,
        option: quizReady ? {
          label: g.quizSenseLabel, value: sense, onChange: (v) => setSense(v as QuizSense),
          choices: [{ value: "text", label: g.quizText }, { value: "audio", label: g.quizAudio }, { value: "both", label: g.quizBoth }],
        } : undefined,
      },
      {
        key: "complete", icon: Keyboard, label: g.modeComplete, description: g.modeCompleteDesc,
        option: {
          label: g.modeComplete, value: hints ? "on" : "off", onChange: (v) => setHints(v === "on"),
          choices: [{ value: "on", label: g.hintsOn }, { value: "off", label: g.hintsOff }],
        },
      },
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
                {dict.vocab.games.backToSaved}
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
            {modes.map(({ key, icon: Icon, label, description, option, disabled }) => (
              <div
                key={key}
                className={`rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 transition-colors ${
                  disabled ? "opacity-60" : "hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
                }`}
              >
                <button
                  onClick={() => startMode(key)}
                  disabled={disabled}
                  className="w-full text-left flex items-center gap-3 p-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed"
                >
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{label}</p>
                    <p className="text-xs text-zinc-500">{description}</p>
                  </div>
                  {!disabled && <ArrowRight className="h-4 w-4 shrink-0 text-amber-600" />}
                </button>
                {option && (
                  <div className="-mt-1 pb-4 pl-[4.25rem] pr-4">
                    <ModeChoice {...option} />
                  </div>
                )}
              </div>
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
                  {dict.vocab.games.backToSaved}
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
              {mode === "quiz" && (
                <span
                  title={dict.vocab.games.quizStreak}
                  aria-label={`${dict.vocab.games.quizStreak}: ${streak}`}
                  className={`font-semibold tabular-nums transition-colors ${streak >= 3 ? "text-orange-500" : "text-zinc-400"}`}
                >
                  <Flame className={`inline h-3.5 w-3.5 mr-1 ${streak >= 3 ? "fill-orange-400" : ""}`} />{streak}
                </span>
              )}
              <Badge className={`${LEVEL_COLORS[currentCard.level]} text-[10px] font-bold`}>{currentCard.level}</Badge>
            </div>

            {mode === "flashcards" ? (
              <>
                <Flashcard
                  key={currentCard.id}
                  card={currentCard}
                  reverse={reverse}
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
                  <div className="h-12 flex items-center justify-center text-center text-sm text-zinc-400">
                    {reverse ? dict.vocab.tapToRevealEnglish : dict.vocab.tapToReveal}
                  </div>
                )}
              </>
            ) : mode === "quiz" && quiz[currentCard.id] ? (
              <ListQuiz
                key={currentCard.id}
                card={currentCard}
                question={quiz[currentCard.id]}
                strings={dict.vocab.games}
                onResult={handleAnswer}
                onSpeak={speak}
                isPlaying={isPlaying}
              />
            ) : mode !== "quiz" ? (
              <WordGame
                key={currentCard.id}
                card={currentCard}
                mode={mode}
                hints={hints}
                strings={dict.vocab.games}
                onResult={handleAnswer}
                onSpeak={speak}
                isPlaying={isPlaying}
              />
            ) : null}
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
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{dict.vocab.games.listComplete}</h2>
          <p className="text-sm text-zinc-500">{listEmoji} {listName}</p>
          {mode === "quiz" && bestStreak > 0 && (
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-orange-500">
              <Flame className="h-4 w-4 fill-orange-400" />
              {t("vocab.games.quizBestStreak", { n: bestStreak })}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex flex-col items-center pt-4 pb-4 gap-1">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{known}/{total}</p>
              <p className="text-xs text-zinc-500 text-center">{dict.vocab.games.statMastered}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center pt-4 pb-4 gap-1">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{accuracy}%</p>
              <p className="text-xs text-zinc-500 text-center">{dict.vocab.games.statAccuracy}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center pt-4 pb-4 gap-1">
              <p className="text-2xl font-bold text-red-500">{missed.length}</p>
              <p className="text-xs text-zinc-500 text-center">{dict.vocab.games.statLearning}</p>
            </CardContent>
          </Card>
        </div>

        {missed.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                {t("vocab.games.toReview", { n: missed.length })}
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
              {t("vocab.games.reviewMissed", { n: missed.length })}
            </Button>
          )}
          <Button onClick={restart} variant="outline" className="w-full gap-2">
            <RotateCcw className="h-4 w-4" />
            {dict.vocab.games.restartList}
          </Button>
          <Button onClick={changeMode} variant="outline" className="w-full gap-2">
            <Layers className="h-4 w-4" />
            {dict.vocab.games.changeMode}
          </Button>
          <Link href="/vocabulary/saved" className="block">
            <Button variant="ghost" className="w-full gap-2 text-zinc-500">
              <BookOpen className="h-4 w-4" />
              {dict.vocab.games.backToSavedFull}
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
