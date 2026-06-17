"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ErrorListener = (msg: string) => void;

const audioCache = new Map<string, string>(); // text → object URL

export function useEnglishTTS(onError?: ErrorListener) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const errorListenerRef = useRef<ErrorListener | undefined>(onError);
  // Incremented on every speak() call; an in-flight request whose token is stale
  // discards its result instead of playing — prevents overlapping/duplicate voices.
  const playTokenRef = useRef(0);

  useEffect(() => {
    errorListenerRef.current = onError;
  }, [onError]);

  const speak = useCallback(async (text: string, opts?: { onEnd?: () => void; voice?: string }) => {
    if (!text) {
      opts?.onEnd?.();
      return;
    }

    // Mark this as the latest request and stop whatever is currently playing.
    const token = ++playTokenRef.current;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const trimmed = text.trim().slice(0, 5000);
    const key = `${opts?.voice ?? "default"}:${trimmed}`;

    try {
      setIsPlaying(true);

      let url = audioCache.get(key);

      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, voice: opts?.voice }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "TTS request failed");
        }

        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        if (audioCache.size > 100) audioCache.clear();
        audioCache.set(key, url);
      }

      // A newer speak() superseded this one while we were fetching — abort.
      if (token !== playTokenRef.current) {
        opts?.onEnd?.();
        return;
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        if (token !== playTokenRef.current) return;
        setIsPlaying(false);
        opts?.onEnd?.();
      };
      audio.onerror = () => {
        if (token !== playTokenRef.current) return;
        setIsPlaying(false);
        errorListenerRef.current?.("playback-failed");
        opts?.onEnd?.();
      };

      await audio.play();
    } catch (err) {
      setIsPlaying(false);
      const msg = err instanceof Error ? err.message : "tts-failed";
      console.warn("[tts]", msg);
      errorListenerRef.current?.(msg);
      opts?.onEnd?.();
    }
  }, []);

  const stop = useCallback(() => {
    // Invalidate any in-flight request so it won't start playing after stop.
    playTokenRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      playTokenRef.current++;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { speak, stop, isPlaying, supported: true, voicesReady: true, voice: null };
}
