import { beforeEach, describe, expect, it } from "vitest";
import { useExamStore } from "@/store/exam-store";
import { useListeningStore } from "@/store/listening-store";
import { TASK_ORDER, useOralExamStore } from "@/store/oral-exam-store";

describe("written exam store", () => {
  beforeEach(() => useExamStore.getState().reset());

  it("loads an exam and records answers", () => {
    const s = useExamStore.getState();
    s.setResponse("old", "x");
    s.setExam({ level: "ISE_II" } as never, "exam-1");
    s.setCurrentTask(2);
    s.setResponse("task3", "Dear Sir");
    s.setReadingAnswer("q1", "A");
    s.setTimeRemaining(120);
    s.setTimerRunning(true);
    expect(useExamStore.getState()).toMatchObject({
      examId: "exam-1", currentTask: 2, responses: { task3: "Dear Sir" }, readingAnswers: { q1: "A" }, timeRemaining: 120, isTimerRunning: true,
    });
    useExamStore.getState().reset();
    expect(useExamStore.getState()).toMatchObject({ currentExam: null, examId: null, responses: {}, isTimerRunning: false });
  });
});

describe("listening store", () => {
  beforeEach(() => useListeningStore.getState().reset());

  it("walks through both rounds", () => {
    const s = useListeningStore.getState();
    s.setSession("s1", "ISE_II", "Text", "Title", "Topic", "facts");
    expect(useListeningStore.getState().phase).toBe("round1_listen");
    s.setPlaying(true);
    s.setRecording(true);
    s.setHasPlayedRound1(true);
    s.setRound1Response("summary");
    s.setRound1Feedback({ score: 3 } as never);
    expect(useListeningStore.getState().phase).toBe("round1_feedback");
    s.setPhase("round2_listen");
    s.setHasPlayedRound2(true);
    s.setRound2Response("notes");
    s.setTimer(30);
    s.setError("oops");
    s.setRound2Feedback({ score: 4 } as never, 78);
    expect(useListeningStore.getState()).toMatchObject({
      phase: "done", overallScore: 78, round1Response: "summary", round2Response: "notes", isPlaying: true, isRecording: true,
      hasPlayedRound1: true, hasPlayedRound2: true, timer: 30, error: "oops",
    });
    s.reset();
    expect(useListeningStore.getState()).toMatchObject({ phase: "idle", sessionId: null, overallScore: null });
  });
});

describe("oral exam store", () => {
  beforeEach(() => useOralExamStore.getState().reset());

  it("tracks the task, messages and flags", () => {
    expect(TASK_ORDER).toEqual(["TOPIC", "COLLABORATIVE", "CONVERSATION", "LISTENING"]);
    const s = useOralExamStore.getState();
    s.setExam("e1", "ISE_I");
    expect(useOralExamStore.getState()).toMatchObject({ currentTask: "TOPIC", taskIndex: 0 });
    s.setExam("e2", "ISE_III", "CONVERSATION", 2);
    s.addMessage({ id: "m1", role: "examiner", content: "Hello", timestamp: 1 });
    s.addMessage({ id: "m2", role: "candidate", content: "Hi", timestamp: 2 });
    s.setCurrentTask("LISTENING", 3);
    s.setExaminerSpeaking(true);
    s.setRecording(true);
    s.setProcessing(true);
    s.setExamFinished(true);
    s.setTopicInput("Bees");
    expect(useOralExamStore.getState()).toMatchObject({
      examId: "e2", level: "ISE_III", currentTask: "LISTENING", taskIndex: 3, isExaminerSpeaking: true, isRecording: true,
      isProcessing: true, isExamFinished: true, topicInput: "Bees",
    });
    expect(useOralExamStore.getState().messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    s.reset();
    expect(useOralExamStore.getState()).toMatchObject({ examId: null, messages: [], isExamFinished: false, topicInput: "" });
  });
});
