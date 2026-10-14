import { create } from "zustand";
import type { ExamLevel, WrittenExamContent } from "@/types";

interface ExamState {
  // Written exam state
  currentExam: WrittenExamContent | null;
  examId: string | null;
  currentTask: number;
  responses: Record<string, string>;
  readingAnswers: Record<string, string>;
  timeRemaining: number;
  isTimerRunning: boolean;

  // Actions
  setExam: (exam: WrittenExamContent, examId: string) => void;
  setCurrentTask: (task: number) => void;
  setResponse: (taskKey: string, response: string) => void;
  setReadingAnswer: (questionId: string, answer: string) => void;
  setTimeRemaining: (time: number) => void;
  setTimerRunning: (running: boolean) => void;
  reset: () => void;
}

export const useExamStore = create<ExamState>((set) => ({
  currentExam: null,
  examId: null,
  currentTask: 0,
  responses: {},
  readingAnswers: {},
  timeRemaining: 0,
  isTimerRunning: false,

  setExam: (exam, examId) => set({ currentExam: exam, examId, currentTask: 0, responses: {}, readingAnswers: {} }),
  setCurrentTask: (task) => set({ currentTask: task }),
  setResponse: (taskKey, response) =>
    set((state) => ({ responses: { ...state.responses, [taskKey]: response } })),
  setReadingAnswer: (questionId, answer) =>
    set((state) => ({ readingAnswers: { ...state.readingAnswers, [questionId]: answer } })),
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  setTimerRunning: (running) => set({ isTimerRunning: running }),
  reset: () =>
    set({
      currentExam: null,
      examId: null,
      currentTask: 0,
      responses: {},
      readingAnswers: {},
      timeRemaining: 0,
      isTimerRunning: false,
    }),
}));
