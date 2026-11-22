import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseAIJson } from "./parse-json";

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

// Fallback models in order of preference (2.0/1.5 were retired; verified live on 2026-11-16).
const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];

/**
 * Gemini 2.5 counts "thinking" tokens against maxOutputTokens, so a short
 * examiner turn (250 tokens) can come back truncated. Disable thinking for
 * short conversational calls on 2.5 models; newer models manage it themselves.
 */
function noThinking(modelName: string) {
  return modelName.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {};
}

async function tryWithFallback<T>(
  fn: (modelName: string) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (const modelName of MODELS) {
    try {
      const result = await fn(modelName);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini] Model ${modelName} failed: ${msg.slice(0, 120)}`);
      lastError = err;
      // Only retry on 503/overloaded/quota/malformed-JSON errors
      if (!msg.includes("503") && !msg.includes("404") && !msg.includes("overloaded") && !msg.includes("high demand") && !msg.includes("RESOURCE_EXHAUSTED") && !msg.includes("Failed to generate JSON") && !msg.includes("Request aborted")) {
        throw err; // Non-retryable error, don't try other models
      }
    }
  }
  throw lastError;
}

export async function geminiGenerateText(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return tryWithFallback(async (modelName) => {
    const model = getGenAI().getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  });
}

export async function geminiGenerateJSON(
  prompt: string,
  options?: { temperature?: number }
): Promise<unknown> {
  return tryWithFallback(async (modelName) => {
    const model = getGenAI().getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        responseMimeType: "application/json",
      },
    });
    const result = await model.generateContent(prompt);
    return parseAIJson(result.response.text());
  });
}

export async function geminiGenerateChat(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return tryWithFallback(async (modelName) => {
    const model = getGenAI().getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 250,
        // thinkingConfig isn't in this SDK's types yet but is passed through to the REST API.
        ...(noThinking(modelName) as object),
      },
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
  });
}

export async function generateWithFileData(
  prompt: string,
  fileData: { data: string; mimeType: string },
  options?: { temperature?: number }
) {
  return generateWithFiles(prompt, [fileData], options);
}

/** JSON generation over one or more inline files (images/PDF), e.g. several photographed pages. */
export async function generateWithFiles(
  prompt: string,
  files: { data: string; mimeType: string }[],
  options?: { temperature?: number }
) {
  return tryWithFallback(async (modelName) => {
    const model = getGenAI().getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        responseMimeType: "application/json",
      },
    });
    const result = await model.generateContent([
      ...files.map((f) => ({ inlineData: { data: f.data, mimeType: f.mimeType } })),
      prompt,
    ]);
    return parseAIJson(result.response.text());
  });
}

/** Chat-style JSON generation (system instruction + user turn) with attached images. */
export async function geminiGenerateChatJSONWithFiles(
  systemPrompt: string,
  userPrompt: string,
  files: { data: string; mimeType: string }[],
  options?: { temperature?: number; timeoutMs?: number }
): Promise<unknown> {
  return tryWithFallback(async (modelName) => {
    const model = getGenAI().getGenerativeModel(
      {
        model: modelName,
        generationConfig: {
          temperature: options?.temperature ?? 0.4,
          responseMimeType: "application/json",
        },
        systemInstruction: systemPrompt,
      },
      // A stuck model would leave the learner staring at a spinner; abort and try the next one.
      { timeout: options?.timeoutMs ?? 25_000 },
    );
    const result = await model.generateContent([
      ...files.map((f) => ({ inlineData: { data: f.data, mimeType: f.mimeType } })),
      userPrompt,
    ]);
    return parseAIJson(result.response.text());
  });
}

export async function geminiGenerateChatJSON(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number }
): Promise<unknown> {
  return tryWithFallback(async (modelName) => {
    const model = getGenAI().getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        responseMimeType: "application/json",
      },
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userPrompt);
    return parseAIJson(result.response.text());
  });
}
