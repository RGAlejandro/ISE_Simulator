import { create } from "zustand";
import type { ExamLevel, ListeningRound1Feedback, ListeningRound2Feedback } from "@/types";

export type ListeningPhase =
  | "idle"
  | "round1_listen"
  | "round1_respond"
  | "round1_feedback"
  | "round2_listen"
  | "round2_respond"
  | "evaluating"
  | "done";

interface ListeningStore {
  sessionId: string | null;
  level: ExamLevel | null;
  passageText: string;
  passageTitle: string;
  passageTopic: string;
  informationType: string;
  phase: ListeningPhase;
  round1Response: string;
  round1Feedback: ListeningRound1Feedback | null;
  round2Response: string;
  round2Feedback: ListeningRound2Feedback | null;
  overallScore: number | null;
  isPlaying: boolean;
  isRecording: boolean;
  hasPlayedRound1: boolean;
  hasPlayedRound2: boolean;
  timer: number | null;
  error: string | null;

  setSession: (
    sessionId: string,
    level: ExamLevel,
    passageText: string,
    passageTitle: string,
    passageTopic: string,
    informationType: string
  ) => void;
  setPhase: (phase: ListeningPhase) => void;
  setPlaying: (val: boolean) => void;
  setRecording: (val: boolean) => void;
  setHasPlayedRound1: (val: boolean) => void;
  setHasPlayedRound2: (val: boolean) => void;
  setRound1Response: (text: string) => void;
  setRound1Feedback: (feedback: ListeningRound1Feedback) => void;
  setRound2Response: (text: string) => void;
  setRound2Feedback: (feedback: ListeningRound2Feedback, overallScore: number) => void;
  setTimer: (seconds: number | null) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  level: null,
  passageText: "",
  passageTitle: "",
  passageTopic: "",
  informationType: "",
  phase: "idle" as ListeningPhase,
  round1Response: "",
  round1Feedback: null,
  round2Response: "",
  round2Feedback: null,
  overallScore: null,
  isPlaying: false,
  isRecording: false,
  hasPlayedRound1: false,
  hasPlayedRound2: false,
  timer: null,
  error: null,
};

export const useListeningStore = create<ListeningStore>((set) => ({
  ...initialState,

  setSession: (sessionId, level, passageText, passageTitle, passageTopic, informationType) =>
    set({ sessionId, level, passageText, passageTitle, passageTopic, informationType, phase: "round1_listen" }),

  setPhase: (phase) => set({ phase }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setRecording: (isRecording) => set({ isRecording }),
  setHasPlayedRound1: (hasPlayedRound1) => set({ hasPlayedRound1 }),
  setHasPlayedRound2: (hasPlayedRound2) => set({ hasPlayedRound2 }),
  setRound1Response: (round1Response) => set({ round1Response }),
  setRound2Response: (round2Response) => set({ round2Response }),

  setRound1Feedback: (feedback) =>
    set({ round1Feedback: feedback, phase: "round1_feedback" }),

  setRound2Feedback: (feedback, overallScore) =>
    set({ round2Feedback: feedback, overallScore, phase: "done" }),

  setTimer: (timer) => set({ timer }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
