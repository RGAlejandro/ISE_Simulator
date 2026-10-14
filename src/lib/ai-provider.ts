import {
  groqGenerateText,
  groqGenerateJSON,
  groqGenerateChat,
  groqGenerateChatJSON,
} from "./groq";
import {
  geminiGenerateText,
  geminiGenerateJSON,
  geminiGenerateChat,
  geminiGenerateChatJSON,
} from "./gemini";
import {
  openrouterGenerateText,
  openrouterGenerateJSON,
  openrouterGenerateChat,
  openrouterGenerateChatJSON,
} from "./openrouter";

type Provider = {
  name: string;
  generateText: (prompt: string, options?: { temperature?: number; maxTokens?: number }) => Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generateJSON: (prompt: string, options?: { temperature?: number }) => Promise<any>;
  generateChat: (systemPrompt: string, userPrompt: string, options?: { temperature?: number; maxTokens?: number }) => Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generateChatJSON: (systemPrompt: string, userPrompt: string, options?: { temperature?: number }) => Promise<any>;
};

function getProviders(): Provider[] {
  const allProviders: Record<string, Provider | null> = {
    groq: process.env.GROQ_API_KEY
      ? {
          name: "Groq",
          generateText: groqGenerateText,
          generateJSON: groqGenerateJSON,
          generateChat: groqGenerateChat,
          generateChatJSON: groqGenerateChatJSON,
        }
      : null,
    gemini: process.env.GEMINI_API_KEY
      ? {
          name: "Gemini",
          generateText: geminiGenerateText,
          generateJSON: geminiGenerateJSON,
          generateChat: geminiGenerateChat,
          generateChatJSON: geminiGenerateChatJSON,
        }
      : null,
    openrouter: process.env.OPENROUTER_API_KEY
      ? {
          name: "OpenRouter",
          generateText: openrouterGenerateText,
          generateJSON: openrouterGenerateJSON,
          generateChat: openrouterGenerateChat,
          generateChatJSON: openrouterGenerateChatJSON,
        }
      : null,
  };

  // AI_PROVIDER_ORDER lets you set priority, e.g. "openrouter,gemini,groq"
  // Default order: groq, gemini, openrouter
  const order = (process.env.AI_PROVIDER_ORDER || "groq,gemini,openrouter")
    .split(",")
    .map((s) => s.trim().toLowerCase());

  const providers: Provider[] = [];
  for (const key of order) {
    const p = allProviders[key];
    if (p) providers.push(p);
  }

  return providers;
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
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("high demand") ||
    msg.includes("404") ||
    msg.includes("No endpoints found") ||
    msg.includes("json_validate_failed") ||
    msg.includes("Failed to generate JSON")
  );
}

async function tryProviders<T>(
  fnName: keyof Omit<Provider, "name">,
  args: unknown[]
): Promise<T> {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error("No AI provider configured. Set GROQ_API_KEY or GEMINI_API_KEY.");
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      console.log(`[AI] Trying ${provider.name}...`);
      const fn = provider[fnName] as (...a: unknown[]) => Promise<T>;
      const result = await fn(...args);
      console.log(`[AI] ${provider.name} succeeded.`);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AI] ${provider.name} failed: ${msg.slice(0, 150)}`);
      lastError = err;

      if (!isRetryableError(msg)) {
        throw err;
      }
    }
  }

  throw lastError;
}

export async function generateText(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return tryProviders<string>("generateText", [prompt, options]);
}

export async function generateJSON(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tryProviders<any>("generateJSON", [prompt, options]);
}

export async function generateChat(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return tryProviders<string>("generateChat", [systemPrompt, userPrompt, options]);
}

export async function generateChatJSON(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tryProviders<any>("generateChatJSON", [systemPrompt, userPrompt, options]);
}
