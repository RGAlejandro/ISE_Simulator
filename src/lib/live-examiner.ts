import { LIVE_MAX_MINUTES, LIVE_MODELS, LIVE_TASKS, ORAL_TASK_MINUTES } from "@/lib/constants";
import { getPersona } from "@/lib/examiner-personas";
import { getLiveExaminerPrompt, type LiveTask, type LiveTaskPlan } from "@/lib/prompts/oral-exam";
import type { ExamLevel } from "@/types";

/**
 * Live Examiner — server side.
 *
 * The browser talks to Gemini Live directly over a WebSocket (lowest latency),
 * but only with a short-lived, single-use ephemeral token minted here. The whole
 * session setup (model, system prompt, voice, tools) is locked into the token,
 * so the client cannot change the examiner's instructions, and the API key
 * never leaves the server.
 */

export const LIVE_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

/** Order the live tasks canonically and give each its official duration, scaled to fit the session cap. */
export function buildLivePlan(level: ExamLevel, selected: string[]): LiveTaskPlan[] {
  const minutes = ORAL_TASK_MINUTES[level] ?? {};
  const tasks = LIVE_TASKS.filter((t) => selected.includes(t) && minutes[t] !== undefined);
  const total = tasks.reduce((sum, t) => sum + (minutes[t] ?? 0), 0);
  const scale = total > LIVE_MAX_MINUTES ? LIVE_MAX_MINUTES / total : 1;
  return tasks.map((task) => ({ task, minutes: Math.max(2, Math.round((minutes[task] ?? 3) * scale)) }));
}

function liveTools(plan: LiveTaskPlan[]) {
  const nextTasks = plan.slice(1).map((p) => p.task);
  const declarations: object[] = [
    {
      name: "end_exam",
      description: "Call once, right after saying goodbye at the end of the LAST task. Ends the exam.",
    },
  ];
  if (nextTasks.length > 0) {
    declarations.unshift({
      name: "advance_task",
      description: "Move the exam on to the next task in the running order. Call it before speaking the new task's opening line.",
      parameters: {
        type: "OBJECT",
        properties: { task: { type: "STRING", enum: nextTasks, description: "The task that starts now." } },
        required: ["task"],
      },
    });
  }
  return [{ functionDeclarations: declarations }];
}

export interface LiveExamContext {
  level: ExamLevel;
  personaId: string | null;
  selectedTasks: string[];
  topicGeneral: string | null;
  topicDetailed: string | null;
}

export function buildLiveSetup(exam: LiveExamContext, model: string, resumeHandle?: string) {
  const plan = buildLivePlan(exam.level, exam.selectedTasks);
  const topic = exam.topicGeneral?.split("\n").find((l) => l.trim())?.trim() || "the candidate's prepared topic";
  const persona = getPersona(exam.personaId);
  return {
    plan,
    setup: {
      model: `models/${model}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        temperature: 0.8,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.liveVoice } } },
      },
      systemInstruction: {
        parts: [{ text: getLiveExaminerPrompt(exam.level, exam.personaId, plan, topic, { general: exam.topicGeneral, detailed: exam.topicDetailed }) }],
      },
      tools: liveTools(plan),
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Exam candidates pause to think: only end their turn after a clear silence.
      realtimeInputConfig: {
        automaticActivityDetection: { endOfSpeechSensitivity: "END_SENSITIVITY_LOW", silenceDurationMs: 1000 },
      },
      // Long exams: keep the context bounded and allow reconnecting after GoAway.
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
    },
  };
}

/** Mint a single-use ephemeral token with the session setup locked in. */
export async function mintLiveToken(setup: object): Promise<{ token: string; expiresAt: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const now = Date.now();
  const expiresAt = new Date(now + 30 * 60_000).toISOString();
  const res = await fetch("https://generativelanguage.googleapis.com/v1alpha/auth_tokens", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      uses: 1,
      expireTime: expiresAt,
      // The WebSocket must be opened within 2 minutes of minting.
      newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
      bidiGenerateContentSetup: setup,
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
  if (!res.ok || !data.name) {
    throw new Error(`Live token mint failed (${res.status}): ${data.error?.message ?? "no token"}`);
  }
  return { token: data.name, expiresAt };
}

export function liveModelFor(attempt: number): string | null {
  return LIVE_MODELS[attempt] ?? null;
}

export function isLiveTask(t: string): t is LiveTask {
  return (LIVE_TASKS as readonly string[]).includes(t);
}
