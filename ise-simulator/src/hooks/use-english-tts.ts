"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ErrorListener = (msg: string) => void;

const audioCache = new Map<string, string>(); // text → object URL

export function useEnglishTTS(onError?: ErrorListener) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const errorListenerRef = useRef<ErrorListener | undefined>(onError);

  useEffect(() => {
    errorListenerRef.current = onError;
  }, [onError]);

  const speak = useCallback(async (text: string) => {
    if (!text) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const key = text.trim().slice(0, 1000);

    try {
      setIsPlaying(true);

      let url = audioCache.get(key);

      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: key }),
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

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        errorListenerRef.current?.("playback-failed");
      };

      await audio.play();
    } catch (err) {
      setIsPlaying(false);
      const msg = err instanceof Error ? err.message : "tts-failed";
      console.warn("[tts]", msg);
      errorListenerRef.current?.(msg);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { speak, stop, isPlaying, supported: true, voicesReady: true, voice: null };
}
