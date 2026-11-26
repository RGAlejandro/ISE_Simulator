import { afterEach, describe, expect, it, vi } from "vitest";
import { BOX_INTERVAL_DAYS, LEARNED_BOX, MAX_BOX, canGapFill, exerciseForBox, nextReview } from "@/lib/srs";
import {
  ACHIEVEMENTS, dayStart, daysBetween, levelFromXp, totalXpForLevel, unlockedAchievementIds, weekStart,
} from "@/lib/gamification";
import { parseAIJson } from "@/lib/parse-json";
import { cn } from "@/lib/utils";
import { findYouTubeUrl } from "@/lib/youtube";
import { daysUntil, leastPractisedGenre, phaseFor, startOfWeek, weeklyTargets } from "@/lib/study-plan";
import { validateEnv } from "@/lib/env";

describe("srs", () => {
  const now = new Date(2026, 10, 25, 15, 30);

  it("moves a word up one box on a right answer, due at the start of that day", () => {
    const r = nextReview(2, true, now);
    expect(r.box).toBe(3);
    expect(BOX_INTERVAL_DAYS[3]).toBe(7);
    expect(r.dueAt).toEqual(new Date(2026, 11, 2, 0, 0, 0, 0));
  });

  it("sends a new word to box 1 and never past the last box", () => {
    expect(nextReview(0, true, now).box).toBe(1);
    expect(nextReview(MAX_BOX, true, now).box).toBe(MAX_BOX);
  });

  it("sends a wrong answer back to box 1 (review tomorrow)", () => {
    const r = nextReview(5, false, now);
    expect(r.box).toBe(1);
    expect(r.dueAt.getDate()).toBe(26);
  });

  it("picks the exercise by box", () => {
    expect(exerciseForBox(0)).toBe("complete");
    expect(exerciseForBox(1)).toBe("complete");
    expect(exerciseForBox(LEARNED_BOX)).toBe("gapfill");
  });

  it("only gap-fills when the example contains the word (or an inflection)", () => {
    expect(canGapFill("She decided to give up smoking.", "give up")).toBe(true);
    expect(canGapFill("He walked home.", "walk")).toBe(true);
    expect(canGapFill("It was raining.", "snow")).toBe(false);
    // Regex characters in the word are escaped.
    expect(canGapFill("Use C++ daily.", "c++")).toBe(false);
  });
});

describe("gamification", () => {
  it("needs growing XP per level", () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(50);
    expect(totalXpForLevel(5)).toBe(500);
    expect(totalXpForLevel(0)).toBe(0);
  });

  it("works out the level and the progress inside it", () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, progress: 0 });
    expect(levelFromXp(-20).level).toBe(1);
    const l = levelFromXp(200);
    expect(l.level).toBe(3);
    expect(l.xpIntoLevel).toBe(50);
    expect(l.xpForNextLevel).toBe(150);
    expect(l.progress).toBeCloseTo(1 / 3);
  });

  it("starts the week on Monday (UTC) and compares calendar days", () => {
    expect(weekStart(new Date(Date.UTC(2026, 10, 25))).toISOString().slice(0, 10)).toBe("2026-11-23");
    expect(weekStart(new Date(Date.UTC(2026, 10, 29))).toISOString().slice(0, 10)).toBe("2026-11-23");
    expect(dayStart(new Date(Date.UTC(2026, 10, 25, 22))).toISOString()).toBe("2026-11-25T00:00:00.000Z");
    expect(daysBetween(new Date(Date.UTC(2026, 10, 25, 23)), new Date(Date.UTC(2026, 10, 27, 1)))).toBe(2);
    expect(weekStart()).toBeInstanceOf(Date);
    expect(dayStart()).toBeInstanceOf(Date);
  });

  it("unlocks achievements from the stats", () => {
    expect(unlockedAchievementIds({ xp: 0, longestStreak: 0, totalCorrect: 0, questsDone: 0 })).toEqual([]);
    const all = unlockedAchievementIds({ xp: 5000, longestStreak: 30, totalCorrect: 500, questsDone: 25 });
    expect(all).toEqual(ACHIEVEMENTS.map((a) => a.id));
  });
});

