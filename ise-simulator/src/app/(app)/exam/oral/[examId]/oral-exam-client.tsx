"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

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
} from "lucide-react";
import { useOralExamStore, TASK_ORDER } from "@/store/oral-exam-store";
import type { OralMessage } from "@/store/oral-exam-store";
import type { OralTaskType } from "@/types";

const TASK_LABELS: Record<OralTaskType, { label: string; description: string; icon: string }> = {
  TOPIC: {
    label: "Topic Task",
    description: "Present your prepared topic. The examiner will ask follow-up questions.",
    icon: "🎤",
  },
  COLLABORATIVE: {
    label: "Collaborative Task",
    description: "Discuss a topic with the examiner. Share opinions and ideas.",
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
}

export function OralExamClient({ examId, level, initialMessage, isPro }: OralExamClientProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<unknown>(null);

  const store = useOralExamStore();
  const [exchangeCount, setExchangeCount] = useState(1);
  const [listeningData, setListeningData] = useState<{
    listeningText?: string;
    introduction?: string;
    questions?: string[];
  } | null>(null);
  const [currentListeningQuestion, setCurrentListeningQuestion] = useState(0);
  const [hasPlayedListening, setHasPlayedListening] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextFallback, setShowTextFallback] = useState(false);

  // Initialize exam
  useEffect(() => {
    store.setExam(examId, level as import("@/types").ExamLevel);
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

  // Play examiner text as speech using Web Speech API (free)
  const playExaminerAudio = useCallback(async (text: string) => {
    store.setExaminerSpeaking(true);
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-GB";
      utterance.rate = 0.95;
      utterance.pitch = 1;
      // Try to find a natural English voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(
        (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")
      ) || voices.find((v) => v.lang.startsWith("en-GB")) || voices.find((v) => v.lang.startsWith("en"));
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => store.setExaminerSpeaking(false);
      utterance.onerror = () => store.setExaminerSpeaking(false);

      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      window.speechSynthesis.speak(utterance);
    } catch {
      store.setExaminerSpeaking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play listening passage audio using Web Speech API (free)
  const playListeningPassage = useCallback(async () => {
    if (!listeningData?.listeningText) return;
    store.setExaminerSpeaking(true);
    try {
      const utterance = new SpeechSynthesisUtterance(listeningData.listeningText);
      utterance.lang = "en-GB";
      utterance.rate = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(
        (v) => v.lang.startsWith("en-GB")
      ) || voices.find((v) => v.lang.startsWith("en"));
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onend = () => {
        store.setExaminerSpeaking(false);
        setHasPlayedListening(true);
        // After listening ends, ask the first question
        if (listeningData.questions && listeningData.questions.length > 0) {
          const firstQ = listeningData.questions[0];
          store.addMessage({
            id: `examiner-listening-q-0`,
            role: "examiner",
            content: firstQ,
            timestamp: Date.now(),
          });
          playExaminerAudio(firstQ);
        }
      };
      utterance.onerror = () => {
        store.setExaminerSpeaking(false);
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      store.setExaminerSpeaking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listeningData, playExaminerAudio]);

  // Start recording using Web Speech Recognition API (free)
  const startRecording = useCallback(async () => {
    try {
      const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition as (new () => SpeechRecognitionInstance) | undefined
        || (window as unknown as Record<string, unknown>).webkitSpeechRecognition as (new () => SpeechRecognitionInstance) | undefined;
      if (!SpeechRecognition) {
        setExamError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = false;

      let finalTranscript = "";

      recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          }
        }
      };

      recognition.onerror = (event: { error: string }) => {
        console.error("Speech recognition error:", event.error);
        store.setRecording(false);
      };

      recognition.onend = async () => {
        store.setRecording(false);
        if (finalTranscript.trim().length > 0) {
          await processTranscript(finalTranscript.trim());
        } else {
          setExamError("Could not understand. Please try again and speak clearly.");
        }
      };

      mediaRecorderRef.current = recognition as unknown as MediaRecorder;
      recognition.start();
      store.setRecording(true);
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      alert("Please allow microphone access to take the oral exam.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.currentTask, exchangeCount]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      (mediaRecorderRef.current as unknown as { stop: () => void }).stop();
    }
  }, []);

  // Process transcript: send to examiner → get response → speak
  const processTranscript = useCallback(
    async (candidateText: string) => {
      store.setProcessing(true);

      try {
        // Add candidate message
        const candidateMsg: OralMessage = {
          id: `candidate-${Date.now()}`,
          role: "candidate",
          content: candidateText,
          timestamp: Date.now(),
        };
        store.addMessage(candidateMsg);

        // Send to examiner AI
        const respondRes = await fetch("/api/exam/oral/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examId,
            taskType: store.currentTask,
            candidateText,
            exchangeCount: exchangeCount + 1,
          }),
        });

        if (!respondRes.ok) throw new Error("Respond failed");
        const data = await respondRes.json();

        // Handle task transitions
        if (data.isTaskTransition) {
          const newTask = data.taskType as OralTaskType;
          const newIndex = TASK_ORDER.indexOf(newTask);
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

  const currentTaskInfo = TASK_LABELS[store.currentTask];
  const taskProgress = ((store.taskIndex + 1) / TASK_ORDER.length) * 100;

  const canRecord =
    !store.isExaminerSpeaking &&
    !store.isRecording &&
    !store.isProcessing &&
    !store.isExamFinished;

  // For listening: check if we need to show the "Play Listening" button
  const showPlayListening =
    store.currentTask === "LISTENING" && listeningData && !hasPlayedListening;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
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
            Task {store.taskIndex + 1} of {TASK_ORDER.length}
          </span>
        </div>
        <Progress value={taskProgress} className="h-2" />
        <div className="mt-2 flex justify-between">
          {TASK_ORDER.map((task, i) => (
            <div
              key={task}
              className={`flex items-center gap-1 text-xs ${
                i <= store.taskIndex
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-zinc-400"
              }`}
            >
              {i < store.taskIndex ? (
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

      {/* Conversation Area */}
      <Card className="mb-4">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium text-zinc-500">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[400px] overflow-y-auto p-4 space-y-4">
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
          // Listening task — play audio button
          <div className="text-center space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Listen carefully to the passage. You will be asked questions afterwards.
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
                  Play Listening Passage
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
                ? "Click to stop recording"
                : store.isProcessing
                  ? "Processing..."
                  : store.isExaminerSpeaking
                    ? "Wait for the examiner to finish"
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
