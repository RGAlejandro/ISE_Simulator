"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Volume2,
  Mic,
  MicOff,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  FileText,
  Clock,
  BookOpen,
} from "lucide-react";
import { useListeningStore } from "@/store/listening-store";
import { useSttRecorder } from "@/hooks/use-stt-recorder";
import { MicWaveform } from "@/components/exam/mic-waveform";
import { TranscriptPlayer } from "@/components/exam/transcript-player";
import { ListeningAdminDownloads } from "@/components/exam/listening-admin-downloads";
import type { ExamLevel, ListeningRound1Feedback, ListeningRound2Feedback } from "@/types";

const LEVEL_LABELS: Record<ExamLevel, string> = {
  ISE_FOUNDATION: "ISE Foundation (A2)",
  ISE_I: "ISE I (B1)",
  ISE_II: "ISE II (B2)",
  ISE_III: "ISE III (C1)",
  ISE_IV: "ISE IV (C2)",
};

const PHASE_STEPS = [
  { key: "round1_listen", label: "First Listening" },
  { key: "round1_respond", label: "General Summary" },
  { key: "round1_feedback", label: "Feedback" },
  { key: "round2_listen", label: "Second Listening" },
  { key: "round2_respond", label: "Detailed Notes" },
  { key: "done", label: "Results" },
];

const TIMER_SECONDS = 60;

interface ListeningClientProps {
  sessionId: string;
  level: ExamLevel;
  passageText: string;
  passageTitle: string;
  passageTopic: string;
  informationType: string;
  existingRound1Score: number | null;
  existingRound1Feedback: object | null;
  existingRound2Feedback: object | null;
  overallScore: number | null;
  isAdmin: boolean;
}

