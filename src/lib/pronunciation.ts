/**
 * Pronunciation practice — shared config and scoring.
 *
 * A persona-free module: pick an accent, read a passage aloud, and we transcribe
 * the recording (Groq Whisper) and compare it word-by-word against the target to
 * estimate reading accuracy. The model audio is produced by msedge-tts in the
 * chosen accent's voice.
 */

export type AccentId = "rp" | "american";
export type PronDifficulty = "easy" | "normal" | "advanced";

export interface AccentConfig {
  id: AccentId;
  label: string;
  flag: string;
  /** msedge-tts voice (must be allow-listed in /api/tts). */
  voice: string;
  /** Description used in the generation prompt. */
  promptHint: string;
}

export const ACCENTS: AccentConfig[] = [
  {
    id: "rp",
    label: "RP (British)",
    flag: "🇬🇧",
    voice: "en-GB-RyanNeural",
    promptHint: "British English (Received Pronunciation)",
  },
  {
    id: "american",
    label: "American",
    flag: "🇺🇸",
    voice: "en-US-GuyNeural",
    promptHint: "General American English",
  },
];

export function getAccent(id?: string | null): AccentConfig {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

export const DIFFICULTY_META: Record<PronDifficulty, { label: string; hint: string }> = {
  easy: {
    label: "Easy",
    hint: "A1–A2: short, simple sentences with common everyday words. 2–3 sentences.",
  },
  normal: {
    label: "Normal",
    hint: "B1–B2: a natural connected paragraph with some varied vocabulary. 4–5 sentences.",
  },
  advanced: {
    label: "Advanced",
    hint: "C1–C2: a richer paragraph with sophisticated vocabulary, linking and a few tricky-to-pronounce words. 5–6 sentences.",
  },
};

const STRIP = /[^\p{L}\p{N}']/gu;

function normalize(token: string): string {
  return token.toLowerCase().replace(STRIP, "");
}

export interface ScoredWord {
  text: string;
  ok: boolean;
}

export interface PronunciationScore {
  score: number; // 0-100
  words: ScoredWord[];
  matched: number;
  total: number;
}

/**
 * Compare what the user read (transcript) against the target text. Uses a
 * longest-common-subsequence alignment over normalised tokens so word order
 * matters; returns per-word correctness for highlighting plus an overall score.
 */
export function scorePronunciation(target: string, transcript: string): PronunciationScore {
  const targetDisplay = target.trim().split(/\s+/).filter(Boolean);
  const targetNorm = targetDisplay.map(normalize);
  const heardNorm = transcript.trim().split(/\s+/).map(normalize).filter(Boolean);

  // Keep indices that have content after normalisation.
  const t = targetNorm;
  const h = heardNorm;
  const n = t.length;
  const m = h.length;

  // LCS DP
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = t[i] && t[i] === h[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Walk back to mark which target indices were matched.
  const matchedIdx = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (t[i] && t[i] === h[j]) {
      matchedIdx.add(i);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const words: ScoredWord[] = targetDisplay.map((text, idx) => ({
    text,
    // Empty-normalised tokens (pure punctuation) count as ok so they don't hurt the score.
    ok: t[idx] === "" || matchedIdx.has(idx),
  }));

  const scorable = t.filter((w) => w !== "").length;
  const matched = [...matchedIdx].filter((idx) => t[idx] !== "").length;
  const score = scorable === 0 ? 0 : Math.round((matched / scorable) * 100);

  return { score, words, matched, total: scorable };
}
