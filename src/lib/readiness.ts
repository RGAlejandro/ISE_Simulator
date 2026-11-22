/**
 * Trinity Readiness Score — pure, explainable engine (no AI).
 *
 * 1. Every marked piece of practice becomes an Observation on a COMMON BAND
 *    SCALE for one of the four ISE skills: 50 = Pass, 65 = Merit,
 *    80 = Distinction, 100 = full marks. Each source keeps its own official
 *    thresholds (e.g. writing criteria 0-4 with Pass = 2; spoken tasks 0-20
 *    with Pass = 10) and is mapped piecewise-linearly onto that scale.
 * 2. Per skill, a recency-weighted mean is shrunk towards a cautious prior
 *    (just below Pass) — little evidence ⇒ estimate near the prior and a wide
 *    uncertainty band.
 * 3. P(pass skill) = Φ((mean − 50) / σ), σ combining the uncertainty of the
 *    mean, exam-day variability and staleness of the evidence.
 * 4. Trinity ISE needs a Pass in Reading, Writing, Speaking and Listening.
 *    The four outcomes aren't independent (general proficiency and the day
 *    itself move them together), so they're combined with a one-factor
 *    Gaussian model (equicorrelation SKILL_CORRELATION) instead of a plain
 *    product, which would overstate the risk for consistent candidates.
 * 5. Re-running the estimate at past dates gives the trajectory; a linear trend
 *    over it projects when P(pass) reaches the 80 % "ready" line.
 */

export type Skill = "reading" | "writing" | "speaking" | "listening";
export const SKILLS: Skill[] = ["reading", "writing", "speaking", "listening"];

export type Band = "below" | "pass" | "merit" | "distinction";
export type Confidence = "none" | "low" | "medium" | "high";
export type ObservationSource = "mockReading" | "mockWriting" | "writingLab" | "oralExam" | "oralListening" | "listening" | "readingExplorer";

export interface Observation {
  skill: Skill;
  /** Band scale: 50 = Pass, 65 = Merit, 80 = Distinction. */
  value: number;
  /** Source weight: 1 = exam-format evidence, lower for practice formats. */
  weight: number;
  at: Date;
  source: ObservationSource;
}

export interface CriterionObservation {
  skill: Skill;
  /** Trinity criterion key, e.g. "languageControl", "delivery". */
  key: string;
  /** 0-1 of the criterion maximum; 0.5 ≈ the Pass line on both Trinity scales. */
  value: number;
  at: Date;
}

export interface SkillEstimate {
  skill: Skill;
  /** Estimated performance on the band scale. */
  mean: number;
  /** Total uncertainty (band-scale points) used for the probability. */
  sd: number;
  pPass: number;
  band: Band;
  confidence: Confidence;
  /** Number of observations used. */
  count: number;
  /** ISO timestamp of the latest observation (serialisable for client components). */
  lastAt: string | null;
}

export type ActionReason = "noEvidence" | "belowPass" | "belowTarget" | "lowConfidence" | "nextBand";

/** Trinity ISE modules are passed separately; a learner may only have one left. */
export type ExamModulesValue = "BOTH" | "READING_WRITING" | "SPEAKING_LISTENING";
export type TargetBandValue = "PASS" | "MERIT" | "DISTINCTION";
export const MODULE_SKILLS: Record<ExamModulesValue, Skill[]> = {
  BOTH: ["reading", "writing", "speaking", "listening"],
  READING_WRITING: ["reading", "writing"],
  SPEAKING_LISTENING: ["speaking", "listening"],
};

export interface ReadinessAction {
  skill: Skill;
  reason: ActionReason;
}

