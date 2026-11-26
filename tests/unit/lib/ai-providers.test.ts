import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── SDK fakes ───────────────────────────────────────────────────────────────

const gem = vi.hoisted(() => ({ generateContent: vi.fn(), getGenerativeModel: vi.fn() }));
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel(...args: unknown[]) {
      gem.getGenerativeModel(...args);
      return { generateContent: gem.generateContent };
    }
  },
}));

const groqSdk = vi.hoisted(() => ({ create: vi.fn(), transcribe: vi.fn() }));
vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: groqSdk.create } };
    audio = { transcriptions: { create: groqSdk.transcribe } };
  },
}));

import * as gemini from "@/lib/gemini";
import * as groq from "@/lib/groq";
import * as openrouter from "@/lib/openrouter";

const text = (t: string) => ({ response: { text: () => t } });
const choice = (content: string | null, finish_reason = "stop") => ({ choices: [{ message: { content }, finish_reason }] });
const modelsTried = () => gem.getGenerativeModel.mock.calls.map((c) => (c[0] as { model: string }).model);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubEnv("GEMINI_API_KEY", "g");
  vi.stubEnv("GROQ_API_KEY", "q");
  vi.stubEnv("OPENROUTER_API_KEY", "o");
});

describe("gemini", () => {
  it("uses the first model when it works, and parses JSON", async () => {
    gem.generateContent.mockResolvedValue(text('```json\n{"ok":true}\n```'));
    expect(await gemini.geminiGenerateJSON("p")).toEqual({ ok: true });
    expect(modelsTried()).toEqual(["gemini-2.5-flash"]);
  });

  it("falls back through the models on quota, overload and bad JSON", async () => {
    gem.generateContent
      .mockRejectedValueOnce(new Error("[429] quota exceeded"))
      .mockRejectedValueOnce(new Error("[503] high demand"))
      .mockResolvedValueOnce(text("not json"))
      .mockResolvedValueOnce(text('{"n":4}'));
    expect(await gemini.geminiGenerateJSON("p")).toEqual({ n: 4 });
    expect(modelsTried()).toHaveLength(4);
  });

  it("stops on a non-retryable error and rethrows the last error when all fail", async () => {
    gem.generateContent.mockRejectedValueOnce(new Error("API key not valid"));
    await expect(gemini.geminiGenerateText("p")).rejects.toThrow(/API key/);
    expect(modelsTried()).toHaveLength(1);
    gem.generateContent.mockRejectedValue(new Error("503 overloaded"));
    await expect(gemini.geminiGenerateText("p")).rejects.toThrow(/503/);
  });

  it("needs an API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(gemini.geminiGenerateText("p")).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("turns off thinking for short chat turns on 2.5 models only", async () => {
    gem.generateContent.mockRejectedValueOnce(new Error("429")).mockResolvedValueOnce(text("Hello"));
    expect(await gemini.geminiGenerateChat("sys", "hi")).toBe("Hello");
    const [first, second] = gem.getGenerativeModel.mock.calls.map((c) => c[0] as { generationConfig: Record<string, unknown>; systemInstruction: string });
    expect(first.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(second.generationConfig.thinkingConfig).toBeUndefined();
    expect(first.systemInstruction).toBe("sys");
  });

  it("sends files inline and can restrict the model chain", async () => {
    gem.generateContent.mockResolvedValue(text('{"a":1}'));
    expect(await gemini.generateWithFileData("p", { data: "AAA", mimeType: "image/png" })).toEqual({ a: 1 });
    expect(gem.generateContent.mock.calls[0][0][0]).toEqual({ inlineData: { data: "AAA", mimeType: "image/png" } });
    expect(await gemini.geminiGenerateChatJSON("s", "u")).toEqual({ a: 1 });
    gem.getGenerativeModel.mockClear();
    gem.generateContent.mockRejectedValueOnce(new Error("timeout Request aborted")).mockResolvedValueOnce(text('{"b":2}'));
    const out = await gemini.geminiGenerateChatJSONWithFiles("s", "u", [{ data: "x", mimeType: "image/jpeg" }], { models: ["fast-1", "fast-2"], timeoutMs: 1000, noThinking: true });
    expect(out).toEqual({ b: 2 });
    expect(modelsTried()).toEqual(["fast-1", "fast-2"]);
    expect(gem.getGenerativeModel.mock.calls[0][1]).toEqual({ timeout: 1000 });
  });

  it("reads YouTube videos from the URL with low media resolution", async () => {
    gem.generateContent.mockResolvedValue(text('{"title":"t"}'));
    expect(await gemini.geminiVideoJSON("p", "https://youtu.be/x")).toEqual({ title: "t" });
    expect(gem.generateContent.mock.calls[0][0][0]).toEqual({ fileData: { fileUri: "https://youtu.be/x", mimeType: "video/*" } });
    expect((gem.getGenerativeModel.mock.calls[0][0] as { generationConfig: Record<string, unknown> }).generationConfig.mediaResolution).toBe("MEDIA_RESOLUTION_LOW");
  });
});

