import { DIFFICULTY_META, type AccentConfig, type PronDifficulty } from "@/lib/pronunciation";

/** Prompt to generate a reading passage for pronunciation practice. */
export function getPronunciationTextPrompt(
  accent: AccentConfig,
  difficulty: PronDifficulty,
  topic?: string | null,
): string {
  const diff = DIFFICULTY_META[difficulty];
  const topicLine = topic?.trim()
    ? `Theme: "${topic.trim().slice(0, 120)}".`
    : "Pick any everyday, engaging theme.";

  return `You are writing a short passage for an English learner to read ALOUD as pronunciation practice.

Target accent: ${accent.promptHint}.
Difficulty: ${diff.hint}
${topicLine}

Rules:
- Natural, fluent ${accent.promptHint} — use spelling and word choices typical of that variety.
- Make it pleasant to read aloud; vary sentence rhythm.
- Plain prose only: no headings, no bullet points, no quotation marks around the whole text, no notes.
- Do NOT use numerals, symbols or abbreviations — write everything in full words.

Return ONLY valid JSON:
{ "text": "the passage to read aloud" }`;
}

/** Prompt for qualitative pronunciation tips comparing the target to what was heard. */
export function getPronunciationFeedbackPrompt(
  accent: AccentConfig,
  target: string,
  transcript: string,
  missedWords: string[],
): string {
  const missed = missedWords.length
    ? `Words our speech recogniser did NOT catch clearly (likely mispronounced or unclear): ${missedWords.slice(0, 20).join(", ")}.`
    : "The recogniser caught almost everything.";

  return `You are a friendly ${accent.promptHint} pronunciation coach. A learner read a passage aloud; we transcribed their speech automatically.

TARGET TEXT (what they should have said):
${target.slice(0, 1500)}

TRANSCRIPT (what the recogniser heard):
${transcript.slice(0, 1500)}

${missed}

Give specific, encouraging pronunciation tips for ${accent.promptHint}.
- Focus on the words/sounds that likely caused trouble (use the missed words above).
- For each, name the sound and how to produce it in ${accent.promptHint} (e.g. vowel length, /θ/ vs /s/, rhotic vs non-rhotic 'r', word stress).
- Keep each tip to one or two sentences. Address the learner as "you".

Return ONLY valid JSON:
{ "tips": ["tip 1", "tip 2", "tip 3"] }`;
}
