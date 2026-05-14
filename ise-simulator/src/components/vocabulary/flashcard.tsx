"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, BookmarkPlus, BookmarkCheck, Info } from "lucide-react";
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
          ? "bg-blue-100 dark:bg-blue-900/70 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300"
          : "bg-white/80 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
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
}: FlashcardProps) {
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
          position: "relative",
          height: "280px",
        }}
      >
        {/* Front */}
        <Card
          style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}
          className="flex flex-col items-center justify-center h-full border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm"
        >
          <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center h-full w-full">
            <Badge variant="outline" className="text-xs capitalize text-zinc-400 border-zinc-200">
              {card.partOfSpeech}
            </Badge>
            <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight break-words">
              {card.english}
            </p>
            <p className="text-xs text-zinc-400 mt-auto">Tap to reveal</p>
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
            position: "absolute",
            inset: 0,
          }}
          className="flex flex-col h-full border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 shadow-sm"
        >
          <CardContent className="flex flex-col items-center justify-center gap-4 p-7 text-center h-full w-full">
            <div className="space-y-1">
              <Badge variant="outline" className="text-xs capitalize text-blue-500 border-blue-300 dark:border-blue-700">
                {card.partOfSpeech}
              </Badge>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-200 leading-tight">
                {card.spanish}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                {card.english}
              </p>
            </div>
            <div className="rounded-lg bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 px-4 py-3 w-full text-left">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1 font-medium">Example</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                &ldquo;{card.example}&rdquo;
              </p>
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
