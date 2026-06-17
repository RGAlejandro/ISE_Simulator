"use client";

import { useCallback, useRef, useState } from "react";

interface UseSttRecorderOptions {
  /** Called with the transcribed text once the server returns it. */
  onTranscript: (text: string) => void;
  /** Called with a user-facing message on any failure (mic denied, STT error...). */
  onError: (message: string) => void;
}

/**
 * Records microphone audio with MediaRecorder and transcribes it server-side
 * (Groq Whisper via /api/exam/oral/stt). Works in every browser — unlike the
 * Web Speech API, which Chromium/Brave/Firefox builds cannot use.
 */
export function useSttRecorder({ onTranscript, onError }: UseSttRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  /** Live mic stream while recording — feed it to a visualizer so the user sees they're heard. */
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current?.state === "recording") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      onError("This browser cannot access the microphone. Please type your answer instead.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        onError(
          "Microphone blocked. Click the camera/mic icon in the address bar and allow the microphone. " +
          "In Brave, also lower Shields for this site (the lion icon). Or type your answer instead.",
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        onError("No microphone was detected. Connect one, or type your answer instead.");
      } else {
        onError("Couldn't start the microphone. Check browser permissions, or type your answer instead.");
      }
      return;
    }

    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
      .find((t) => MediaRecorder.isTypeSupported(t));

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      setIsRecording(false);
      setStream(null);
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      if (blob.size === 0) {
        onError("Nothing was recorded. Please try again.");
        return;
      }

      setIsTranscribing(true);
      try {
        const form = new FormData();
        form.append("audio", new File([blob], "answer.webm", { type: blob.type }));
        const res = await fetch("/api/exam/oral/stt", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Transcription failed");
        onTranscript(data.text);
      } catch (err) {
        onError(
          err instanceof Error && err.message !== "Transcription failed"
            ? err.message
            : "Could not transcribe the recording. Please try again or type your answer.",
        );
      } finally {
        setIsTranscribing(false);
      }
    };

    recorder.onerror = () => {
      setIsRecording(false);
      setStream(null);
      stream.getTracks().forEach((t) => t.stop());
      onError("Recording failed. Please try again or type your answer.");
    };

    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setStream(stream);
  }, [onTranscript, onError]);

  return { start, stop, isRecording, isTranscribing, stream };
}