export function ListeningClient({
  sessionId,
  level,
  passageText,
  passageTitle,
  passageTopic,
  informationType,
  existingRound1Score,
  existingRound1Feedback,
  existingRound2Feedback,
  overallScore: existingOverallScore,
  isAdmin,
}: ListeningClientProps) {
  const router = useRouter();
  const store = useListeningStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const passageAudioRef = useRef<HTMLAudioElement | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize store
  useEffect(() => {
    if (existingRound2Feedback && existingOverallScore !== null) {
      // Session already completed — restore done state
      store.setSession(sessionId, level, passageText, passageTitle, passageTopic, informationType);
      store.setRound1Feedback(existingRound1Feedback as ListeningRound1Feedback);
      store.setRound2Feedback(
        existingRound2Feedback as ListeningRound2Feedback,
        existingOverallScore
      );
    } else if (existingRound1Feedback && existingRound1Score !== null) {
      // Round 1 done, round 2 pending
      store.setSession(sessionId, level, passageText, passageTitle, passageTopic, informationType);
      store.setRound1Feedback(existingRound1Feedback as ListeningRound1Feedback);
      store.setPhase("round2_listen");
    } else {
      store.setSession(sessionId, level, passageText, passageTitle, passageTopic, informationType);
    }
    return () => {
      store.reset();
      if (timerRef.current) clearInterval(timerRef.current);
      if (passageAudioRef.current) passageAudioRef.current.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playPassage = useCallback(
    async (onEnd: () => void) => {
      store.setPlaying(true);

      if (passageAudioRef.current) {
        passageAudioRef.current.pause();
        passageAudioRef.current = null;
      }

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: passageText }),
        });

        if (!res.ok) throw new Error("TTS failed");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        passageAudioRef.current = audio;

        audio.onended = () => {
          store.setPlaying(false);
          URL.revokeObjectURL(url);
          onEnd();
        };
        audio.onerror = () => {
          store.setPlaying(false);
          URL.revokeObjectURL(url);
          onEnd();
        };

        await audio.play();
      } catch {
        store.setPlaying(false);
        onEnd();
      }
    },
    [passageText, store]
  );

  const startTimer = useCallback(() => {
    store.setTimer(TIMER_SECONDS);
    let remaining = TIMER_SECONDS;
    timerRef.current = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      store.setTimer(remaining);
      if (remaining === 0 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    }, 1000);
  }, [store]);

  // Timer effect — auto-stop recording when time runs out
  useEffect(() => {
    if (store.timer === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (store.isRecording) {
        stt.stop();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.timer, store.isRecording]);

  const handlePlayRound1 = useCallback(() => {
    if (store.hasPlayedRound1 || store.isPlaying) return;
    store.setHasPlayedRound1(true);
    playPassage(() => {
      store.setPhase("round1_respond");
      startTimer();
    });
  }, [store, playPassage, startTimer]);

  const handlePlayRound2 = useCallback(() => {
    if (store.hasPlayedRound2 || store.isPlaying) return;
    store.setHasPlayedRound2(true);
    playPassage(() => {
      store.setPhase("round2_respond");
      startTimer();
    });
  }, [store, playPassage, startTimer]);

  // MediaRecorder + server-side Whisper STT (works in every browser, unlike Web Speech API).
  // Transcript flows into whichever round's field is active.
  const phaseRef = useRef(store.phase);
  phaseRef.current = store.phase;
  const stt = useSttRecorder({
    onTranscript: (text) => {
      store.setRecording(false);
      const append = (prev: string) => (prev.trim() ? `${prev.trim()} ${text}` : text);
      if (phaseRef.current === "round2_respond") setNotesInput(append);
      else setTextInput(append);
    },
    onError: (message) => {
      store.setRecording(false);
      setShowTextFallback(true);
      store.setError(message);
    },
  });

  const startRecording = useCallback(() => {
    store.setError(null);
    void stt.start();
    store.setRecording(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.start, store]);

  const stopRecording = useCallback(() => {
    stt.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.stop]);

  const submitRound1 = useCallback(async () => {
    const response = textInput.trim();
    if (!response || response.length < 5) {
      store.setError("Please provide a summary before submitting.");
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitting(true);
    store.setError(null);

    try {
      const res = await fetch("/api/listening/round1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, response }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed");
      store.setRound1Feedback(data.feedback as ListeningRound1Feedback);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Failed to evaluate. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [textInput, sessionId, store]);

  const submitRound2 = useCallback(async () => {
    const notes = notesInput.trim();
    if (!notes || notes.length < 10) {
      store.setError("Please write your notes before submitting.");
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitting(true);
    store.setError(null);

    try {
      const res = await fetch("/api/listening/round2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed");
      store.setRound2Feedback(
        data.feedback as ListeningRound2Feedback,
        data.overallScore
      );
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Failed to evaluate. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [notesInput, sessionId, store]);

  // Admin shortcut: skip both rounds (scores 0) and jump to the transcript,
  // where the script PDF and MP3 can be generated.
  const skipToTranscript = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (passageAudioRef.current) passageAudioRef.current.pause();
    if (store.isRecording) stt.stop();
    store.setPlaying(false);
    store.setRecording(false);
    store.setRound1Feedback({
      score: 0,
      mainIdeaCaptured: false,
      informationTypeIdentified: false,
      comments: "Skipped — not scored.",
      missedPoints: [],
    });
    store.setRound2Feedback(
      {
        score: 0,
        accuracyScore: 0,
        completenessScore: 0,
        comments: "Skipped — not scored.",
        capturedDetails: [],
        missedDetails: [],
      },
      0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, stt.stop]);

  const currentStepIndex = PHASE_STEPS.findIndex((s) => s.key === store.phase);
  const progressPct = ((currentStepIndex + 1) / PHASE_STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Listening Practice
            </h1>
            <p className="text-sm text-zinc-500 mt-1">{LEVEL_LABELS[level]}</p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            {passageTitle}
          </Badge>
        </div>

        {/* Progress steps */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500 overflow-x-auto gap-2">
            {PHASE_STEPS.map((step, i) => (
              <span
                key={step.key}
                className={`whitespace-nowrap ${
                  i <= currentStepIndex
                    ? "text-purple-600 font-medium dark:text-purple-400"
                    : "text-zinc-400"
                }`}
              >
                {step.label}
              </span>
            ))}
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Error */}
        {store.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
            {store.error}
          </div>
        )}

        {/* Admin: skip rounds straight to the transcript (scores 0).
            On round1_listen the inline "Ir al final" button covers this. */}
        {isAdmin && store.phase !== "done" && store.phase !== "round1_listen" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-2">
            <span className="text-xs text-amber-700 dark:text-amber-400">
              Admin: skip both tasks to reach the transcript, audio and PDF (scores 0).
            </span>
            <Button onClick={skipToTranscript} variant="outline" size="sm" className="gap-2 shrink-0">
              <FileText className="h-4 w-4" />
              Skip to transcript
            </Button>
          </div>
        )}

        {/* PHASE: round1_listen */}
        {store.phase === "round1_listen" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Volume2 className="h-5 w-5 text-purple-600" />
                First Listening
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 p-4 text-sm text-purple-800 dark:text-purple-200 space-y-2">
                <p className="font-semibold">Instructions — Round 1</p>
                <ul className="list-disc list-inside space-y-1 text-purple-700 dark:text-purple-300">
                  <li>Listen carefully to the passage. Do not take notes.</li>
                  <li>After it finishes, you will have <strong>60 seconds</strong> to give a general summary.</li>
                  <li>Focus on the main topic and type of information.</li>
                </ul>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 py-4">
                <Button
                  size="lg"
                  onClick={handlePlayRound1}
                  disabled={store.isPlaying}
                  className="gap-2"
                >
                  {store.isPlaying ? (
                    <>
                      <Volume2 className="h-5 w-5 animate-pulse" />
                      Playing...
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-5 w-5" />
                      Play Listening (Round 1)
                    </>
                  )}
                </Button>
                {isAdmin && (
                  <Button size="lg" variant="outline" onClick={skipToTranscript} className="gap-2">
                    <FileText className="h-5 w-5" />
                    Ir al final
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PHASE: round1_respond */}
        {store.phase === "round1_respond" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mic className="h-5 w-5 text-green-600" />
                Your General Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                What was the listening about? What type of information did it contain?
              </div>

              {/* Timer */}
              {store.timer !== null && (
                <div className={`flex items-center gap-2 text-sm font-medium ${store.timer <= 15 ? "text-red-600" : "text-zinc-600"}`}>
                  <Clock className="h-4 w-4" />
                  {store.timer}s remaining
                </div>
              )}

              {/* Recording controls */}
              {!showTextFallback && (
                <div className="flex gap-3 items-center">
                  {stt.isTranscribing ? (
                    <span className="flex items-center gap-2 text-sm text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Transcribing...
                    </span>
                  ) : !store.isRecording ? (
                    <Button
                      variant="default"
                      onClick={startRecording}
                      className="gap-2"
                      disabled={!!textInput}
                    >
                      <Mic className="h-4 w-4" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={stopRecording}
                      className="gap-2 animate-pulse"
                    >
                      <MicOff className="h-4 w-4" />
                      Stop Recording
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTextFallback(true)}
                    className="text-zinc-500"
                  >
                    Type instead
                  </Button>
                </div>
              )}

              {store.isRecording && (
                <div className="flex flex-col items-center gap-1">
                  <MicWaveform stream={stt.stream} className="h-10" />
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">Listening...</p>
                </div>
              )}

              {/* Recorded transcript or text input */}
              <textarea
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your summary will appear here after recording, or type directly..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />

              <Button
                onClick={submitRound1}
                disabled={isSubmitting || textInput.trim().length < 5}
                className="gap-2 w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    Submit Summary
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PHASE: round1_feedback */}
        {store.phase === "round1_feedback" && store.round1Feedback && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Round 1 Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Score */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">General Comprehension</span>
                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {store.round1Feedback.score}/10
                </span>
              </div>

              {/* Quick indicators */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${store.round1Feedback.mainIdeaCaptured ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
                  {store.round1Feedback.mainIdeaCaptured ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  Main idea {store.round1Feedback.mainIdeaCaptured ? "captured" : "missed"}
                </div>
                <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${store.round1Feedback.informationTypeIdentified ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
                  {store.round1Feedback.informationTypeIdentified ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  Info type {store.round1Feedback.informationTypeIdentified ? "identified" : "missed"}
                </div>
              </div>

              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {store.round1Feedback.comments}
              </p>

              {store.round1Feedback.missedPoints.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Key points to focus on</p>
                  <ul className="space-y-1">
                    {store.round1Feedback.missedPoints.map((point, i) => (
                      <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                onClick={() => store.setPhase("round2_listen")}
                className="w-full gap-2"
              >
                Continue to Second Listening
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PHASE: round2_listen */}
        {store.phase === "round2_listen" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Volume2 className="h-5 w-5 text-purple-600" />
                Second Listening
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 p-4 text-sm text-purple-800 dark:text-purple-200 space-y-2">
                <p className="font-semibold">Instructions — Round 2</p>
                <ul className="list-disc list-inside space-y-1 text-purple-700 dark:text-purple-300">
                  <li>Listen again carefully. This time you may take notes.</li>
                  <li>Try to capture specific facts, numbers, and key details.</li>
                  <li>Note the main information type: <strong>{informationType}</strong></li>
                </ul>
              </div>
              <div className="text-center py-4">
                <Button
                  size="lg"
                  onClick={handlePlayRound2}
                  disabled={store.isPlaying}
                  className="gap-2"
                >
                  {store.isPlaying ? (
                    <>
                      <Volume2 className="h-5 w-5 animate-pulse" />
                      Playing...
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-5 w-5" />
                      Play Listening (Round 2)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PHASE: round2_respond */}
        {store.phase === "round2_respond" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-purple-600" />
                Detailed Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 p-3 text-sm text-purple-800 dark:text-purple-200">
                Give all the specific details you captured from the listening — facts, numbers, advantages/disadvantages, comparisons. Speak your answer or type it.
              </div>

              {/* Timer */}
              {store.timer !== null && (
                <div className={`flex items-center gap-2 text-sm font-medium ${store.timer <= 15 ? "text-red-600" : "text-zinc-600"}`}>
                  <Clock className="h-4 w-4" />
                  {store.timer}s remaining
                </div>
              )}

              {/* Recording controls */}
              {!showTextFallback && (
                <div className="flex gap-3 items-center">
                  {stt.isTranscribing ? (
                    <span className="flex items-center gap-2 text-sm text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Transcribing...
                    </span>
                  ) : !store.isRecording ? (
                    <Button variant="default" onClick={startRecording} className="gap-2">
                      <Mic className="h-4 w-4" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={stopRecording} className="gap-2 animate-pulse">
                      <MicOff className="h-4 w-4" />
                      Stop Recording
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTextFallback(true)}
                    className="text-zinc-500"
                  >
                    Type instead
                  </Button>
                </div>
              )}

              {store.isRecording && (
                <div className="flex flex-col items-center gap-1">
                  <MicWaveform stream={stt.stream} className="h-10" />
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">Listening...</p>
                </div>
              )}

              <textarea
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm min-h-[180px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your notes will appear here after recording, or type directly..."
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
              />
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{notesInput.split(/\s+/).filter(Boolean).length} words</span>
                <span>No word limit</span>
              </div>
              <Button
                onClick={submitRound2}
                disabled={isSubmitting || notesInput.trim().length < 10}
                className="gap-2 w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Evaluating notes...
                  </>
                ) : (
                  <>
                    Submit Notes
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PHASE: done */}
        {store.phase === "done" && store.round1Feedback && store.round2Feedback && (
          <div className="space-y-4">
            {/* Overall score */}
            <Card className="border-2 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-zinc-500 uppercase tracking-wide font-medium">Overall Score</p>
                  <p className="text-5xl font-bold text-zinc-900 dark:text-zinc-100">
                    {store.overallScore}%
                  </p>
                  <div className="flex justify-center gap-6 text-sm text-zinc-500 pt-2">
                    <span>Round 1: {store.round1Feedback.score}/10</span>
                    <span>Round 2: {store.round2Feedback.score}/15</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Round 2 feedback */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Round 2 — Detailed Notes Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "Accuracy", score: store.round2Feedback.accuracyScore, max: 5 },
                    { label: "Completeness", score: store.round2Feedback.completenessScore, max: 5 },
                    { label: "Organisation", score: Math.max(0, store.round2Feedback.score - store.round2Feedback.accuracyScore - store.round2Feedback.completenessScore), max: 5 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-3">
                      <p className="text-xs text-zinc-500">{item.label}</p>
                      <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                        {Math.max(0, item.score)}/{item.max}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {store.round2Feedback.comments}
                </p>

                {store.round2Feedback.capturedDetails.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Captured correctly</p>
                    <ul className="space-y-1">
                      {store.round2Feedback.capturedDetails.map((d, i) => (
                        <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {store.round2Feedback.missedDetails.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Missed or incorrect</p>
                    <ul className="space-y-1">
                      {store.round2Feedback.missedDetails.map((d, i) => (
                        <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Full transcript with synchronized playback */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Listening transcript
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-zinc-500">
                  Play the audio and follow along — each word is highlighted as the speaker says it.
                </p>
                <TranscriptPlayer text={passageText} />
                {isAdmin && (
                  <ListeningAdminDownloads
                    passageText={passageText}
                    passageTitle={passageTitle}
                    passageTopic={passageTopic}
                    level={level}
                    informationType={informationType}
                  />
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/practice")}
              >
                Back to Practice
              </Button>
              <Button
                className="flex-1"
                onClick={() => router.push("/practice")}
              >
                New Session
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
