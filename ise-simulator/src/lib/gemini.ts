import { GoogleGenerativeAI } from "@google/generative-ai";

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

// Fallback models in order of preference
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

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
      // Only retry on 503/overloaded/quota errors
      if (!msg.includes("503") && !msg.includes("overloaded") && !msg.includes("high demand") && !msg.includes("RESOURCE_EXHAUSTED")) {
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
    return JSON.parse(result.response.text());
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
      },
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
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
    return JSON.parse(result.response.text());
  });
}
