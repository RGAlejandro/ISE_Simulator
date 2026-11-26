import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLivePlan, buildLiveSetup, isLiveTask, liveModelFor, mintLiveToken } from "@/lib/live-examiner";
import { DEFAULT_PERSONA_ID, EXAMINER_PERSONAS, PERSONA_VOICES, getPersona } from "@/lib/examiner-personas";
import { EXAM_LEVELS, LIVE_MAX_MINUTES, LIVE_MODELS, ORAL_TASKS_BY_LEVEL, ORAL_TASK_MINUTES } from "@/lib/constants";
import { DEFAULT_LOCALE, DICTIONARIES, LOCALES, LOCALE_META } from "@/i18n";
import { clerkDarkAppearance } from "@/lib/clerk-appearance";
import { downscaleImage } from "@/lib/image-resize";

describe("live examiner", () => {
  it("orders the tasks and scales them to the session cap", () => {
    const plan = buildLivePlan("ISE_III", ["CONVERSATION", "TOPIC", "COLLABORATIVE", "LISTENING"]);
    expect(plan.map((p) => p.task)).toEqual(["TOPIC", "COLLABORATIVE", "CONVERSATION"]);
    expect(plan.reduce((s, p) => s + p.minutes, 0)).toBeLessThanOrEqual(LIVE_MAX_MINUTES + 1);
    expect(buildLivePlan("ISE_I", ["COLLABORATIVE", "TOPIC"]).map((p) => p.task)).toEqual(["TOPIC"]);
    expect(buildLivePlan("UNKNOWN" as never, ["TOPIC"])).toEqual([]);
  });

  it("locks prompt, voice and tools into the session setup", () => {
    const { plan, setup } = buildLiveSetup(
      { level: "ISE_II", personaId: "connor", selectedTasks: ["TOPIC", "CONVERSATION"], topicGeneral: "\n Football \n- why", topicDetailed: null },
      "gemini-3.8-live",
      "resume-1",
    );
    expect(plan).toHaveLength(2);
    expect(setup.model).toBe("models/gemini-3.8-live");
    expect(setup.systemInstruction.parts[0].text).toContain("Football");
    expect(setup.sessionResumption).toEqual({ handle: "resume-1" });
    const names = (setup.tools[0].functionDeclarations as { name: string }[]).map((d) => d.name);
    expect(names).toEqual(["advance_task", "end_exam"]);
    const single = buildLiveSetup({ level: "ISE_II", personaId: null, selectedTasks: ["TOPIC"], topicGeneral: null, topicDetailed: null }, "m");
    expect((single.setup.tools[0].functionDeclarations as { name: string }[]).map((d) => d.name)).toEqual(["end_exam"]);
    expect(single.setup.sessionResumption).toEqual({});
  });

  it("walks the live model list and recognises live tasks", () => {
    expect(liveModelFor(0)).toBe(LIVE_MODELS[0]);
    expect(liveModelFor(99)).toBeNull();
    expect(isLiveTask("TOPIC")).toBe(true);
    expect(isLiveTask("LISTENING")).toBe(false);
  });

  describe("token minting", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("returns the token name", async () => {
      vi.stubEnv("GEMINI_API_KEY", "k");
      const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "auth_tokens/abc" }) });
      vi.stubGlobal("fetch", fetch);
      const t = await mintLiveToken({ model: "m" });
      expect(t.token).toBe("auth_tokens/abc");
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ uses: 1, bidiGenerateContentSetup: { model: "m" } });
    });

    it("fails clearly without a key or a token", async () => {
      vi.stubEnv("GEMINI_API_KEY", "");
      await expect(mintLiveToken({})).rejects.toThrow(/GEMINI_API_KEY/);
      vi.stubEnv("GEMINI_API_KEY", "k");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { message: "quota" } }) }));
      await expect(mintLiveToken({})).rejects.toThrow(/429.*quota/);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }));
      await expect(mintLiveToken({})).rejects.toThrow(/no token/);
    });
  });
});

