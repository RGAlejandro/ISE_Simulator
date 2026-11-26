import { describe, expect, it } from "vitest";
import {
  MODULE_SKILLS, PASS, bandFor, computeReadiness, estimateSkill, jointPassProbability, normalCdf, oralListeningToBand,
  percentToBand, spokenToBand, toBandScale, writingMeanToBand, type CriterionObservation, type Observation, type Skill,
} from "@/lib/readiness";

const DAY = 86_400_000;
const now = new Date("2026-11-25T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const obs = (skill: Skill, value: number, daysAgo: number, weight = 1): Observation =>
  ({ skill, value, weight, at: ago(daysAgo), source: "mockReading" });

describe("band scale", () => {
  it("maps each source's official thresholds onto 50/65/80", () => {
    expect(writingMeanToBand(2)).toBe(PASS);
    expect(writingMeanToBand(2.5)).toBe(65);
    expect(writingMeanToBand(3.5)).toBe(80);
    expect(writingMeanToBand(1)).toBe(25);
    expect(spokenToBand(10)).toBe(50);
    expect(spokenToBand(17)).toBe(80);
    expect(oralListeningToBand(3)).toBe(50);
    expect(oralListeningToBand(5)).toBe(90);
    expect(percentToBand(73)).toBe(73);
  });

  it("clamps outside the anchors and survives bad input", () => {
    expect(toBandScale(-3, [[0, 0], [10, 100]])).toBe(0);
    expect(toBandScale(30, [[10, 100], [0, 0]])).toBe(100);
    expect(toBandScale(Number.NaN, [[0, 0], [1, 1]])).toBe(0);
  });

  it("names the band", () => {
    expect([49.9, 50, 65, 80].map(bandFor)).toEqual(["below", "pass", "merit", "distinction"]);
  });
});

describe("maths", () => {
  it("approximates the normal CDF", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("reduces the joint probability to Φ for one skill and lowers it for more", () => {
    expect(jointPassProbability([])).toBe(0);
    expect(jointPassProbability([1])).toBeCloseTo(normalCdf(1), 3);
    const two = jointPassProbability([1, 1]);
    expect(two).toBeLessThan(normalCdf(1));
    // Correlated skills: better than treating them as independent.
    expect(two).toBeGreaterThan(normalCdf(1) ** 2);
  });
});

describe("estimateSkill", () => {
  it("falls back to a cautious prior without evidence", () => {
    const e = estimateSkill("writing", [], now);
    expect(e).toMatchObject({ mean: 45, confidence: "none", count: 0, lastAt: null, band: "below" });
    expect(e.pPass).toBeLessThan(0.5);
  });

  it("moves towards the evidence and grows confident with more of it", () => {
    const one = estimateSkill("reading", [obs("reading", 80, 1)], now);
    expect(one.mean).toBeGreaterThan(45);
    expect(one.mean).toBeLessThan(80);
    expect(one.confidence).toBe("low");
    const many = estimateSkill("reading", [70, 75, 72, 78, 74].map((v, i) => obs("reading", v, i)), now);
    expect(many.confidence).toBe("high");
    expect(many.pPass).toBeGreaterThan(0.9);
    expect(many.count).toBe(5);
    expect(estimateSkill("reading", [obs("reading", 70, 1), obs("reading", 72, 2)], now).confidence).toBe("medium");
  });

  it("ignores other skills and future evidence, and doubts stale evidence", () => {
    expect(estimateSkill("speaking", [obs("reading", 90, 1), obs("speaking", 90, -5)], now).count).toBe(0);
    const fresh = estimateSkill("reading", [obs("reading", 70, 1)], now);
    const stale = estimateSkill("reading", [obs("reading", 70, 120)], now);
    expect(stale.sd).toBeGreaterThan(fresh.sd);
  });

  it("uses a higher threshold for a higher target", () => {
    const o = [obs("writing", 60, 1), obs("writing", 62, 3), obs("writing", 61, 5)];
    expect(estimateSkill("writing", o, now, 65).pPass).toBeLessThan(estimateSkill("writing", o, now, PASS).pPass);
  });
});

describe("computeReadiness", () => {
  const strong = (skill: Skill) => [72, 75, 70, 78].map((v, i) => obs(skill, v, i * 3));

  it("reports all four skills by default and the limiting one", () => {
    const r = computeReadiness([...strong("reading"), ...strong("speaking"), obs("writing", 40, 2), obs("writing", 38, 9)], [], { now });
    expect(r.skills.map((s) => s.skill)).toEqual(MODULE_SKILLS.BOTH);
    // Writing (~42) sits below the no-evidence prior (45) of Listening.
    expect(r.overall.limitingSkill).toBe("writing");
    expect(r.actions[0]).toEqual({ skill: "writing", reason: "belowPass" });
    expect(r.actions).toContainEqual({ skill: "listening", reason: "noEvidence" });
    expect(r.focus).toEqual({ modules: "BOTH", target: "PASS" });
    expect(r.onTrack).toBe(false);
  });

  it("only looks at the module the learner still has to pass", () => {
    const all = [...strong("reading"), ...strong("writing"), obs("listening", 20, 1)];
    const rw = computeReadiness(all, [], { now, modules: "READING_WRITING" });
    expect(rw.skills.map((s) => s.skill)).toEqual(["reading", "writing"]);
    expect(rw.overall.pPass).toBeGreaterThan(computeReadiness(all, [], { now }).overall.pPass);
    expect(rw.overall.observations).toBe(8);
    expect(rw.projection.readyNow).toBe(true);
    expect(rw.onTrack).toBe(true);
  });

  it("explains a skill below the target band", () => {
    const o = [...strong("reading"), ...[60, 58, 62, 61].map((v, i) => obs("writing", v, i))];
    const r = computeReadiness(o, [], { now, modules: "READING_WRITING", target: "MERIT" });
    expect(r.actions[0]).toEqual({ skill: "writing", reason: "belowTarget" });
    const pass = computeReadiness(o, [], { now, modules: "READING_WRITING" });
    expect(pass.actions.map((a) => a.reason)).toContain("nextBand");
  });

  it("flags low confidence when a skill has little evidence", () => {
    const r = computeReadiness([...strong("reading"), obs("writing", 70, 1)], [], { now, modules: "READING_WRITING" });
    expect(r.actions.find((a) => a.skill === "writing")?.reason).toBe("lowConfidence");
  });

  it("builds a weekly trajectory and projects when the learner will be ready", () => {
    // Steady improvement over six weeks, still under the ready line today.
    const rising = [0, 1, 2, 3, 4, 5, 6].flatMap((w) => [
      obs("reading", 40 + (6 - w) * 3, w * 7),
      obs("writing", 40 + (6 - w) * 3, w * 7 + 1),
    ]);
    const r = computeReadiness(rising, [], { now, modules: "READING_WRITING", examDate: new Date("2027-06-01T00:00:00Z") });
    expect(r.trajectory.length).toBeGreaterThanOrEqual(5);
    expect(r.projection.trendPerWeek).toBeGreaterThan(0);
    if (!r.projection.readyNow) {
      expect(r.projection.readyBy).not.toBeNull();
      expect(r.projection.marginDays).toBeGreaterThan(0);
      expect(r.onTrack).toBe(true);
    }
    expect(r.projection.examDate).toBe("2027-06-01");
  });

  it("counts the margin before the exam when ready now", () => {
    const r = computeReadiness([...strong("reading"), ...strong("writing")], [], { now, modules: "READING_WRITING", examDate: new Date("2026-12-02T00:00:00Z") });
    expect(r.projection.readyNow).toBe(true);
    expect(r.projection.marginDays).toBe(7);
    expect(r.projection.readyBy).toBeNull();
  });

  it("aggregates criteria (recent ones count more), weakest first", () => {
    const criteria: CriterionObservation[] = [
      { skill: "writing", key: "languageControl", value: 0.25, at: ago(1) },
      { skill: "writing", key: "languageControl", value: 0.75, at: ago(60) },
      { skill: "writing", key: "organisation", value: 0.6, at: ago(2) },
      { skill: "speaking", key: "delivery", value: 0.1, at: ago(2) },
      { skill: "writing", key: "taskFulfilment", value: 0.9, at: ago(-3) },
    ];
    const r = computeReadiness([obs("writing", 50, 1)], criteria, { now, modules: "READING_WRITING" });
    expect(r.criteria.map((c) => c.key)).toEqual(["languageControl", "organisation"]);
    expect(r.criteria[0].value).toBeLessThan(0.4);
    expect(r.criteria[0].count).toBe(2);
    expect(r.weakestCriteria).toHaveLength(2);
  });

  it("reports recent activity and handles no evidence at all", () => {
    const r = computeReadiness([obs("reading", 60, 2), obs("reading", 60, 20)], [], { now });
    expect(r.activity.attempts7d).toBe(1);
    expect(r.activity.lastAt).toBe(ago(2).toISOString());
    const empty = computeReadiness([], [], {});
    expect(empty.trajectory).toEqual([]);
    expect(empty.activity).toEqual({ lastAt: null, attempts7d: 0 });
    expect(empty.projection).toMatchObject({ readyNow: false, readyBy: null, trendPerWeek: null, marginDays: null });
  });
});
