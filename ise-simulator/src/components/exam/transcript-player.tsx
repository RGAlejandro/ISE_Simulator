"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, RotateCcw } from "lucide-react";

interface TimedWord {
  text: string;
  start: number;
  end: number;
}

interface Segment {
  text: string;
  /** index into the timed word list, or null for gaps (spaces/punctuation) */
  wordIndex: number | null;
}

interface TranscriptPlayerProps {
  text: string;
  /** Must match an allowed voice on /api/tts/timed; defaults server-side. */
  voice?: string;
}

/**
 * Plays a transcript with Edge neural TTS and highlights each word as it is
 * spoken, scrolling to follow the speaker. Audio + per-word timings come from
 * /api/tts/timed (msedge-tts word boundaries).
 */
export function TranscriptPlayer({ text, voice = "en-GB-SoniaNeural" }: TranscriptPlayerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWord, setActiveWord] = useState(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordsRef = useRef<TimedWord[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const activeSpanRef = useRef<HTMLSpanElement | null>(null);

  // Map the original text onto the timed words so we keep punctuation/formatting.
  const [segments, setSegments] = useState<Segment[]>([{ text, wordIndex: null }]);

  const buildSegments = useCallback((source: string, words: TimedWord[]): Segment[] => {
    const segs: Segment[] = [];
    const haystack = source.toLowerCase();
    let cursor = 0;
    words.forEach((w, i) => {
      const needle = w.text.toLowerCase();
      const idx = haystack.indexOf(needle, cursor);
      if (idx === -1) return;
      if (idx > cursor) segs.push({ text: source.slice(cursor, idx), wordIndex: null });
      segs.push({ text: source.slice(idx, idx + w.text.length), wordIndex: i });
      cursor = idx + w.text.length;
    });
    if (cursor < source.length) segs.push({ text: source.slice(cursor), wordIndex: null });
    return segs;
  }, []);

  const ensureLoaded = useCallback(async () => {
    if (audioRef.current) return audioRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tts/timed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) throw new Error("Could not load audio");
      const data = (await res.json()) as { audioBase64: string; words: TimedWord[] };

      wordsRef.current = data.words;
      setSegments(buildSegments(text, data.words));

      const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audio.ontimeupdate = () => {
        const t = audio.currentTime;
        const words = wordsRef.current;
        // Active word = last word whose start has passed.
        let idx = -1;
        for (let i = 0; i < words.length; i++) {
          if (words[i].start <= t) idx = i;
          else break;
        }
        setActiveWord(idx);
      };
      audio.onended = () => {
        setIsPlaying(false);
        setActiveWord(-1);
      };
      audio.onpause = () => setIsPlaying(false);
      audio.onplay = () => setIsPlaying(true);
      audioRef.current = audio;
      return audio;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audio failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [text, voice, buildSegments]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current ?? (await ensureLoaded());
    if (!audio) return;
    if (audio.paused) await audio.play().catch(() => {});
    else audio.pause();
  }, [ensureLoaded]);

  const restart = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, []);

  // Follow the speaker: scroll the active word into view.
  useEffect(() => {
    activeSpanRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeWord]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button onClick={toggle} disabled={loading} size="sm" className="gap-2">
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>
          ) : isPlaying ? (
            <><Pause className="h-4 w-4" /> Pause</>
          ) : (
            <><Play className="h-4 w-4" /> Play transcript</>
          )}
        </Button>
        {audioRef.current && (
          <Button onClick={restart} variant="outline" size="sm" className="gap-2">
            <RotateCcw className="h-4 w-4" /> Restart
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {segments.map((seg, i) => {
          if (seg.wordIndex === null) return <span key={i}>{seg.text}</span>;
          const isActive = seg.wordIndex === activeWord;
          return (
            <span
              key={i}
              ref={isActive ? activeSpanRef : null}
              className={
                isActive
                  ? "rounded bg-purple-500 px-0.5 text-white transition-colors"
                  : "transition-colors"
              }
            >
              {seg.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