export interface ReadinessReport {
  asOf: string;
  overall: { pPass: number; band: Band; confidence: Confidence; limitingSkill: Skill | null; observations: number };
  skills: SkillEstimate[];
  /** Weekly P(pass) history, oldest first (only points with any evidence). */
  trajectory: { at: string; pPass: number }[];
  projection: {
    readyNow: boolean;
    /** ISO date when P(pass) is projected to reach READY_LINE, if trending up. */
    readyBy: string | null;
    /** Change in P(pass) per week from the recent trend (null = not enough history). */
    trendPerWeek: number | null;
    examDate: string | null;
    /** Positive = ready that many days before the exam; negative = after it. */
    marginDays: number | null;
  };
  weakestCriteria: { skill: Skill; key: string; value: number; count: number }[];
  /** Every criterion with evidence, weakest first (team heatmap). */
  criteria: { skill: Skill; key: string; value: number; count: number }[];
  activity: { lastAt: string | null; attempts7d: number };
  /** Ready now, or projected to be ready (before the exam, when there is one). */
  onTrack: boolean;
  actions: ReadinessAction[];
  /** What the probabilities are about: which module(s), and the band aimed for. */
  focus: { modules: ExamModulesValue; target: TargetBandValue };
}

// ─── constants (documented on the methodology panel) ────────────────────────

export const PASS = 50;
export const MERIT = 65;
export const DISTINCTION = 80;
export const READY_LINE = 0.8;
/** Band-scale score each target band requires. */
export const TARGET_SCORE: Record<TargetBandValue, number> = { PASS: 50, MERIT: 65, DISTINCTION: 80 };

const PRIOR_MEAN = 45;
const PRIOR_WEIGHT = 1;
const HALF_LIFE_DAYS = 21;
const DEFAULT_OBS_SD = 14;
const EXAM_DAY_SD = 7;
const DAY_MS = 86_400_000;
/** Correlation between skills' exam-day deviations (shared ability + shared day). */
const SKILL_CORRELATION = 0.5;

// ─── mapping each source onto the band scale ────────────────────────────────

