const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return key;
}

// Free models — verified active on OpenRouter (May 2026)
const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-v4-flash:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
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
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("404") ||
    msg.includes("No endpoints found")
  );
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterChoice {
  message: { content: string };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
  error?: { message: string };
}

async function callOpenRouter(
  messages: OpenRouterMessage[],
  modelName: string,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const body: Record<string, unknown> = {
    model: modelName,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (options?.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "ISE Simulator",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as OpenRouterResponse;

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  return data.choices?.[0]?.message?.content ?? "";
}

async function tryModels<T>(fn: (modelName: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const modelName of MODELS) {
    try {
      return await fn(modelName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OpenRouter] Model ${modelName} failed: ${msg.slice(0, 120)}`);
      lastError = err;
      if (!isRetryableError(msg)) {
        throw err;
      }
    }
  }
  throw lastError;
}

export async function openrouterGenerateText(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return tryModels(async (modelName) => {
    return callOpenRouter(
      [{ role: "user", content: prompt }],
      modelName,
      { temperature: options?.temperature, maxTokens: options?.maxTokens }
    );
  });
}

export async function openrouterGenerateJSON(
  prompt: string,
  options?: { temperature?: number }
): Promise<unknown> {
  return tryModels(async (modelName) => {
    const text = await callOpenRouter(
      [
        {
          role: "system",
          content: "You must respond with valid JSON only. No markdown, no code fences, no extra text.",
        },
        { role: "user", content: prompt },
      ],
      modelName,
      { temperature: options?.temperature, jsonMode: true }
    );
    return JSON.parse(text || "{}");
  });
}

export async function openrouterGenerateChat(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return tryModels(async (modelName) => {
    return callOpenRouter(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      modelName,
      { temperature: options?.temperature, maxTokens: options?.maxTokens ?? 250 }
    );
  });
}

export async function openrouterGenerateChatJSON(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number }
): Promise<unknown> {
  return tryModels(async (modelName) => {
    const text = await callOpenRouter(
      [
        {
          role: "system",
          content: systemPrompt + "\n\nYou must respond with valid JSON only. No markdown, no code fences, no extra text.",
        },
        { role: "user", content: userPrompt },
      ],
      modelName,
      { temperature: options?.temperature, jsonMode: true }
    );
    return JSON.parse(text || "{}");
  });
}