describe("groq", () => {
  it("adds reasoning headroom and low effort only for gpt-oss", async () => {
    groqSdk.create.mockResolvedValueOnce(choice("hi"));
    expect(await groq.groqGenerateText("p", { maxTokens: 100 })).toBe("hi");
    expect(groqSdk.create.mock.calls[0][0]).toMatchObject({ model: "openai/gpt-oss-120b", max_tokens: 4196, reasoning_effort: "low" });
  });

  it("treats empty and truncated output as a failure and tries the next model", async () => {
    groqSdk.create.mockResolvedValueOnce(choice("  ")).mockResolvedValueOnce(choice('{"a"', "length")).mockResolvedValueOnce(choice('{"a":1}'));
    expect(await groq.groqGenerateJSON("p")).toEqual({ a: 1 });
    const third = groqSdk.create.mock.calls[2][0];
    expect(third.model).toBe("openai/gpt-oss-20b");
    expect(groqSdk.create.mock.calls[1][0]).not.toHaveProperty("reasoning_effort");
  });

  it("skips retired models but stops on other errors", async () => {
    groqSdk.create.mockRejectedValueOnce(new Error("404 model_not_found")).mockResolvedValueOnce(choice("ok"));
    expect(await groq.groqGenerateChat("s", "u")).toBe("ok");
    groqSdk.create.mockRejectedValueOnce(new Error("invalid_api_key"));
    await expect(groq.groqGenerateChatJSON("s", "u")).rejects.toThrow(/invalid_api_key/);
    groqSdk.create.mockRejectedValue(new Error("429 rate_limit"));
    await expect(groq.groqGenerateText("p")).rejects.toThrow(/429/);
  });

  it("asks chat JSON with the system prompt and small chat headroom", async () => {
    groqSdk.create.mockResolvedValueOnce(choice('{"reply":"x"}'));
    expect(await groq.groqGenerateChatJSON("sys", "u", { maxTokens: 100 })).toEqual({ reply: "x" });
    expect(groqSdk.create.mock.calls[0][0].messages[0].content).toMatch(/^sys/);
    groqSdk.create.mockResolvedValueOnce(choice("hey"));
    await groq.groqGenerateChat("s", "u", { maxTokens: 100 });
    expect(groqSdk.create.mock.calls[1][0].max_tokens).toBe(612);
  });

  it("transcribes audio and reads images", async () => {
    groqSdk.transcribe.mockResolvedValueOnce({ text: "hello" }).mockResolvedValueOnce({});
    const file = new File(["a"], "a.webm");
    expect(await groq.groqTranscribeAudio(file)).toBe("hello");
    expect(await groq.groqTranscribeAudio(file, "es")).toBe("");
    groqSdk.create.mockResolvedValueOnce(choice('{"words":[]}'));
    expect(await groq.groqReadImageJSON("s", { data: "AAA", mimeType: "image/png" })).toEqual({ words: [] });
    const [body, opts] = groqSdk.create.mock.calls[0];
    expect(body.messages[1].content[1].image_url.url).toBe("data:image/png;base64,AAA");
    expect(opts).toEqual({ timeout: 25_000 });
  });

  it("needs an API key", async () => {
    vi.resetModules();
    vi.stubEnv("GROQ_API_KEY", "");
    const fresh = await import("@/lib/groq");
    await expect(fresh.groqTranscribeAudio(new File([], "a"))).rejects.toThrow(/GROQ_API_KEY/);
  });
});

describe("openrouter", () => {
  afterEach(() => vi.unstubAllGlobals());
  const ok = (content: string) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });

  it("calls the API with JSON mode and parses the answer", async () => {
    const fetch = vi.fn().mockResolvedValue(ok('{"x":1}'));
    vi.stubGlobal("fetch", fetch);
    expect(await openrouter.openrouterGenerateJSON("p")).toEqual({ x: 1 });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer o");
  });

  it("falls back on HTTP 429 and provider errors, stops on others", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "rate limited" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [], error: { message: "No endpoints found" } }) })
      .mockResolvedValueOnce(ok("hello")));
    expect(await openrouter.openrouterGenerateText("p")).toBe("hello");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "bad key" }));
    await expect(openrouter.openrouterGenerateChat("s", "u")).rejects.toThrow(/401/);
  });

  it("returns empty text when there's no choice, and handles chat JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }));
    expect(await openrouter.openrouterGenerateText("p")).toBe("");
    expect(await openrouter.openrouterGenerateJSON("p")).toEqual({});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok('{"reply":"r"}')));
    expect(await openrouter.openrouterGenerateChatJSON("s", "u")).toEqual({ reply: "r" });
  });

  it("needs an API key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
    await expect(openrouter.openrouterGenerateText("p")).rejects.toThrow(/OPENROUTER_API_KEY/);
  });
});