/** Piecewise-linear map through (raw, band) anchor points, clamped to 0-100. */
export function toBandScale(raw: number, anchors: [number, number][]): number {
  if (!Number.isFinite(raw)) return 0;
  const pts = [...anchors].sort((a, b) => a[0] - b[0]);
  if (raw <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x0, y0] = pts[i - 1];
    if (raw <= x1) return y0 + ((raw - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pts[pts.length - 1][1];
}

/** Percent-correct style scores (reading questions, listening sessions): identity with the app-wide bands. */
export const percentToBand = (pct: number) => toBandScale(pct, [[0, 0], [100, 100]]);
/** Trinity Reading & Writing criteria average, 0-4: 2 = Pass, 2.5 = Merit, 3.5 = Distinction. */
export const writingMeanToBand = (mean04: number) => toBandScale(mean04, [[0, 0], [2, PASS], [2.5, MERIT], [3.5, DISTINCTION], [4, 100]]);
/** Spoken task total, 0-20 (4 criteria × 0-5): 10 = Pass, 13 = Merit, 17 = Distinction. */
export const spokenToBand = (score20: number) => toBandScale(score20, [[0, 0], [10, PASS], [13, MERIT], [17, DISTINCTION], [20, 100]]);
/** Independent Listening task, 0-5: 3 = Pass, 4 = Merit, 5 = Distinction. */
export const oralListeningToBand = (score5: number) => toBandScale(score5, [[0, 0], [3, PASS], [4, MERIT], [5, 90]]);

export function bandFor(value: number): Band {
  if (value >= DISTINCTION) return "distinction";
  if (value >= MERIT) return "merit";
  if (value >= PASS) return "pass";
  return "below";
}

const BAND_ORDER: Band[] = ["below", "pass", "merit", "distinction"];

// ─── maths ──────────────────────────────────────────────────────────────────

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

function confidenceFor(evidence: number): Confidence {
  if (evidence <= 0) return "none";
  if (evidence < 1.5) return "low";
  if (evidence < 4) return "medium";
  return "high";
}

/** Estimate one skill from the observations available at `asOf`. */
export function estimateSkill(skill: Skill, all: Observation[], asOf: Date, threshold = PASS): SkillEstimate {
  const obs = all.filter((o) => o.skill === skill && o.at <= asOf);
  if (obs.length === 0) {
    const sd = Math.round(Math.hypot(DEFAULT_OBS_SD / Math.sqrt(PRIOR_WEIGHT), EXAM_DAY_SD) * 10) / 10;
    return { skill, mean: PRIOR_MEAN, sd, pPass: normalCdf((PRIOR_MEAN - threshold) / sd), band: bandFor(PRIOR_MEAN), confidence: "none", count: 0, lastAt: null };
  }
  const latest = obs.reduce((m, o) => (o.at > m ? o.at : m), obs[0].at);
  // Recency is relative to the latest attempt: older attempts count less, but
  // a pause in practice doesn't drag the estimate down — it widens the doubt instead.
  const weights = obs.map((o) => o.weight * 0.5 ** ((latest.getTime() - o.at.getTime()) / DAY_MS / HALF_LIFE_DAYS));
  const evidence = weights.reduce((a, b) => a + b, 0);
  const mean = (PRIOR_WEIGHT * PRIOR_MEAN + obs.reduce((s, o, i) => s + weights[i] * o.value, 0)) / (PRIOR_WEIGHT + evidence);

  let obsSd = DEFAULT_OBS_SD;
  if (obs.length >= 3) {
    const v = obs.reduce((s, o, i) => s + weights[i] * (o.value - mean) ** 2, 0) / evidence;
    obsSd = Math.min(25, Math.max(8, Math.sqrt(v)));
  }
  const staleDays = (asOf.getTime() - latest.getTime()) / DAY_MS;
  const staleSd = Math.min(10, Math.max(0, (staleDays / 30) * 4));
  const sd = Math.sqrt((obsSd / Math.sqrt(PRIOR_WEIGHT + evidence)) ** 2 + EXAM_DAY_SD ** 2 + staleSd ** 2);

  return {
    skill,
    mean: Math.round(mean * 10) / 10,
    sd: Math.round(sd * 10) / 10,
    pPass: normalCdf((mean - threshold) / sd),
    band: bandFor(mean),
    // Old evidence is still evidence, but we're less sure it describes you today.
    confidence: confidenceFor(evidence * 0.5 ** (staleDays / 60)),
    count: obs.length,
    lastAt: latest.toISOString(),
  };
}

/**
 * P(every skill passes) with a shared factor U: skill_i passes when
 * √ρ·U + √(1-ρ)·E_i > −z_i. Integrates E_U[Π Φ((z_i + √ρ·U)/√(1-ρ))] with
 * Simpson's rule; for a single skill it reduces exactly to Φ(z).
 */
export function jointPassProbability(zs: number[], rho = SKILL_CORRELATION): number {
  if (zs.length === 0) return 0;
  const a = Math.sqrt(rho);
  const b = Math.sqrt(1 - rho);
  const n = 160;
  const lo = -6;
  const h = 12 / n;
  let sum = 0;
  for (let k = 0; k <= n; k++) {
    const u = lo + k * h;
    const w = k === 0 || k === n ? 1 : k % 2 ? 4 : 2;
    let prod = 1;
    for (const z of zs) prod *= normalCdf((z + a * u) / b);
    sum += w * (Math.exp(-(u * u) / 2) / Math.sqrt(2 * Math.PI)) * prod;
  }
  return Math.min(1, Math.max(0, (sum * h) / 3));
}

function overallFrom(skills: SkillEstimate[], threshold = PASS) {
  const pPass = jointPassProbability(skills.map((s) => (s.mean - threshold) / s.sd));
  const lowest = skills.reduce((m, s) => (s.mean < m.mean ? s : m), skills[0]);
  const confidence = skills.reduce<Confidence>((c, s) => {
    const order: Confidence[] = ["none", "low", "medium", "high"];
    return order.indexOf(s.confidence) < order.indexOf(c) ? s.confidence : c;
  }, "high");
  const band = skills.reduce<Band>((b, s) => (BAND_ORDER.indexOf(s.band) < BAND_ORDER.indexOf(b) ? s.band : b), "distinction");
  return { pPass, band, confidence, limitingSkill: lowest?.skill ?? null };
}

function linearSlope(points: { x: number; y: number }[]): number | null {
  if (points.length < 3) return null;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const den = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (den === 0) return null;
  return points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / den;
}

function aggregateCriteria(criteria: CriterionObservation[]) {
  const groups = new Map<string, { skill: Skill; key: string; sum: number; w: number; count: number }>();
  const latest = criteria.reduce((m, c) => Math.max(m, c.at.getTime()), 0);
  for (const c of criteria) {
    const id = `${c.skill}:${c.key}`;
    const w = 0.5 ** ((latest - c.at.getTime()) / DAY_MS / HALF_LIFE_DAYS);
    const g = groups.get(id) ?? { skill: c.skill, key: c.key, sum: 0, w: 0, count: 0 };
    g.sum += w * c.value;
    g.w += w;
    g.count++;
    groups.set(id, g);
  }
  return [...groups.values()]
    .map((g) => ({ skill: g.skill, key: g.key, value: Math.round((g.sum / g.w) * 100) / 100, count: g.count }))
    .sort((a, b) => a.value - b.value);
}

export function computeReadiness(
  observations: Observation[],
  criteria: CriterionObservation[],
  opts: { now?: Date; examDate?: Date | null; weeks?: number; modules?: ExamModulesValue; target?: TargetBandValue } = {},
): ReadinessReport {
  const now = opts.now ?? new Date();
  const modules = opts.modules ?? "BOTH";
  const target = opts.target ?? "PASS";
  const focusSkills = MODULE_SKILLS[modules];
  const threshold = TARGET_SCORE[target];
  const skills = focusSkills.map((s) => estimateSkill(s, observations, now, threshold));
  const overall = overallFrom(skills, threshold);

  // Weekly trajectory (only weeks where at least one observation existed).
  const weeks = opts.weeks ?? 8;
  const trajectory: ReadinessReport["trajectory"] = [];
  for (let w = weeks; w >= 0; w--) {
    const at = new Date(now.getTime() - w * 7 * DAY_MS);
    if (!observations.some((o) => o.at <= at && focusSkills.includes(o.skill))) continue;
    const p = overallFrom(focusSkills.map((s) => estimateSkill(s, observations, at, threshold)), threshold).pPass;
    trajectory.push({ at: at.toISOString().slice(0, 10), pPass: Math.round(p * 1000) / 1000 });
  }

  const recent = trajectory.slice(-5).map((p) => ({ x: new Date(p.at).getTime() / DAY_MS, y: p.pPass }));
  const slopePerDay = linearSlope(recent);
  const readyNow = overall.pPass >= READY_LINE;
  let readyBy: string | null = null;
  if (!readyNow && slopePerDay && slopePerDay > 0.0015) {
    const days = Math.ceil((READY_LINE - overall.pPass) / slopePerDay);
    if (days <= 365) readyBy = new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10);
  }
  const examDate = opts.examDate ?? null;
  const marginDays =
    examDate && (readyNow || readyBy)
      ? Math.round((examDate.getTime() - (readyNow ? now.getTime() : new Date(readyBy!).getTime())) / DAY_MS)
      : null;

  const past = observations.filter((o) => o.at <= now && focusSkills.includes(o.skill));
  const allCriteria = aggregateCriteria(criteria.filter((c) => c.at <= now && focusSkills.includes(c.skill)));

  // Actions: the skills holding the probability down, most urgent first.
  const actions: ReadinessAction[] = [...skills]
    .sort((a, b) => a.pPass - b.pPass)
    .map((s): ReadinessAction => ({
      skill: s.skill,
      reason: s.count === 0 ? "noEvidence" : s.mean < PASS ? "belowPass" : s.mean < threshold ? "belowTarget" : s.confidence === "low" ? "lowConfidence" : "nextBand",
    }))
    .slice(0, 3);

  return {
    asOf: now.toISOString(),
    overall: { ...overall, pPass: Math.round(overall.pPass * 1000) / 1000, observations: past.length },
    skills,
    trajectory,
    projection: {
      readyNow,
      readyBy,
      trendPerWeek: slopePerDay === null ? null : Math.round(slopePerDay * 7 * 1000) / 1000,
      examDate: examDate ? examDate.toISOString().slice(0, 10) : null,
      marginDays,
    },
    weakestCriteria: allCriteria.slice(0, 3),
    criteria: allCriteria,
    activity: {
      lastAt: past.length ? new Date(Math.max(...past.map((o) => o.at.getTime()))).toISOString() : null,
      attempts7d: past.filter((o) => now.getTime() - o.at.getTime() <= 7 * DAY_MS).length,
    },
    onTrack: readyNow || (readyBy !== null && (marginDays === null || marginDays >= 0)),
    actions,
    focus: { modules, target },
  };
}
