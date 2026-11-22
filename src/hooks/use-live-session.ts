"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LIVE_CONTROL_PREFIX, LIVE_MAX_MINUTES, LIVE_MODELS } from "@/lib/constants";
import { computeLiveMetrics, type LiveRole, type LiveTurn } from "@/lib/live-metrics";

/**
 * Live Examiner client: a full-duplex voice session with Gemini Live.
 *
 *  mic ─► AudioWorklet (16 kHz PCM16) ─► WebSocket ─► Gemini Live
 *  speakers ◄─ scheduled AudioBuffers (24 kHz PCM16) ◄─┘   + transcripts + tool calls
 *
 * The socket uses a single-use ephemeral token whose setup (prompt, voice,
 * tools) was locked server-side. The examiner drives task changes through
 * tool calls (advance_task / end_exam); the exam software only sends
 * "[EXAM CONTROL]" nudges when a task runs over time.
 */

export type LiveTask = "TOPIC" | "COLLABORATIVE" | "CONVERSATION";
export interface LivePlanItem {
  task: LiveTask;
  minutes: number;
}
export type LiveStatus = "idle" | "connecting" | "live" | "reconnecting" | "ending" | "saving" | "evaluating" | "error";
export type LiveErrorKind = "mic" | "connect" | "dropped" | "save" | "expired";

interface TokenResponse {
  token: string;
  wsUrl: string;
  model: string;
  hasFallback: boolean;
  error?: string;
}

