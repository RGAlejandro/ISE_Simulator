"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { buildSegments } from "@/lib/reading";
import { cn } from "@/lib/utils";
import { Bookmark, BookmarkCheck, Info, Loader2, RotateCcw, Volume2, X } from "lucide-react";
import type { ReadingLookupData } from "@/types";

export type GlossState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ReadingLookupData };

interface Props {
  /** Word as tapped in the text. */
  word: string;
  /** Sentence the word was tapped in. */
  sentence: string;
  gloss: GlossState | undefined;
  isKeyWord: boolean;
  /** Key word woven in from the learner's saved list. */
  fromList?: boolean;
  isSaved: boolean;
  isPlaying?: boolean;
  onSave: () => void;
  onDetails: () => void;
  onSpeak: (text: string) => void;
  onRetry: () => void;
  onClose: () => void;
  className?: string;
}

/** Context sentence with the tapped word marked. */
function ContextSentence({ sentence, word }: { sentence: string; word: string }) {
  return (
    <p className="font-display text-sm italic leading-relaxed text-zinc-600 dark:text-zinc-400">
      &ldquo;
      {buildSegments(sentence, [word]).map((seg, i) =>
        seg.kind === "target" ? (
          <mark key={i} className="marker-underline bg-transparent not-italic font-semibold text-zinc-900 dark:text-zinc-100">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
      &rdquo;
    </p>
  );
}

export function WordPanel({
  word, sentence, gloss, isKeyWord, fromList, isSaved, isPlaying, onSave, onDetails, onSpeak, onRetry, onClose, className,
}: Props) {
  const r = useI18n().dict.vocab.reading;
  const data = gloss?.status === "ready" ? gloss.data : null;
  const headword = data?.lemma ?? word;

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-900/5 dark:shadow-black/30 p-5 space-y-4",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 break-words">
              {headword}
            </h3>
            <button
              type="button"
              onClick={() => onSpeak(headword)}
              disabled={isPlaying}
              title="Pronounce"
              aria-label="Pronounce"
              className="h-7 w-7 shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors disabled:opacity-60"
            >
              <Volume2 className={cn("h-3.5 w-3.5", isPlaying && "animate-pulse")} />
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {isKeyWord && (
              <Badge className="bg-marker text-zinc-900 dark:text-zinc-50 border-transparent text-[10px] uppercase tracking-wide">
                {r.keyWord}
              </Badge>
            )}
            {fromList && (
              <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200 border-transparent text-[10px] uppercase tracking-wide">
                {r.fromList}
              </Badge>
            )}
            {data?.partOfSpeech && (
              <span className="text-xs italic text-zinc-500 dark:text-zinc-400">{data.partOfSpeech}</span>
            )}
            {data?.level && (
              <Badge variant="outline" className="text-[10px] font-bold">{data.level}</Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={r.close}
          className="h-8 w-8 shrink-0 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {gloss?.status === "loading" && (
        <div className="flex items-center gap-2 py-3 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> {r.lookingUp}
        </div>
      )}

      {gloss?.status === "error" && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {r.lookupError}
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-red-700 dark:text-red-300" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" /> {r.retry}
          </Button>
        </div>
      )}

      {data && (
        <div className="space-y-1.5">
          <p className="text-xl font-semibold text-brand leading-snug">{data.translation}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{data.definition}</p>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{r.inContext}</p>
        <ContextSentence sentence={sentence} word={word} />
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={isSaved ? "outline" : "default"}
            onClick={onSave}
            className={cn("gap-2", !isSaved && "bg-amber-600 hover:bg-amber-700 text-white")}
          >
            {isSaved ? <BookmarkCheck className="h-4 w-4 text-amber-600" /> : <Bookmark className="h-4 w-4" />}
            {isSaved ? r.saved : r.save}
          </Button>
          <Button variant="outline" onClick={onDetails} className="gap-2">
            <Info className="h-4 w-4" /> {r.details}
          </Button>
        </div>
      )}
    </div>
  );
}
