"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSttRecorder } from "@/hooks/use-stt-recorder";
import { useEnglishTTS } from "@/hooks/use-english-tts";
import { MicWaveform } from "@/components/exam/mic-waveform";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  MessageSquare,
  ArrowRight,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useOralExamStore } from "@/store/oral-exam-store";
import type { OralMessage } from "@/store/oral-exam-store";
import type { OralTaskType } from "@/types";

/**
 * Trinity ISE III/IV: Topic task = timed formal presentation + timed discussion.
 * Official: ISE III 4 min + up to 4 min; ISE IV up to 5 min + discussion.
 */
const FORMAL_TOPIC_TIMING: Partial<Record<string, { presentation: number; discussion: number }>> = {
  ISE_III: { presentation: 4 * 60, discussion: 4 * 60 },
  ISE_IV: { presentation: 5 * 60, discussion: 5 * 60 },
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TASK_LABELS: Record<OralTaskType, { label: string; description: string; icon: string }> = {
  TOPIC: {
    label: "Topic Task",
    description: "Present your prepared topic. The examiner will ask follow-up questions.",
    icon: "🎤",
  },
  COLLABORATIVE: {
    label: "Collaborative Task",
    description: "The examiner gives a situation, then stops. YOU lead: ask questions, weigh pros and cons, and reach a conclusion.",
    icon: "🤝",
  },
  CONVERSATION: {
    label: "Conversation Task",
    description: "Have a general conversation about a subject area.",
    icon: "💬",
  },
  LISTENING: {
    label: "Listening Task",
    description: "Listen to an audio passage and answer questions about it.",
    icon: "👂",
  },
};

interface OralExamClientProps {
  examId: string;
  level: string;
  initialMessage: string;
  isPro: boolean;
  /** Tasks the candidate opted into at setup (canonical order). Drives progress bar + transitions. */
  selectedTasks: string[];
  /** First task examiner opens with. Already reflected in initialMessage. */
  initialTask: string;
  /** Candidate's prepared topic bullet outline (Topic task). */
  topicGeneral: string | null;
  /** Candidate's prepared full essay (Topic task). */
  topicDetailed: string | null;
}

export function OralExamClient({
  examId, level, initialMessage, isPro,
  selectedTasks, initialTask, topicGeneral, topicDetailed,
}: OralExamClientProps) {
  // Dynamic task order = canonical filter on candidate's selectedTasks
  const taskOrder = (["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"] as const)
    .filter(t => selectedTasks.includes(t));
  // Suppress unused-var lints for fields wired through props for future phases (Topic-aware prompts).
  void topicGeneral; void topicDetailed;
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const store = useOralExamStore();
  const [exchangeCount, setExchangeCount] = useState(1);
  const [listeningData, setListeningData] = useState<{
    listeningText?: string;
    introduction?: string;
    questions?: string[];
  } | null>(null);
  const [currentListeningQuestion, setCurrentListeningQuestion] = useState(0);
  /** Trinity spec: candidate hears the Listening passage TWICE. 0 = not started, 1 = first play done, 2 = both done. */
  const [listeningPlayCount, setListeningPlayCount] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextFallback, setShowTextFallback] = useState(false);

  // ISE III/IV Topic task phases: timed formal presentation → timed discussion.
  // Only applies when the exam actually STARTS on the Topic task (it's always
  // first when selected). Initialized from props so it never fires when Topic
  // was skipped — avoids reading the store's transient default task.
  const formalTiming = FORMAL_TOPIC_TIMING[level];
  const startsWithFormalTopic = !!formalTiming && initialTask === "TOPIC";
  const [topicPhase, setTopicPhase] = useState<"presentation" | "discussion" | null>(
    startsWithFormalTopic ? "presentation" : null,
  );
  const [phaseTimeLeft, setPhaseTimeLeft] = useState<number | null>(
    startsWithFormalTopic ? formalTiming!.presentation : null,
  );
  const topicPhaseRef = useRef(topicPhase);
  topicPhaseRef.current = topicPhase;

  // Until the init effect sets up the store for THIS exam (it runs after first
  // paint), fall back to the server-provided first task. The oral store is a
  // global singleton, so on client navigation it can still hold a previous
  // exam's task — this stops the wrong task (e.g. Topic) flashing until reload.
  const storeReady = store.examId === examId;
  const currentTask: OralTaskType = storeReady ? store.currentTask : ((initialTask as OralTaskType) ?? taskOrder[0]);
  const taskIndex = storeReady ? store.taskIndex : Math.max(0, taskOrder.indexOf(currentTask));
  /** Set when a phase timer expires — the next respond call closes the task server-side. */
  const endTaskRef = useRef(false);
  /** Guards the init effect so the opening audio plays once (React StrictMode double-invokes effects in dev). */
  const didInitRef = useRef(false);

  // Initialize exam
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    // Start the store on the actual first task (the candidate may have skipped Topic).
    const firstTask = (initialTask as OralTaskType) ?? taskOrder[0];
    const firstIndex = Math.max(0, taskOrder.indexOf(firstTask));
    store.setExam(examId, level as import("@/types").ExamLevel, firstTask, firstIndex);
    if (initialMessage) {
      store.addMessage({
        id: "initial",
        role: "examiner",
        content: initialMessage,
        timestamp: Date.now(),
      });
      // Auto-play examiner's first message
      playExaminerAudio(initialMessage);
    }
    return () => {
      store.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [store.messages]);

  // Neural TTS via /api/tts (msedge-tts) — same engine in every browser.
  // The examiner voice is fixed so the whole exam sounds like one person.
  const { speak: ttsSpeak } = useEnglishTTS();
  const EXAMINER_VOICE = "en-GB-SoniaNeural";

  // Play examiner text with the neural voice. Returns once playback starts;
  // `isExaminerSpeaking` clears when the audio actually ends.
  const playExaminerAudio = useCallback(async (text: string) => {
    if (!text) return;
    store.setExaminerSpeaking(true);
    void ttsSpeak(text, {
      voice: EXAMINER_VOICE,
      onEnd: () => store.setExaminerSpeaking(false),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSpeak]);

  /**
   * Play the Listening passage. Trinity spec: candidate hears the recording TWICE.
   * After each play we update `listeningPlayCount`. When count reaches 2, fire the first comprehension question.
   */
  const playListeningPassage = useCallback(async () => {
    if (!listeningData?.listeningText) return;
    store.setExaminerSpeaking(true);
    void ttsSpeak(listeningData.listeningText, {
      voice: EXAMINER_VOICE,
      onEnd: () => {
        store.setExaminerSpeaking(false);
        setListeningPlayCount((prev) => {
          const next = prev + 1;
          if (next >= 2 && listeningData.questions && listeningData.questions.length > 0) {
            // Two plays complete — fire first comprehension question
            const firstQ = listeningData.questions[0];
            store.addMessage({
              id: `examiner-listening-q-0`,
              role: "examiner",
              content: firstQ,
              timestamp: Date.now(),
            });
            // Slight pause then speak the question
            setTimeout(() => playExaminerAudio(firstQ), 400);
          }
          return next;
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listeningData, playExaminerAudio, ttsSpeak]);

  // Recording: MediaRecorder + server-side Whisper STT (works in every browser,
  // unlike the Web Speech API which Chromium/Brave/Firefox cannot use).
  const stt = useSttRecorder({
    onTranscript: (text) => {
      store.setRecording(false);
      void processTranscript(text);
    },
    onError: (message) => {
      store.setRecording(false);
      store.setProcessing(false);
      setExamError(message);
      setShowTextFallback(true);
    },
  });

  const startRecording = useCallback(() => {
    setExamError(null);
    void stt.start();
    store.setRecording(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.start]);

  const stopRecording = useCallback(() => {
    stt.stop();
    // Show the processing indicator while the audio uploads + transcribes
    store.setProcessing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.stop]);

  // ── Formal Topic phases (ISE III/IV) ──────────────────────────────────────
  // Clear the phase once the exam moves off the Topic task. (Entry is handled by
  // the initial state above — Topic is always the first task when selected.)
  useEffect(() => {
    if (currentTask !== "TOPIC" && topicPhase !== null) {
      setTopicPhase(null);
      setPhaseTimeLeft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTask, topicPhase]);

  // Tick the phase timer. Presentation counts down only while the candidate is
  // actually speaking; discussion runs continuously like the real exam clock.
  const phaseTimerActive =
    topicPhase !== null &&
    phaseTimeLeft !== null &&
    phaseTimeLeft > 0 &&
    !store.isExamFinished &&
    (topicPhase === "presentation" ? stt.isRecording : true);

  useEffect(() => {
    if (!phaseTimerActive) return;
    const id = setInterval(() => {
      setPhaseTimeLeft((s) => (s === null || s <= 0 ? s : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [phaseTimerActive]);

  // Phase timer expiry
  useEffect(() => {
    if (phaseTimeLeft !== 0 || topicPhase === null) return;
    if (topicPhase === "presentation") {
      // Presentation time over — stop the recording; the transcript flows into
      // processTranscript, which flips the phase to discussion.
      if (stt.isRecording) stopRecording();
    } else {
      // Discussion time over — close the Topic task after the current turn.
      endTaskRef.current = true;
      if (stt.isRecording) {
        stopRecording();
      } else if (!store.isProcessing && !store.isExaminerSpeaking) {
        void processTranscript("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseTimeLeft, topicPhase]);

  // Process transcript: send to examiner → get response → speak
  const processTranscript = useCallback(
    async (candidateText: string) => {
      store.setProcessing(true);
      const endTask = endTaskRef.current;
      endTaskRef.current = false;

      try {
        // Add candidate message (skipped when a timer expired with no final answer)
        if (candidateText) {
          const candidateMsg: OralMessage = {
            id: `candidate-${Date.now()}`,
            role: "candidate",
            content: candidateText,
            timestamp: Date.now(),
          };
          store.addMessage(candidateMsg);
        }

        // Send to examiner AI
        const respondRes = await fetch("/api/exam/oral/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examId,
            taskType: store.currentTask,
            candidateText,
            exchangeCount: exchangeCount + 1,
            ...(endTask ? { endTask: true } : {}),
          }),
        });

        if (!respondRes.ok) throw new Error("Respond failed");
        const data = await respondRes.json();

        // Formal Topic levels: the first processed turn IS the presentation —
        // switch to the timed discussion phase.
        if (topicPhaseRef.current === "presentation" && !data.isTaskTransition && formalTiming) {
          setTopicPhase("discussion");
          setPhaseTimeLeft(formalTiming.discussion);
        }

        // Handle task transitions
        if (data.isTaskTransition) {
          const newTask = data.taskType as OralTaskType;
          const newIndex = taskOrder.indexOf(newTask);
          store.setCurrentTask(newTask, newIndex);
          setExchangeCount(1);

          if (newTask === "LISTENING" && data.listeningData) {
            setListeningData(data.listeningData);
          }
        } else {
          setExchangeCount((prev) => prev + 1);
        }

        // Handle exam finished
        if (data.isExamFinished) {
          store.addMessage({
            id: `examiner-${Date.now()}`,
            role: "examiner",
            content: data.examinerMessage,
            timestamp: Date.now(),
          });
          await playExaminerAudio(data.examinerMessage);
          store.setExamFinished(true);
          store.setProcessing(false);
          return;
        }

        // Add examiner response
        if (data.examinerMessage) {
          store.addMessage({
            id: `examiner-${Date.now()}`,
            role: "examiner",
            content: data.examinerMessage,
            timestamp: Date.now(),
          });
          await playExaminerAudio(data.examinerMessage);
        }
      } catch (error) {
        console.error("Error processing response:", error);
        alert("Something went wrong. Please try again.");
      } finally {
        store.setProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [examId, store.currentTask, exchangeCount, playExaminerAudio]
  );

  // Evaluate the exam
  const evaluateExam = useCallback(async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch("/api/exam/oral/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });

      if (!res.ok) throw new Error("Evaluation failed");

      router.push(`/results/${examId}?type=oral`);
    } catch (error) {
      console.error("Error evaluating:", error);
      alert("Failed to evaluate exam. Please try again.");
      setIsEvaluating(false);
    }
  }, [examId, router]);

  const currentTaskInfo = TASK_LABELS[currentTask];
  const taskProgress = ((taskIndex + 1) / taskOrder.length) * 100;

  const canRecord =
    !store.isExaminerSpeaking &&
    !store.isRecording &&
    !store.isProcessing &&
    !store.isExamFinished;

  // For listening: button visible until two plays complete (Trinity spec: hears twice)
  const showPlayListening =
    currentTask === "LISTENING" && listeningData && listeningPlayCount < 2;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start sm:items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Oral Exam — {level.replace("_", " ")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Speak clearly into your microphone
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {currentTaskInfo.icon} {currentTaskInfo.label}
        </Badge>
      </div>

      {/* Task Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-zinc-500 mb-2">
          <span>Progress</span>
          <span>
            Task {taskIndex + 1} of {taskOrder.length}
          </span>
        </div>
        <Progress value={taskProgress} className="h-2" />
        <div className="mt-2 flex justify-between overflow-x-auto gap-2">
          {taskOrder.map((task, i) => (
            <div
              key={task}
              className={`flex items-center gap-1 text-xs ${
                i <= taskIndex
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-zinc-400"
              }`}
            >
              {i < taskIndex ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <MessageSquare className="h-3 w-3" />
              )}
              {TASK_LABELS[task].label.split(" ")[0]}
            </div>
          ))}
        </div>
      </div>

      {/* Current Task Description */}
      <Card className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>{currentTaskInfo.label}:</strong> {currentTaskInfo.description}
          </p>
        </CardContent>
      </Card>

      {/* Formal Topic phase banner (ISE III/IV): timed presentation → timed discussion */}
      {topicPhase && phaseTimeLeft !== null && formalTiming && (
        <Card className={`mb-4 ${phaseTimeLeft <= 30 ? "border-red-300 dark:border-red-800" : "border-zinc-200 dark:border-zinc-700"}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {topicPhase === "presentation" ? "Phase 1 — Formal presentation" : "Phase 2 — Topic discussion"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {topicPhase === "presentation"
                    ? "Deliver your prepared presentation. The clock runs while you speak; the examiner listens without interrupting."
                    : "The examiner now asks questions about your presentation. Defend your ideas — the clock keeps running."}
                </p>
              </div>
              <div className={`flex items-center gap-2 font-mono text-2xl font-bold tabular-nums ${phaseTimeLeft <= 30 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-50"}`}>
                <Clock className="h-5 w-5" />
                {formatTime(phaseTimeLeft)}
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${phaseTimeLeft <= 30 ? "bg-red-500" : "bg-blue-500"}`}
                style={{
                  width: `${(phaseTimeLeft / (topicPhase === "presentation" ? formalTiming.presentation : formalTiming.discussion)) * 100}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation Area */}
      <Card className="mb-4">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium text-zinc-500">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[50vh] sm:h-[400px] min-h-[200px] overflow-y-auto p-4 space-y-4">
            {store.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "candidate"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold opacity-70">
                      {msg.role === "candidate" ? "You" : "Examiner"}
                    </span>
                    {msg.role === "examiner" && (
                      <button
                        type="button"
                        onClick={() => playExaminerAudio(msg.content)}
                        disabled={store.isExaminerSpeaking}
                        title="Play again"
                        aria-label="Play again"
                        className="ml-auto inline-flex items-center justify-center rounded-full p-1 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-40"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Status indicators */}
            {store.isExaminerSpeaking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 px-4 py-3">
                  <Volume2 className="h-4 w-4 text-blue-600 animate-pulse" />
                  <span className="text-sm text-zinc-500">Examiner is speaking...</span>
                </div>
              </div>
            )}

            {store.isProcessing && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 rounded-full bg-zinc-100 dark:bg-zinc-800 px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  <span className="text-sm text-zinc-500">Processing your response...</span>
                </div>
              </div>
            )}

            {store.isRecording && (
              <div className="flex justify-end">
                <div className="flex items-center gap-2 rounded-2xl bg-red-100 dark:bg-red-900 px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm text-red-700 dark:text-red-300">Recording...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4">
        {examError && (
          <div className="w-full rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {examError}
          </div>
        )}
        {store.isExamFinished ? (
          // Exam finished — show evaluate button
          <div className="text-center space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Exam completed!</span>
            </div>
            <Button
              size="lg"
              onClick={evaluateExam}
              disabled={isEvaluating}
              className="gap-2"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Evaluating your performance...
                </>
              ) : (
                <>
                  View Results
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            {isPro && (
              <p className="text-xs text-zinc-500">
                Pro users get detailed feedback on pronunciation, grammar, vocabulary, and fluency.
              </p>
            )}
          </div>
        ) : showPlayListening ? (
          // Listening task — play audio button. Trinity spec: candidate hears recording TWICE.
          <div className="text-center space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {listeningPlayCount === 0
                ? "Listen carefully — you will hear this passage TWICE before the questions."
                : "Listen again. After the second play the examiner will ask the comprehension questions."}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 tabular-nums">
              Play {listeningPlayCount + 1} of 2
            </p>
            <Button
              size="lg"
              onClick={playListeningPassage}
              disabled={store.isExaminerSpeaking}
              className="gap-2"
              variant="secondary"
            >
              {store.isExaminerSpeaking ? (
                <>
                  <Volume2 className="h-5 w-5 animate-pulse" />
                  Playing passage...
                </>
              ) : (
                <>
                  <Volume2 className="h-5 w-5" />
                  {listeningPlayCount === 0 ? "Play Listening Passage (1st time)" : "Play Listening Passage (2nd time)"}
                </>
              )}
            </Button>
          </div>
        ) : showTextFallback ? (
          // Text fallback mode
          <div className="w-full space-y-2">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={3}
              placeholder="Type your response here..."
              disabled={!canRecord}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && textInput.trim().length > 0 && canRecord) {
                  e.preventDefault();
                  const text = textInput.trim();
                  setTextInput("");
                  processTranscript(text);
                }
              }}
            />
            <div className="flex items-center justify-between">
              <button
                className="text-xs text-zinc-400 hover:text-zinc-600 underline"
                onClick={() => setShowTextFallback(false)}
              >
                Switch to microphone
              </button>
              <Button
                size="sm"
                disabled={!canRecord || textInput.trim().length === 0}
                onClick={() => {
                  const text = textInput.trim();
                  setTextInput("");
                  processTranscript(text);
                }}
              >
                Send
              </Button>
            </div>
          </div>
        ) : (
          // Normal recording controls
          <div className="flex flex-col items-center gap-3">
            {store.isRecording && (
              <div className="flex flex-col items-center gap-1">
                <MicWaveform stream={stt.stream} className="h-12" />
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  The examiner is listening...
                </p>
              </div>
            )}
            <Button
              size="lg"
              variant={store.isRecording ? "destructive" : "default"}
              className="h-16 w-16 rounded-full p-0"
              disabled={!canRecord && !store.isRecording}
              onClick={store.isRecording ? stopRecording : startRecording}
            >
              {store.isRecording ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {store.isRecording
                ? topicPhase === "presentation"
                  ? "Presenting — click to finish your presentation early"
                  : "Click to stop recording"
                : store.isProcessing
                  ? "Processing..."
                  : store.isExaminerSpeaking
                    ? "Wait for the examiner to finish"
                    : topicPhase === "presentation"
                      ? "Click to START your formal presentation — the clock begins when you speak"
                      : "Click to start speaking"}
            </p>
            <button
              className="text-xs text-zinc-400 hover:text-zinc-600 underline"
              onClick={() => setShowTextFallback(true)}
            >
              Can&apos;t use microphone? Type instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
