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
  const providers: Provider[] = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      generateText: groqGenerateText,
      generateJSON: groqGenerateJSON,
      generateChat: groqGenerateChat,
      generateChatJSON: groqGenerateChatJSON,
    });
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: "Gemini",
      generateText: geminiGenerateText,
      generateJSON: geminiGenerateJSON,
      generateChat: geminiGenerateChat,
      generateChatJSON: geminiGenerateChatJSON,
    });
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
    msg.includes("high demand")
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
  options?: { temperature?: number }
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
  options?: { temperature?: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tryProviders<any>("generateChatJSON", [systemPrompt, userPrompt, options]);
}