describe("examiner personas", () => {
  it("has unique ids and voices, and a default", () => {
    expect(new Set(EXAMINER_PERSONAS.map((p) => p.id)).size).toBe(EXAMINER_PERSONAS.length);
    expect(PERSONA_VOICES).toHaveLength(EXAMINER_PERSONAS.length);
    expect(getPersona("nobody").id).toBe(DEFAULT_PERSONA_ID);
    expect(getPersona(undefined).id).toBe(DEFAULT_PERSONA_ID);
    for (const p of EXAMINER_PERSONAS) expect(getPersona(p.id)).toBe(p);
  });
});

describe("exam constants", () => {
  it("defines tasks and minutes for every level, Collaborative only from ISE II", () => {
    for (const { value } of EXAM_LEVELS) {
      for (const t of ORAL_TASKS_BY_LEVEL[value]) expect(ORAL_TASK_MINUTES[value][t]).toBeGreaterThan(0);
    }
    expect(ORAL_TASKS_BY_LEVEL.ISE_I).not.toContain("COLLABORATIVE");
    expect(ORAL_TASKS_BY_LEVEL.ISE_II).toContain("COLLABORATIVE");
  });
});

describe("dictionaries", () => {
  type Tree = { [k: string]: string | Tree };
  const flatten = (t: Tree, prefix = ""): Record<string, string> =>
    Object.entries(t).reduce<Record<string, string>>((acc, [k, v]) => {
      const key = prefix ? `${prefix}.${k}` : k;
      return typeof v === "string" ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) };
    }, {});
  const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(DICTIONARIES[l] as unknown as Tree)]));
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it("has the same keys in every language", () => {
    const en = Object.keys(flat.en).sort();
    for (const l of LOCALES) expect(Object.keys(flat[l]).sort()).toEqual(en);
    expect(LOCALES).toContain(DEFAULT_LOCALE);
    for (const l of LOCALES) expect(LOCALE_META[l].native).toBeTruthy();
  });

  it("never leaves a translation empty", () => {
    for (const l of LOCALES) {
      const empty = Object.entries(flat[l]).filter(([, v]) => v.trim() === "").map(([k]) => k);
      expect(empty, `${l}: empty strings`).toEqual([]);
    }
  });

  it("uses the same {placeholders} in every language", () => {
    const mismatches: string[] = [];
    for (const [key, en] of Object.entries(flat.en)) {
      for (const l of LOCALES) {
        if (JSON.stringify(placeholders(flat[l][key])) !== JSON.stringify(placeholders(en))) mismatches.push(`${l}:${key}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("clerk appearance", () => {
  it("styles the dark sign-in", () => {
    expect(clerkDarkAppearance).toBeTruthy();
  });
});

describe("downscaleImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  const fakeCanvas = (blob: Blob | null, ctx: object | null = { drawImage: vi.fn() }) => ({
    width: 0, height: 0,
    getContext: () => ctx,
    toBlob: (cb: (b: Blob | null) => void) => cb(blob),
  });
  const bitmap = (width: number, height: number) => ({ width, height, close: vi.fn() });

  it("leaves non-images and small photos alone", async () => {
    const txt = new File(["x"], "a.txt", { type: "text/plain" });
    expect(await downscaleImage(txt)).toBe(txt);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap(800, 600)));
    const small = new File(["x"], "a.png", { type: "image/png" });
    expect(await downscaleImage(small)).toBe(small);
  });

  it("shrinks big photos to JPEG", async () => {
    const canvas = fakeCanvas(new Blob(["jpg"], { type: "image/jpeg" }));
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap(4000, 3000)));
    vi.stubGlobal("document", { createElement: () => canvas });
    const out = await downscaleImage(new File(["x"], "IMG_1.HEIC.png", { type: "image/png" }), 1600);
    expect(out.name).toBe("IMG_1.HEIC.jpg");
    expect(out.type).toBe("image/jpeg");
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
  });

  it("falls back to the original file when the browser can't help", async () => {
    const big = new File(["x"], "a.png", { type: "image/png" });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap(4000, 3000)));
    vi.stubGlobal("document", { createElement: () => fakeCanvas(null, null) });
    expect(await downscaleImage(big)).toBe(big);
    vi.stubGlobal("document", { createElement: () => fakeCanvas(null) });
    expect(await downscaleImage(big)).toBe(big);
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("HEIC")));
    expect(await downscaleImage(big)).toBe(big);
  });
});
