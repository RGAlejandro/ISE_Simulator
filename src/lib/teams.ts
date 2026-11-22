/**
 * Teams — pure helpers shared by the server loader, API routes and UI.
 */

export type AssignmentKindValue = "WRITTEN" | "ORAL" | "LISTENING" | "WRITING" | "READING" | "REVIEW";
export const ASSIGNMENT_KINDS: AssignmentKindValue[] = ["WRITTEN", "ORAL", "LISTENING", "WRITING", "READING", "REVIEW"];

/** Where a student goes to do each kind of assignment. */
export const ASSIGNMENT_HREF: Record<AssignmentKindValue, string> = {
  WRITTEN: "/practice?start=written",
  ORAL: "/exam/oral/setup?mode=live",
  LISTENING: "/practice?start=listening",
  WRITING: "/writing",
  READING: "/practice?start=reading",
  REVIEW: "/vocabulary/review",
};

/** Criteria shown as heatmap columns, in reading order (Speaking, then Writing). */
export const HEATMAP_CRITERIA: { skill: "speaking" | "writing"; key: string }[] = [
  { skill: "speaking", key: "communicativeEffectiveness" },
  { skill: "speaking", key: "interactiveListening" },
  { skill: "speaking", key: "languageControl" },
  { skill: "speaking", key: "delivery" },
  { skill: "writing", key: "taskFulfilment" },
  { skill: "writing", key: "organisation" },
  { skill: "writing", key: "languageControl" },
  { skill: "writing", key: "readingForWriting" },
];

// No 0/O/1/I/L: codes get read out loud and typed from slides.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateJoinCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export function isJoinCode(s: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{8}$`).test(s);
}

/** Five equal bins of chance-of-passing (0-20 % … 80-100 %). */
export function histogram(values: number[], bins = 5): { from: number; to: number; count: number }[] {
  const out = Array.from({ length: bins }, (_, i) => ({ from: i / bins, to: (i + 1) / bins, count: 0 }));
  for (const v of values) out[Math.min(bins - 1, Math.max(0, Math.floor(v * bins)))].count++;
  return out;
}

export interface ClassErrorStat {
  tag: string;
  occurrences: number;
  students: number;
}

/** Aggregate error-notebook tags across students: how often, and how many students make each mistake. */
export function aggregateErrorTags(perStudent: Map<string, string[]>, limit = 6): ClassErrorStat[] {
  const stats = new Map<string, { occurrences: number; students: Set<string> }>();
  for (const [student, tags] of perStudent) {
    for (const tag of tags) {
      if (tag === "other") continue;
      const s = stats.get(tag) ?? { occurrences: 0, students: new Set<string>() };
      s.occurrences++;
      s.students.add(student);
      stats.set(tag, s);
    }
  }
  return [...stats.entries()]
    .map(([tag, s]) => ({ tag, occurrences: s.occurrences, students: s.students.size }))
    .sort((a, b) => b.students - a.students || b.occurrences - a.occurrences)
    .slice(0, limit);
}

/** Due dates are picked as calendar days: an assignment is open until the end of that day (UTC). */
export function endOfDayUTC(isoDate: string): Date {
  const d = new Date(`${isoDate}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
}
