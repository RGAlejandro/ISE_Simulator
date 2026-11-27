import { MODULE_SKILLS, type ExamModulesValue, type Skill } from "@/lib/readiness";
import type { ExamLevel } from "@/types";

/** Self-rated confidence per skill from the welcome: 1 struggling, 2 so-so, 3 confident. */
export type SelfRating = 1 | 2 | 3;
export type SelfAssessment = Partial<Record<Skill, SelfRating>>;

/** Tie-break when ratings are equal: the skills whose marking says most about the learner come first. */
const PRIORITY: Skill[] = ["writing", "speaking", "reading", "listening"];

/** A valid self-assessment from untrusted JSON, or null. */
export function parseSelfAssessment(value: unknown): SelfAssessment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: SelfAssessment = {};
  for (const [skill, rating] of Object.entries(value)) {
    if (!PRIORITY.includes(skill as Skill) || (rating !== 1 && rating !== 2 && rating !== 3)) return null;
    out[skill as Skill] = rating;
  }
  return out;
}

/** The goal's skills, weakest self-rating first (an unrated skill counts as so-so). */
export function startingOrder(modules: ExamModulesValue, self: SelfAssessment | null): Skill[] {
  const focus = MODULE_SKILLS[modules];
  return PRIORITY.filter((s) => focus.includes(s)).sort((a, b) => (self?.[a] ?? 2) - (self?.[b] ?? 2));
}

/** Where a first marked exercise for the skill starts, at the learner's level. */
export function diagnosticHref(skill: Skill, level: ExamLevel | null): string {
  switch (skill) {
    case "reading":
      return "/practice?start=reading";
    case "listening":
      return "/practice?start=listening";
    case "writing":
      return level ? `/writing?level=${level}` : "/writing";
    case "speaking":
      return level ? `/exam/oral/setup?mode=live&level=${level}` : "/exam/oral/setup?mode=live";
  }
}

export interface FirstStep {
  skill: Skill;
  href: string;
  /** The learner rated this skill below another one (so the UI can say why it comes first). */
  selfRated: boolean;
}

/** The recommended first exercise: the weakest self-rated skill of the learner's goal. */
export function firstStep(modules: ExamModulesValue, level: ExamLevel | null, self: SelfAssessment | null): FirstStep {
  const [skill, ...rest] = startingOrder(modules, self);
  const rating = self?.[skill];
  const selfRated = rating !== undefined && rest.some((s) => (self?.[s] ?? 0) > rating);
  return { skill, href: diagnosticHref(skill, level), selfRated };
}
