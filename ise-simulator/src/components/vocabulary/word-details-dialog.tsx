"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Volume2 } from "lucide-react";
import type { WordDetails } from "@/types";
import type { CefrBand } from "@/lib/prompts/vocabulary";

const detailsCache = new Map<string, WordDetails>();

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  word: string;
  level: CefrBand;
  onSpeak: (text: string) => void;
}

export function WordDetailsDialog({ open, onOpenChange, word, level, onSpeak }: Props) {
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !word) return;

    const cached = detailsCache.get(word.toLowerCase());
    if (cached) {
      setDetails(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetails(null);

    fetch("/api/vocabulary/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ english: word, level }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        if (cancelled) return;
        detailsCache.set(word.toLowerCase(), data.details);
        setDetails(data.details);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, word, level]);

  const speak = (text: string) => onSpeak(text);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-2xl">{word}</DialogTitle>
            <button
              onClick={() => speak(word)}
              className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              title="Pronounce"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
            <Badge variant="outline" className="ml-auto text-xs">{level}</Badge>
          </div>
          <DialogDescription className="sr-only">Word details, synonyms, examples and pronunciation</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-2 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <p className="text-sm text-zinc-500">Loading details...</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {details && !loading && (
          <div className="space-y-4">
            {/* IPA + register */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-base text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                {details.ipa}
              </span>
              <Badge variant="outline" className="text-xs capitalize">{details.register}</Badge>
            </div>

            {/* Synonyms */}
            {details.synonyms.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Synonyms</p>
                <div className="flex flex-wrap gap-1.5">
                  {details.synonyms.map((s) => (
                    <button
                      key={s}
                      onClick={() => speak(s)}
                      className="text-xs px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Antonyms */}
            {details.antonyms.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Antonyms</p>
                <div className="flex flex-wrap gap-1.5">
                  {details.antonyms.map((a) => (
                    <button
                      key={a}
                      onClick={() => speak(a)}
                      className="text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Examples */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Examples</p>
              <div className="space-y-1.5">
                {details.examples.map((ex, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 border border-zinc-100 dark:border-zinc-700"
                  >
                    <button
                      onClick={() => speak(ex)}
                      className="text-blue-500 hover:text-blue-700 flex-shrink-0 mt-0.5"
                      title="Read aloud"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                      &ldquo;{ex}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Collocations */}
            {details.collocations.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Common collocations</p>
                <div className="flex flex-wrap gap-1.5">
                  {details.collocations.map((c) => (
                    <span
                      key={c}
                      className="text-xs px-2 py-1 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
