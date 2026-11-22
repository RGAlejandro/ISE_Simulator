import Groq from "groq-sdk";
import { parseAIJson } from "./parse-json";

let _groq: Groq | null = null;

function getGroq(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

// Groq retired the Llama 3.x models (404 since late 2026). Verified live on 2026-11-16.
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
];

function isRetryableError(msg: string): boolean {
  return (
    msg.includes("429") ||
    msg.includes("rate_limit") ||
    msg.includes("Rate limit") ||
    msg.includes("quota") ||
    msg.includes("503") ||
    msg.includes("overloaded") ||
    msg.includes("capacity") ||
    // A retired/renamed model must not stop the fallback chain.
    msg.includes("404") ||
    msg.includes("model_not_found") ||
    msg.includes("decommissioned") ||
    msg.includes("Failed to generate JSON")
  );
}

async function tryGroqModels<T>(
  fn: (modelName: string) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (const modelName of GROQ_MODELS) {
    try {
      return await fn(modelName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Groq] Model ${modelName} failed: ${msg.slice(0, 120)}`);
      lastError = err;
      if (!isRetryableError(msg)) {
        throw err;
      }
    }
  }
  throw lastError;
}

/**
 * Transcribe candidate audio with Groq Whisper. Works regardless of browser
 * (replaces the Web Speech API, which is unavailable on Chromium/Brave/Firefox).
 */
export async function groqTranscribeAudio(file: File, language = "en"): Promise<string> {
  const response = await getGroq().audio.transcriptions.create({
    file,
    model: "whisper-large-v3-turbo",
    language,
    response_format: "json",
    temperature: 0,
  });
  return response.text ?? "";
}

export async function groqGenerateText(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return tryGroqModels(async (modelName) => {
    const response = await getGroq().chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    });
    return response.choices[0]?.message?.content ?? "";
  });
}

export async function groqGenerateJSON(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<unknown> {
  return tryGroqModels(async (modelName) => {
    const response = await getGroq().chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "You must respond with valid JSON only. No markdown, no code fences, no extra text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 8192,
      response_format: { type: "json_object" },
    });
    const text = response.choices[0]?.message?.content ?? "{}";
    return parseAIJson(text);
  });
}

export async function groqGenerateChat(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return tryGroqModels(async (modelName) => {
    const response = await getGroq().chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 250,
      // Short conversational turns: keep reasoning from eating the small token budget.
      reasoning_effort: "low",
    });
    return response.choices[0]?.message?.content ?? "";
  });
}

export async function groqGenerateChatJSON(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<unknown> {
  return tryGroqModels(async (modelName) => {
    const response = await getGroq().chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: systemPrompt + "\n\nYou must respond with valid JSON only. No markdown, no code fences, no extra text.",
        },
        { role: "user", content: userPrompt },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 8192,
      response_format: { type: "json_object" },
    });
    const text = response.choices[0]?.message?.content ?? "{}";
    return parseAIJson(text);
  });
}
