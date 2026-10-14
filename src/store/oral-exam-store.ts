import { create } from "zustand";
import type { ExamLevel, OralTaskType } from "@/types";

export interface OralMessage {
  id: string;
  role: "examiner" | "candidate";
  content: string;
  audioUrl?: string;
  timestamp: number;
}

interface OralExamState {
  examId: string | null;
  level: ExamLevel | null;
  currentTask: OralTaskType;
  taskIndex: number;
  messages: OralMessage[];
  isExaminerSpeaking: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  isExamFinished: boolean;
  topicInput: string;

  // Actions
  setExam: (examId: string, level: ExamLevel, firstTask?: OralTaskType, firstIndex?: number) => void;
  setCurrentTask: (task: OralTaskType, index: number) => void;
  addMessage: (msg: OralMessage) => void;
  setExaminerSpeaking: (speaking: boolean) => void;
  setRecording: (recording: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setExamFinished: (finished: boolean) => void;
  setTopicInput: (topic: string) => void;
  reset: () => void;
}

const TASK_ORDER: OralTaskType[] = ["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"];

export const useOralExamStore = create<OralExamState>((set) => ({
  examId: null,
  level: null,
  currentTask: "TOPIC",
  taskIndex: 0,
  messages: [],
  isExaminerSpeaking: false,
  isRecording: false,
  isProcessing: false,
  isExamFinished: false,
  topicInput: "",

  setExam: (examId, level, firstTask = "TOPIC", firstIndex = 0) =>
    set({ examId, level, currentTask: firstTask, taskIndex: firstIndex, messages: [], isExamFinished: false }),
  setCurrentTask: (task, index) => set({ currentTask: task, taskIndex: index }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setExaminerSpeaking: (speaking) => set({ isExaminerSpeaking: speaking }),
  setRecording: (recording) => set({ isRecording: recording }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setExamFinished: (finished) => set({ isExamFinished: finished }),
  setTopicInput: (topic) => set({ topicInput: topic }),
  reset: () =>
    set({
      examId: null,
      level: null,
      currentTask: "TOPIC",
      taskIndex: 0,
      messages: [],
      isExaminerSpeaking: false,
      isRecording: false,
      isProcessing: false,
      isExamFinished: false,
      topicInput: "",
    }),
}));

export { TASK_ORDER };
