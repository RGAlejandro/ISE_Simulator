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

/**
 * gpt-oss and Qwen 3 are reasoning models: their hidden reasoning counts against
 * max_tokens. Callers pass the size of the *visible* answer they need, so add
 * headroom — otherwise long JSON (written exams) comes back truncated and short
 * replies come back empty.
 */
const REASONING_HEADROOM = 4096;
/** Conversational turns: small headroom so the reply length stays close to the requested size. */
const CHAT_HEADROOM = 512;

function budget(modelName: string, visible: number, headroom = REASONING_HEADROOM) {
  return {
    max_tokens: visible + headroom,
    // Only the gpt-oss family accepts "low"; other models would reject the request.
    ...(modelName.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const } : {}),
  };
}

/** Empty or cut-off output is a model failure: let the chain try the next model/provider. */
function checkOutput(response: { choices: { message?: { content?: string | null } | null; finish_reason?: string | null }[] }): string {
  const choice = response.choices[0];
  const text = choice?.message?.content ?? "";
  if (!text.trim()) throw new Error("Failed to generate: empty response");
  if (choice?.finish_reason === "length") throw new Error("Failed to generate: truncated response");
  return text;
}

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
    msg.includes("Failed to generate")
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
      ...budget(modelName, options?.maxTokens ?? 2048),
    });
    return checkOutput(response);
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
      ...budget(modelName, options?.maxTokens ?? 8192),
      response_format: { type: "json_object" },
    });
    return parseAIJson(checkOutput(response));
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
      ...budget(modelName, options?.maxTokens ?? 250, CHAT_HEADROOM),
    });
    return checkOutput(response);
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
      ...budget(modelName, options?.maxTokens ?? 8192),
      response_format: { type: "json_object" },
    });
    return parseAIJson(checkOutput(response));
  });
}

/**
 * Groq's only model that reads images (verified live on 2026-11-22: a 22-word page in ~2 s).
 * On the free tier it allows 1000 output tokens per minute: fine for one photo, not five.
 */
const GROQ_VISION_MODEL = "qwen/qwen3.8-27b";

/**
 * Read one image and answer in JSON. No reasoning: this is transcription, and
 * thinking only adds seconds. Throws on failure so the caller can fall back to Gemini.
 */
export async function groqReadImageJSON(
  systemPrompt: string,
  image: { data: string; mimeType: string },
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number },
): Promise<unknown> {
  const response = await getGroq().chat.completions.create(
    {
      model: GROQ_VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt + "\n\nYou must respond with valid JSON only. No markdown, no code fences, no extra text." },
        {
          role: "user",
          content: [
            { type: "text", text: "Read this photo." },
            { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
          ],
        },
      ],
      temperature: options?.temperature ?? 0.1,
      // Free tier: 1000 output tokens per minute on this model, so one page at a time.
      // A longer page fails fast here and the caller falls back to Gemini.
      max_tokens: options?.maxTokens ?? 1000,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
    },
    { timeout: options?.timeoutMs ?? 25_000 },
  );
  return parseAIJson(checkOutput(response));
}