describe("parseAIJson", () => {
  it("parses plain JSON and fenced JSON", () => {
    expect(parseAIJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseAIJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(parseAIJson("```\n[1,2]\n```")).toEqual([1, 2]);
  });

  it("digs the JSON out of surrounding prose", () => {
    expect(parseAIJson('Sure! Here it is: {"ok":true} Hope it helps')).toEqual({ ok: true });
    expect(parseAIJson("List: [1, 2, 3]. Done")).toEqual([1, 2, 3]);
  });

  it("throws a retryable error on malformed output", () => {
    expect(() => parseAIJson("no json here")).toThrow(/Failed to generate JSON/);
    expect(() => parseAIJson("{ broken: ")).toThrow(/Failed to generate JSON/);
    expect(() => parseAIJson("{ still } broken }")).toThrow(/Failed to generate JSON/);
  });
});

describe("cn", () => {
  it("merges classes and resolves Tailwind conflicts", () => {
    expect(cn("p-2", false && "hidden", "p-4", ["text-sm"])).toBe("p-4 text-sm");
  });
});

describe("findYouTubeUrl", () => {
  it("finds watch, short, live, embed and youtu.be links", () => {
    const id = "dQw4w9WgXcQ";
    const want = `https://www.youtube.com/watch?v=${id}`;
    expect(findYouTubeUrl(`mira https://www.youtube.com/watch?v=${id}&t=10`)).toBe(want);
    expect(findYouTubeUrl(`https://youtube.com/watch?feature=share&v=${id}`)).toBe(want);
    expect(findYouTubeUrl(`https://youtube.com/shorts/${id}`)).toBe(want);
    expect(findYouTubeUrl(`https://youtu.be/${id}`)).toBe(want);
    expect(findYouTubeUrl(`https://www.youtube.com/embed/${id}`)).toBe(want);
    expect(findYouTubeUrl(`https://www.youtube.com/live/${id}`)).toBe(want);
  });

  it("returns null without a YouTube link", () => {
    expect(findYouTubeUrl("https://vimeo.com/123")).toBeNull();
  });
});

describe("study plan", () => {
  it("counts calendar days to the exam", () => {
    const today = new Date(2026, 10, 25, 18);
    expect(daysUntil(new Date(Date.UTC(2026, 11, 2)), today)).toBe(7);
    expect(daysUntil(new Date(Date.UTC(2026, 10, 25)), today)).toBe(0);
    expect(daysUntil(new Date(Date.UTC(2026, 10, 20)), today)).toBe(-5);
    expect(typeof daysUntil(new Date())).toBe("number");
  });

  it("maps days left to a phase", () => {
    expect(phaseFor(-1)).toBe("past");
    expect(phaseFor(0)).toBe("examDay");
    expect(phaseFor(3)).toBe("taper");
    expect(phaseFor(14)).toBe("simulate");
    expect(phaseFor(28)).toBe("intensify");
    expect(phaseFor(60)).toBe("build");
  });

  it("gives the week's targets for the phase, skipping zero targets", () => {
    const stats = { writing: 1, reviewDays: 4, reading: 0, oral: 2, mock: 0 };
    const t = weeklyTargets("simulate", stats);
    expect(t.map((x) => x.key)).toEqual(["writing", "review", "oral", "mock"]);
    expect(t.find((x) => x.key === "review")).toEqual({ key: "review", done: 4, target: 6, href: "/vocabulary/review" });
    expect(weeklyTargets("examDay", stats)).toEqual([]);
  });

  it("starts the week on Monday (local)", () => {
    const monday = startOfWeek(new Date(2026, 10, 29, 12));
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(23);
    expect(startOfWeek().getDay()).toBe(1);
  });

  it("finds the least practised genre, first one on ties", () => {
    expect(leastPractisedGenre(["essay", "article", "report"], { essay: 2, article: 0, report: 1 })).toBe("article");
    expect(leastPractisedGenre(["essay", "article"], {})).toBe("essay");
  });
});

describe("validateEnv", () => {
  const full = {
    DATABASE_URL: "postgres://x", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk", CLERK_SECRET_KEY: "sk",
    STRIPE_SECRET_KEY: "s", STRIPE_WEBHOOK_SECRET: "w", STRIPE_PRO_MONTHLY_PRICE_ID: "m",
    STRIPE_PRO_YEARLY_PRICE_ID: "y", NEXT_PUBLIC_APP_URL: "http://x", GROQ_API_KEY: "g",
  };
  const stubAll = (vars: Record<string, string>) => {
    for (const k of [...Object.keys(full), "GEMINI_API_KEY", "OPENROUTER_API_KEY"]) vi.stubEnv(k, "");
    for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  };
  afterEach(() => vi.unstubAllEnvs());

  it("passes silently when everything is set", () => {
    stubAll(full);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateEnv();
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns in development, naming placeholders and the missing AI key", () => {
    stubAll({ ...full, STRIPE_WEBHOOK_SECRET: "whsec_your_secret_here", GROQ_API_KEY: "" });
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateEnv();
    expect(warn.mock.calls[0][0]).toMatch(/STRIPE_WEBHOOK_SECRET/);
    expect(warn.mock.calls[0][0]).toMatch(/GROQ_API_KEY \| GEMINI_API_KEY/);
  });

  it("throws in production", () => {
    stubAll({ ...full, DATABASE_URL: "" });
    vi.stubEnv("NODE_ENV", "production");
    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });
});
