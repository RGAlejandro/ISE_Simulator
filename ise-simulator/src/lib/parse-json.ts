/**
 * Parse JSON coming from an LLM, tolerating markdown code fences and
 * surrounding prose. On failure throws an Error whose message contains
 * "Failed to generate JSON", which the provider fallback chains
 * (ai-provider.ts and each provider's internal model rotation) treat
 * as retryable — so malformed output triggers a fallback instead of a 500.
 */
export function parseAIJson(text: string): unknown {
  let cleaned = text.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to the outermost {...} or [...] block, in case the model
    // wrapped the JSON in prose.
    const start = cleaned.search(/[{[]/);
    if (start !== -1) {
      const open = cleaned[start];
      const close = open === "{" ? "}" : "]";
      const end = cleaned.lastIndexOf(close);
      if (end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
          // fall through to the error below
        }
      }
    }
    throw new Error(
      `Failed to generate JSON: model returned malformed output (${cleaned.slice(0, 80)}...)`
    );
  }
}
