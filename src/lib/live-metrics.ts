/**
 * Live Coach metrics — pure, deterministic, zero AI cost. Computed in the
 * browser on every transcript update during a live oral exam, then stored on
 * the exam (`OralExam.liveMetrics`) for the results page.
 */

export type LiveRole = "EXAMINER" | "CANDIDATE";

export interface LiveTurn {
  id: string;
  role: LiveRole;
  task: string;
  text: string;
  /** ms epoch of the first transcript chunk of this turn. */
  startedAt: number;
  /** ms epoch of the latest transcript chunk of this turn. */
  endedAt: number;
}

export interface FillerCount {
  term: string;
  count: number;
}

export type CoachNudge = "speakMore" | "slowPace" | "fastPace" | "fillers" | "askQuestions" | "useConnectors" | "onTrack";

export interface LiveMetrics {
  candidateWords: number;
  examinerWords: number;
  /** Candidate share of all words spoken (0-1). Trinity expects the candidate to do most of the talking. */
  talkShare: number;
  /** Candidate words per minute of their own speaking time. */
  wpm: number;
  candidateSeconds: number;
  fillers: FillerCount[];
  /** Fillers per 100 candidate words. */
  fillerRate: number;
  /** Moving-average type-token ratio (0-1); length-independent lexical range. */
  lexicalRange: number;
  /** Distinct discourse markers / connectors the candidate used. */
  connectors: string[];
  candidateQuestions: number;
  longestTurnWords: number;
  perTask: Record<string, { candidateWords: number; questions: number }>;
  nudges: CoachNudge[];
}

const FILLERS: { term: string; re: RegExp }[] = [
  { term: "um / uh / erm", re: /\b(?:um+|uh+|erm+|er|hmm+|ehm+)\b/g },
  { term: "I think (that)", re: /\bi think\b/g },
  { term: "you know", re: /\byou know\b/g },
  { term: "I mean", re: /\bi mean\b/g },
  { term: "sort of / kind of", re: /\b(?:sort of|kind of)\b/g },
  { term: "basically", re: /\bbasically\b/g },
  { term: "like", re: /,\s*like\s*,|\blike,\s/g },
];

/** C1-useful connectors and stance markers, longest first so "on the other hand" wins over "other". */
export const CONNECTORS = [
  "as far as i'm concerned", "it could be argued", "having said that", "that being said", "on the other hand",
  "on the contrary", "as a result", "in addition", "in contrast", "in spite of", "even though", "provided that",
  "as long as", "for instance", "for example", "from my perspective", "in my view", "to sum up", "all in all",
  "what's more", "not only", "nevertheless", "nonetheless", "furthermore", "moreover", "consequently", "therefore",
  "admittedly", "arguably", "although", "whereas", "however", "despite", "unless", "thus", "hence", "overall",
] as const;

const QUESTION_START = /^(?:what|why|how|when|where|who|which|whose|do|does|did|is|are|was|were|would|could|can|should|shall|have|has|will|don't|isn't|aren't|wouldn't)\b/;

export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

function countQuestions(text: string): number {
  const sentences = text.split(/(?<=[.?!])\s+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return sentences.filter((s) => s.endsWith("?") || QUESTION_START.test(s)).length;
}

/** Moving-average TTR over a fixed window (MATTR); falls back to plain TTR for short samples. */
export function movingTTR(tokens: string[], window = 40): number {
  if (tokens.length === 0) return 0;
  if (tokens.length <= window) return new Set(tokens).size / tokens.length;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + window <= tokens.length; i += 5) {
    sum += new Set(tokens.slice(i, i + window)).size / window;
    n++;
  }
  return sum / n;
}

export function computeLiveMetrics(turns: LiveTurn[], currentTask?: string, taskElapsedSec = 0): LiveMetrics {
  const cand = turns.filter((t) => t.role === "CANDIDATE");
  const exam = turns.filter((t) => t.role === "EXAMINER");
  const candTokens = cand.flatMap((t) => words(t.text));
  const examinerWords = exam.reduce((n, t) => n + words(t.text).length, 0);
  const candidateWords = candTokens.length;
  const candidateSeconds = cand.reduce((s, t) => s + Math.max(1, (t.endedAt - t.startedAt) / 1000), 0);
  const lowerText = cand.map((t) => t.text.toLowerCase()).join(" \n ");

  const fillers = FILLERS.map(({ term, re }) => ({ term, count: lowerText.match(re)?.length ?? 0 })).filter((f) => f.count > 0);
  const fillerTotal = fillers.reduce((n, f) => n + f.count, 0);

  const connectors: string[] = [];
  let remaining = ` ${lowerText.replace(/[^a-z' ]+/g, " ")} `;
  for (const c of CONNECTORS) {
    if (remaining.includes(` ${c} `)) {
      connectors.push(c);
      remaining = remaining.split(` ${c} `).join(" | ");
    }
  }

  const perTask: LiveMetrics["perTask"] = {};
  for (const t of cand) {
    const entry = (perTask[t.task] ??= { candidateWords: 0, questions: 0 });
    entry.candidateWords += words(t.text).length;
    entry.questions += countQuestions(t.text);
  }
  const candidateQuestions = Object.values(perTask).reduce((n, p) => n + p.questions, 0);

  const total = candidateWords + examinerWords;
  const talkShare = total ? candidateWords / total : 0;
  const wpm = candidateSeconds >= 10 ? Math.round(candidateWords / (candidateSeconds / 60)) : 0;
  const fillerRate = candidateWords ? (fillerTotal / candidateWords) * 100 : 0;

  // Live nudges: at most two, most important first. Only once there is enough signal.
  const nudges: CoachNudge[] = [];
  if (candidateWords >= 40) {
    if (talkShare < 0.55) nudges.push("speakMore");
    if (currentTask === "COLLABORATIVE" && taskElapsedSec > 60 && (perTask.COLLABORATIVE?.questions ?? 0) < 2) nudges.push("askQuestions");
    if (fillerRate > 6) nudges.push("fillers");
    if (wpm && wpm < 95) nudges.push("slowPace");
    if (wpm > 190) nudges.push("fastPace");
    if (candidateWords >= 150 && connectors.length < 3) nudges.push("useConnectors");
  }

  return {
    candidateWords,
    examinerWords,
    talkShare,
    wpm,
    candidateSeconds: Math.round(candidateSeconds),
    fillers,
    fillerRate: Math.round(fillerRate * 10) / 10,
    lexicalRange: Math.round(movingTTR(candTokens) * 100) / 100,
    connectors,
    candidateQuestions,
    longestTurnWords: cand.reduce((m, t) => Math.max(m, words(t.text).length), 0),
    perTask,
    nudges: nudges.length ? nudges.slice(0, 2) : candidateWords >= 40 ? ["onTrack"] : [],
  };
}