class TokenError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// ─── small binary helpers ───────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function readMessage(data: unknown): Promise<Record<string, unknown> | null> {
  try {
    const text = typeof data === "string" ? data : data instanceof Blob ? await data.text() : new TextDecoder().decode(data as ArrayBuffer);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Gemini Live message shapes (only the fields we use).
interface ServerContent {
  modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
  inputTranscription?: { text?: string };
  outputTranscription?: { text?: string };
  interrupted?: boolean;
  turnComplete?: boolean;
}
interface FunctionCall {
  id: string;
  name: string;
  args?: { task?: string };
}

export function useLiveSession({ examId, plan, onEvaluated }: { examId: string; plan: LivePlanItem[]; onEvaluated: () => void }) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<{ kind: LiveErrorKind; message: string } | null>(null);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [taskElapsed, setTaskElapsed] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [examinerSpeaking, setExaminerSpeaking] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [model, setModel] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const readyRef = useRef(false);
  const attemptRef = useRef(0);
  const resumeHandleRef = useRef<string | null>(null);
  const reconnectsRef = useRef(0);
  const endingRef = useRef(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const outGainRef = useRef<GainNode | null>(null);
  const outAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const drainWaitersRef = useRef<(() => void)[]>([]);

  const turnsRef = useRef<LiveTurn[]>([]);
  const examinerOpenRef = useRef(false);
  const flushPendingRef = useRef(false);
  const taskIndexRef = useRef(0);
  const taskStartedRef = useRef(0);
  const startedRef = useRef(0);
  const nudgedRef = useRef(new Set<number>());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── transcript ───────────────────────────────────────────────────────────

  const scheduleFlush = useCallback(() => {
    if (flushPendingRef.current) return;
    flushPendingRef.current = true;
    requestAnimationFrame(() => {
      flushPendingRef.current = false;
      setTurns([...turnsRef.current]);
    });
  }, []);

  const appendTranscript = useCallback(
    (role: LiveRole, chunk: string) => {
      if (!chunk) return;
      const now = Date.now();
      const list = turnsRef.current;
      const last = list[list.length - 1];
      const task = plan[taskIndexRef.current]?.task ?? plan[0].task;
      const canAppend = last && last.role === role && last.task === task && (role === "CANDIDATE" || examinerOpenRef.current);
      if (canAppend) {
        list[list.length - 1] = { ...last, text: last.text + chunk, endedAt: now };
      } else {
        list.push({ id: `${role[0]}${now}-${list.length}`, role, task, text: chunk.trimStart(), startedAt: now, endedAt: now });
      }
      if (role === "EXAMINER") examinerOpenRef.current = true;
      scheduleFlush();
    },
    [plan, scheduleFlush],
  );

  // ─── playback ─────────────────────────────────────────────────────────────

  const settleDrain = useCallback(() => {
    if (sourcesRef.current.size > 0) return;
    setExaminerSpeaking(false);
    const waiters = drainWaitersRef.current.splice(0);
    waiters.forEach((w) => w());
  }, []);

  const playPcm = useCallback(
    (b64: string) => {
      const ctx = ctxRef.current;
      const out = outGainRef.current;
      if (!ctx || !out) return;
      const bytes = base64ToBytes(b64);
      const pcm = new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1);
      if (pcm.length === 0) return;
      const buf = ctx.createBuffer(1, pcm.length, 24000);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(out);
      const at = Math.max(ctx.currentTime + 0.03, nextTimeRef.current);
      src.start(at);
      nextTimeRef.current = at + buf.duration;
      sourcesRef.current.add(src);
      setExaminerSpeaking(true);
      src.onended = () => {
        sourcesRef.current.delete(src);
        settleDrain();
      };
    },
    [settleDrain],
  );

  const flushPlayback = useCallback(() => {
    for (const s of sourcesRef.current) {
      try {
        s.onended = null;
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    sourcesRef.current.clear();
    nextTimeRef.current = 0;
    settleDrain();
  }, [settleDrain]);

  const waitForDrain = useCallback((maxMs: number) => {
    return new Promise<void>((resolve) => {
      if (sourcesRef.current.size === 0) return resolve();
      const t = setTimeout(resolve, maxMs);
      drainWaitersRef.current.push(() => {
        clearTimeout(t);
        resolve();
      });
    });
  }, []);

  // ─── socket send helpers ──────────────────────────────────────────────────

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && readyRef.current) ws.send(JSON.stringify(msg));
  }, []);

  const sendControl = useCallback(
    (text: string, viaRealtime: boolean) => {
      const full = `${LIVE_CONTROL_PREFIX} ${text}`;
      if (viaRealtime) send({ realtimeInput: { text: full } });
      else send({ clientContent: { turns: [{ role: "user", parts: [{ text: full }] }], turnComplete: true } });
    },
    [send],
  );

  // ─── teardown ─────────────────────────────────────────────────────────────

  const stopAudioAndSocket = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    readyRef.current = false;
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    flushPlayback();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setMicStream(null);
    workletRef.current?.port.close();
    workletRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, [flushPlayback]);

  useEffect(() => () => stopAudioAndSocket(), [stopAudioAndSocket]);

  // ─── finish: save transcript → evaluate → results ─────────────────────────

  const saveAndEvaluate = useCallback(async () => {
    setError(null);
    const finalTurns = turnsRef.current.map((t) => ({ ...t, text: t.text.replace(/\s+/g, " ").trim() })).filter((t) => t.text);
    try {
      setStatus("saving");
      const metrics = computeLiveMetrics(finalTurns);
      const res = await fetch(`/api/exam/oral/live/${examId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: finalTurns.map(({ role, task, text }) => ({ role, task, text })), metrics }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save the session");
      setStatus("evaluating");
      const ev = await fetch("/api/exam/oral/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });
      if (!ev.ok) throw new Error((await ev.json().catch(() => ({}))).error ?? "Evaluation failed");
      onEvaluated();
    } catch (e) {
      setStatus("error");
      setError({ kind: "save", message: e instanceof Error ? e.message : String(e) });
    }
  }, [examId, onEvaluated]);

  const finish = useCallback(
    async (waitForExaminer: boolean) => {
      if (endingRef.current) return;
      endingRef.current = true;
      setStatus("ending");
      if (waitForExaminer) await waitForDrain(8000);
      stopAudioAndSocket();
      await saveAndEvaluate();
    },
    [saveAndEvaluate, stopAudioAndSocket, waitForDrain],
  );

  // ─── tasks & timers ───────────────────────────────────────────────────────

  const goToTask = useCallback((idx: number) => {
    taskIndexRef.current = idx;
    taskStartedRef.current = Date.now();
    examinerOpenRef.current = false; // the next examiner line belongs to the new task
    setTaskIndex(idx);
    setTaskElapsed(0);
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const idx = taskIndexRef.current;
    const elapsed = Math.floor((now - taskStartedRef.current) / 1000);
    setTaskElapsed(elapsed);
    setTotalElapsed(Math.floor((now - startedRef.current) / 1000));
    const item = plan[idx];
    if (item && elapsed > item.minutes * 60 && !nudgedRef.current.has(idx)) {
      nudgedRef.current.add(idx);
      const last = idx === plan.length - 1;
      sendControl(
        last
          ? `time is up for the ${item.task} task and the exam. Close politely in one sentence, say goodbye, then call end_exam.`
          : `time is up for the ${item.task} task. Call advance_task with ${plan[idx + 1].task}, then say a one-sentence transition and immediately open the ${plan[idx + 1].task} task with its opening line.`,
        true,
      );
    }
    // Hard cap: never exceed the session budget, even if the examiner ignores the nudge.
    if (now - startedRef.current > (LIVE_MAX_MINUTES + 1.5) * 60_000) void finish(false);
  }, [finish, plan, sendControl]);

  // ─── message handling ─────────────────────────────────────────────────────

  const handleToolCalls = useCallback(
    (calls: FunctionCall[]) => {
      let end = false;
      const responses = calls.map((c) => {
        if (c.name === "advance_task") {
          const idx = plan.findIndex((p) => p.task === c.args?.task);
          if (idx > taskIndexRef.current) goToTask(idx);
          const now = plan[taskIndexRef.current].task;
          // The model reads tool results: steer it to open the new task straight away
          // (otherwise it tends to stop after the closing sentence and wait).
          return {
            id: c.id,
            name: c.name,
            response: { result: idx >= 0 ? "ok" : "unknown task", currentTask: now, next: `Now introduce the ${now} task in one sentence and give its opening line.` },
          };
        }
        if (c.name === "end_exam") {
          end = true;
          return { id: c.id, name: c.name, response: { result: "ok" } };
        }
        return { id: c.id, name: c.name, response: { result: "unknown function" } };
      });
      send({ toolResponse: { functionResponses: responses } });
      if (end) void finish(true);
    },
    [finish, goToTask, plan, send],
  );

  // Declared below; referenced by handleMessage for GoAway reconnects.
  const reconnectRef = useRef<(reason: "goaway" | "dropped") => void>(() => {});

  const handleMessage = useCallback(
    (msg: Record<string, unknown>) => {
      const sru = msg.sessionResumptionUpdate as { newHandle?: string; resumable?: boolean } | undefined;
      if (sru?.resumable && sru.newHandle) resumeHandleRef.current = sru.newHandle;
      if (msg.goAway) reconnectRef.current("goaway");
      const tc = msg.toolCall as { functionCalls?: FunctionCall[] } | undefined;
      if (tc?.functionCalls?.length) handleToolCalls(tc.functionCalls);

      const sc = msg.serverContent as ServerContent | undefined;
      if (!sc) return;
      if (sc.interrupted) {
        flushPlayback(); // barge-in: the candidate started talking over the examiner
        examinerOpenRef.current = false;
      }
      for (const part of sc.modelTurn?.parts ?? []) {
        if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) playPcm(part.inlineData.data);
      }
      if (sc.inputTranscription?.text) appendTranscript("CANDIDATE", sc.inputTranscription.text);
      if (sc.outputTranscription?.text) appendTranscript("EXAMINER", sc.outputTranscription.text);
      if (sc.turnComplete) examinerOpenRef.current = false;
    },
    [appendTranscript, flushPlayback, handleToolCalls, playPcm],
  );

  // ─── connection ───────────────────────────────────────────────────────────

  const connect = useCallback(
    async (attempt: number, resumeHandle: string | null): Promise<void> => {
      const res = await fetch(`/api/exam/oral/live/${examId}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt, resumeHandle: resumeHandle ?? undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as TokenResponse;
      if (!res.ok) throw new TokenError(data.error ?? "Could not start the live examiner", res.status);
      attemptRef.current = attempt;
      setModel(data.model);

      const ws = new WebSocket(`${data.wsUrl}?access_token=${encodeURIComponent(data.token)}`);
      const previous = wsRef.current;
      wsRef.current = ws;
      readyRef.current = false;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          reject(new Error("Timed out connecting to the examiner"));
        }, 12_000);
        ws.onopen = () => ws.send(JSON.stringify({ setup: {} }));
        ws.onmessage = async (ev) => {
          const msg = await readMessage(ev.data);
          if (!msg || wsRef.current !== ws) return;
          if (msg.setupComplete) {
            readyRef.current = true;
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              try {
                previous?.close();
              } catch {
                /* ignore */
              }
              resolve();
            }
            return;
          }
          handleMessage(msg);
        };
        ws.onclose = (ev) => {
          if (wsRef.current !== ws) return; // a newer socket replaced this one
          readyRef.current = false;
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error(ev.reason || `Connection closed (${ev.code})`));
            return;
          }
          if (!endingRef.current) reconnectRef.current("dropped");
        };
      });
    },
    [examId, handleMessage],
  );

  const reconnect = useCallback(
    async (reason: "goaway" | "dropped") => {
      if (endingRef.current) return;
      if (reconnectsRef.current >= 4) {
        if (reason === "dropped") {
          setStatus("error");
          setError({ kind: "dropped", message: "The connection to the examiner was lost." });
        }
        return;
      }
      reconnectsRef.current++;
      const handle = resumeHandleRef.current;
      if (reason === "dropped") setStatus("reconnecting");
      try {
        await connect(attemptRef.current, handle);
        if (!handle) {
          // No resumable context: tell the fresh session where we are.
          const item = plan[taskIndexRef.current];
          const lastLines = turnsRef.current.slice(-4).map((t) => `${t.role === "EXAMINER" ? "Examiner" : "Candidate"}: ${t.text.slice(0, 300)}`).join(" | ");
          sendControl(`The connection dropped and was restored. Do not greet again. Continue the ${item.task} task where it was left. Last exchanges: ${lastLines}`, false);
        }
        setStatus("live");
      } catch {
        setStatus("error");
        setError({ kind: "dropped", message: "The connection to the examiner was lost." });
      }
    },
    [connect, plan, sendControl],
  );
  useEffect(() => {
    reconnectRef.current = (reason) => void reconnect(reason);
  }, [reconnect]);

  const setupAudio = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    const ctx = new AudioContext();
    await ctx.resume();
    await ctx.audioWorklet.addModule("/worklets/pcm-recorder.js");

    const mic = ctx.createMediaStreamSource(stream);
    const micAnalyser = ctx.createAnalyser();
    micAnalyser.fftSize = 256;
    mic.connect(micAnalyser);
    const worklet = new AudioWorkletNode(ctx, "pcm-recorder");
    mic.connect(worklet);
    const sink = ctx.createGain(); // keep the worklet pulled without making it audible
    sink.gain.value = 0;
    worklet.connect(sink).connect(ctx.destination);
    worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      send({ realtimeInput: { audio: { data: bytesToBase64(new Uint8Array(e.data)), mimeType: "audio/pcm;rate=16000" } } });
    };

    const outGain = ctx.createGain();
    const outAnalyser = ctx.createAnalyser();
    outAnalyser.fftSize = 256;
    outGain.connect(outAnalyser).connect(ctx.destination);

    ctxRef.current = ctx;
    outGainRef.current = outGain;
    outAnalyserRef.current = outAnalyser;
    micAnalyserRef.current = micAnalyser;
    workletRef.current = worklet;
    streamRef.current = stream;
    setMicStream(stream);
  }, [send]);

  const start = useCallback(async () => {
    if (status !== "idle" && status !== "error") return;
    setError(null);
    endingRef.current = false;
    setStatus("connecting");
    try {
      if (!ctxRef.current) await setupAudio();
    } catch (e) {
      setStatus("error");
      setError({ kind: "mic", message: e instanceof Error ? e.message : "Microphone unavailable" });
      return;
    }
    let attempt = 0;
    for (;;) {
      try {
        await connect(attempt, null);
        break;
      } catch (e) {
        const status = e instanceof TokenError ? e.status : 0;
        const retryable = status === 0 || status === 502;
        if (retryable && attempt + 1 < LIVE_MODELS.length) {
          attempt++;
          continue;
        }
        stopAudioAndSocket();
        setStatus("error");
        setError({ kind: status === 410 || status === 409 ? "expired" : "connect", message: e instanceof Error ? e.message : String(e) });
        return;
      }
    }
    startedRef.current = Date.now();
    goToTask(0);
    setStatus("live");
    sendControl("The candidate has joined. Begin the exam now.", false);
    timerRef.current = setInterval(tick, 1000);
  }, [connect, goToTask, sendControl, setupAudio, status, stopAudioAndSocket, tick]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = m));
      return !m;
    });
  }, []);

  return {
    status,
    error,
    turns,
    taskIndex,
    task: plan[taskIndex]?.task ?? plan[0]?.task,
    taskElapsed,
    totalElapsed,
    examinerSpeaking,
    micStream,
    muted,
    model,
    outAnalyser: outAnalyserRef,
    micAnalyser: micAnalyserRef,
    start,
    endNow: () => void finish(false),
    retrySave: () => void saveAndEvaluate(),
    toggleMute,
  };
}
