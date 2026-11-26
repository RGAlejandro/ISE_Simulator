"use client";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, BookmarkPlus, BookmarkCheck, Info, Languages, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import type { CefrBand } from "@/lib/prompts/vocabulary";
import type { VocabCard } from "@/types";

export const LEVEL_COLORS: Record<CefrBand, string> = {
  A1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  A2: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800",
  B1: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  B2: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  C1: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  C2: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800",
};

interface FlashcardProps {
  card: VocabCard;
  isFlipped: boolean;
  onFlip: () => void;
  onSpeak: (text: string) => void;
  isPlaying?: boolean;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onOpenDetails?: () => void;
  hideActions?: boolean;
  /** Translation on the front: the learner says the English word, then flips. */
  reverse?: boolean;
}

function IconAction({
  onClick,
  title,
  active,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      title={title}
      aria-label={title}
      className={`h-9 w-9 rounded-full flex items-center justify-center transition-all border backdrop-blur ${
        active
          ? "bg-amber-100 dark:bg-amber-900/70 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-300"
          : "bg-white/80 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

// Translated examples, so a sentence is only translated once per browser.
const CACHE_KEY = "vocab.exampleTranslations";
const MAX_CACHED = 300;
const memory = new Map<string, string>();

function cached(key: string): string | undefined {
  if (memory.has(key)) return memory.get(key);
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>;
    if (typeof all[key] === "string") memory.set(key, all[key]);
    return all[key];
  } catch {
    return undefined;
  }
}

function remember(key: string, value: string) {
  memory.set(key, value);
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>;
    all[key] = value;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CACHED))) delete all[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch { /* storage blocked: the in-memory copy still works */ }
}

/** The card's example sentence in the learner's language, fetched on demand. */
function useExampleTranslation(card: VocabCard) {
  const { locale } = useI18n();
  const key = `${locale}|${card.english}|${card.example}`;
  // Keyed by the card, so moving to the next card hides it again.
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [text, setText] = useState<Record<string, string>>({});

  const toggle = async () => {
    if (open === key) return setOpen(null);
    setOpen(key);
    setFailed(null);
    const hit = text[key] ?? cached(key);
    if (hit) return setText((t) => ({ ...t, [key]: hit }));
    setLoading(key);
    try {
      const res = await fetch("/api/vocabulary/example-translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ example: card.example, english: card.english, translation: card.translation, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.translation !== "string") throw new Error();
      remember(key, data.translation);
      setText((t) => ({ ...t, [key]: data.translation }));
    } catch {
      setFailed(key);
    } finally {
      setLoading(null);
    }
  };

  return { key, open: open === key, loading: loading === key, failed: failed === key, text: text[key], toggle };
}

export function Flashcard({
  card,
  isFlipped,
  onFlip,
  onSpeak,
  isPlaying,
  isSaved,
  onToggleSave,
  onOpenDetails,
  hideActions = false,
  reverse = false,
}: FlashcardProps) {
  const { dict } = useI18n();
  const ex = useExampleTranslation(card);
  const exLabel = ex.open ? dict.vocab.hideExampleTranslation : dict.vocab.showExampleTranslation;
  // The back centres its content. When the translation opens, keep everything where it
  // is (pinned at its current offset) so the card only grows downwards.
  const backRef = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState<{ key: string; top: number } | null>(null);
  const pinnedTop = ex.open && pin?.key === ex.key ? pin.top : null;
  const toggleExample = () => {
    const box = backRef.current;
    const first = box?.firstElementChild;
    if (!ex.open && box && first) {
      setPin({ key: ex.key, top: first.getBoundingClientRect().top - box.getBoundingClientRect().top });
    }
    ex.toggle();
  };
  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ perspective: "1200px" }}
      onClick={onFlip}
    >
      <div
        style={{
          transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          // Both faces share one grid cell, so the card is as tall as its longer face
          // (the back grows when the example's translation opens).
          display: "grid",
          minHeight: "280px",
        }}
      >
        {/* Front */}
        <Card
          style={{ backfaceVisibility: "hidden", gridArea: "1 / 1" }}
          className="flex flex-col items-center justify-center h-full border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm"
        >
          <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center h-full w-full">
            <Badge variant="outline" className="text-xs capitalize text-zinc-400 border-zinc-200">
              {card.partOfSpeech}
            </Badge>
            <p className={`${reverse ? "text-3xl" : "text-4xl"} font-bold text-zinc-900 dark:text-zinc-100 leading-tight break-words`}>
              {reverse ? card.translation : card.english}
            </p>
            <p className="text-xs text-zinc-400 mt-auto">Tap to reveal</p>
          </CardContent>

          {!hideActions && (
            <div className="absolute top-3 right-3 flex gap-1.5">
              {!reverse && (
                <IconAction
                  onClick={() => onSpeak(card.english)}
                  title="Pronounce (British English)"
                  active={isPlaying}
                >
                  <Volume2 className="h-4 w-4" />
                </IconAction>
              )}
              {onToggleSave && (
                <IconAction
                  onClick={() => onToggleSave()}
                  title={isSaved ? "Saved" : "Save word"}
                  active={isSaved}
                >
                  {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
                </IconAction>
              )}
            </div>
          )}
        </Card>

        {/* Back */}
        <Card
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            gridArea: "1 / 1",
          }}
          className="flex flex-col h-full border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 shadow-sm"
        >
          <CardContent
            ref={backRef}
            style={pinnedTop !== null ? { justifyContent: "flex-start", paddingTop: pinnedTop } : undefined}
            className="flex flex-col items-center justify-center gap-4 p-7 text-center h-full w-full"
          >
            <div className="space-y-1">
              <Badge variant="outline" className="text-xs capitalize text-amber-500 border-amber-300 dark:border-amber-700">
                {card.partOfSpeech}
              </Badge>
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-200 leading-tight break-words">
                {reverse ? card.english : card.translation}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                {reverse ? card.translation : card.english}
              </p>
            </div>
            <div className="rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 px-4 py-3 w-full text-left">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Example</p>
                <span className="flex items-center -mr-1">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExample(); }}
                  title={exLabel}
                  aria-label={exLabel}
                  aria-expanded={ex.open}
                  className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                    ex.open
                      ? "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-200"
                      : "text-amber-600 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60"
                  }`}
                >
                  {ex.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onSpeak(card.example); }}
                  title="Play example sentence"
                  aria-label="Play example sentence"
                  className="h-7 w-7 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors shrink-0"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
                </span>
              </div>
              <p lang="en" className="text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                &ldquo;{card.example}&rdquo;
              </p>
              {ex.open && (ex.text || ex.failed) && (
                <p aria-live="polite" className={`mt-1.5 border-t border-amber-100 dark:border-amber-900 pt-1.5 text-sm leading-relaxed ${ex.failed ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {ex.failed ? dict.vocab.exampleTranslationError : ex.text}
                </p>
              )}
            </div>
          </CardContent>

          {!hideActions && (
            <div className="absolute top-3 right-3 flex gap-1.5">
              <IconAction
                onClick={() => onSpeak(card.english)}
                title="Pronounce (British English)"
                active={isPlaying}
              >
                <Volume2 className="h-4 w-4" />
              </IconAction>
              {onOpenDetails && (
                <IconAction onClick={() => onOpenDetails()} title="Word details">
                  <Info className="h-4 w-4" />
                </IconAction>
              )}
              {onToggleSave && (
                <IconAction
                  onClick={() => onToggleSave()}
                  title={isSaved ? "Saved" : "Save word"}
                  active={isSaved}
                >
                  {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
                </IconAction>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
