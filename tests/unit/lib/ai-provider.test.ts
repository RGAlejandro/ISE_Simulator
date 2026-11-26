import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/groq", () => ({
  groqGenerateText: vi.fn(), groqGenerateJSON: vi.fn(), groqGenerateChat: vi.fn(), groqGenerateChatJSON: vi.fn(),
}));
vi.mock("@/lib/gemini", () => ({
  geminiGenerateText: vi.fn(), geminiGenerateJSON: vi.fn(), geminiGenerateChat: vi.fn(), geminiGenerateChatJSON: vi.fn(),
}));
vi.mock("@/lib/openrouter", () => ({
  openrouterGenerateText: vi.fn(), openrouterGenerateJSON: vi.fn(), openrouterGenerateChat: vi.fn(), openrouterGenerateChatJSON: vi.fn(),
}));

import * as groq from "@/lib/groq";
import * as gemini from "@/lib/gemini";
import * as openrouter from "@/lib/openrouter";
import { generateChat, generateChatJSON, generateJSON, generateText } from "@/lib/ai-provider";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GROQ_API_KEY", "q");
  vi.stubEnv("GEMINI_API_KEY", "g");
  vi.stubEnv("OPENROUTER_API_KEY", "o");
  vi.stubEnv("AI_PROVIDER_ORDER", "");
});

describe("ai provider chain", () => {
  it("tries Groq first by default", async () => {
    vi.mocked(groq.groqGenerateText).mockResolvedValue("from groq");
    expect(await generateText("p")).toBe("from groq");
    expect(gemini.geminiGenerateText).not.toHaveBeenCalled();
  });

  it("lets a quality-sensitive call prefer Gemini", async () => {
    vi.mocked(gemini.geminiGenerateJSON).mockResolvedValue({ by: "gemini" });
    expect(await generateJSON("p", { prefer: "gemini" })).toEqual({ by: "gemini" });
    expect(groq.groqGenerateJSON).not.toHaveBeenCalled();
  });

  it("falls back to the next provider on retryable errors", async () => {
    vi.mocked(groq.groqGenerateChat).mockRejectedValue(new Error("429 rate_limit"));
    vi.mocked(gemini.geminiGenerateChat).mockRejectedValue(new Error("RESOURCE_EXHAUSTED quota"));
    vi.mocked(openrouter.openrouterGenerateChat).mockResolvedValue("from openrouter");
    expect(await generateChat("s", "u")).toBe("from openrouter");
  });

  it("does not hide non-retryable errors", async () => {
    vi.mocked(groq.groqGenerateChatJSON).mockRejectedValue(new Error("invalid_api_key"));
    await expect(generateChatJSON("s", "u")).rejects.toThrow(/invalid_api_key/);
    expect(gemini.geminiGenerateChatJSON).not.toHaveBeenCalled();
  });

  it("rethrows the last error when every provider fails", async () => {
    vi.mocked(groq.groqGenerateText).mockRejectedValue(new Error("503 overloaded"));
    vi.mocked(gemini.geminiGenerateText).mockRejectedValue(new Error("high demand"));
    vi.mocked(openrouter.openrouterGenerateText).mockRejectedValue("No endpoints found");
    await expect(generateText("p")).rejects.toBe("No endpoints found");
  });

  it("follows AI_PROVIDER_ORDER and skips providers without a key", async () => {
    vi.stubEnv("AI_PROVIDER_ORDER", "openrouter, gemini, groq");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.mocked(gemini.geminiGenerateText).mockResolvedValue("gemini first");
    expect(await generateText("p")).toBe("gemini first");
    expect(openrouter.openrouterGenerateText).not.toHaveBeenCalled();
  });

  it("explains when no provider is configured", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(generateText("p")).rejects.toThrow(/No AI provider configured/);
  });
});
