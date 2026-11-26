import { generateJSON } from "@/lib/ai-provider";
import { getWritingEvaluationPrompt } from "@/lib/prompts/writing";
import { CRITERIA_FOR_TASK, countWords, meanScore, sanitizeEvaluation } from "@/lib/writing";
import type { ExamLevel, WritingCriterionKey, WritingEvaluation, WritingTaskContent, WritingTaskType } from "@/types";

/**
 * Mark one text against Trinity's writing criteria: scores, located errors,
 * upgrades and an improved version. Shared by Writing practice and by the
 * marking of official papers done on paper. Returns null if the AI fails twice.
 */
export async function markWritingText(opts: {
  level: ExamLevel;
  taskType: WritingTaskType;
  genre: string;
  task: WritingTaskContent;
  text: string;
  locale: string;
  /** The previous version, for a rewrite: the marker compares against its scores. */
  previous?: { version: number; feedback: WritingEvaluation } | null;
}): Promise<{ evaluation: WritingEvaluation; score: number; wordCount: number } | null> {
  const { level, taskType, genre, task, text, locale, previous } = opts;
  const criteria = CRITERIA_FOR_TASK[taskType];
  const wordCount = countWords(text);
  const prompt = getWritingEvaluationPrompt({
    level,
    taskType,
    genre,
    task,
    text,
    wordCount,
    locale,
    criteria,
    previous: previous
      ? {
          version: previous.version,
          scores: Object.fromEntries(criteria.map((k) => [k, previous.feedback.criteria[k]?.score])) as Partial<Record<WritingCriterionKey, number>>,
        }
      : null,
  });

  let evaluation = sanitizeEvaluation(await generateJSON(prompt, { temperature: 0.2, prefer: "gemini" }), text, taskType);
  if (!evaluation) {
    evaluation = sanitizeEvaluation(await generateJSON(prompt, { temperature: 0.3, prefer: "gemini" }), text, taskType);
  }
  if (!evaluation) return null;
  return { evaluation, score: meanScore(evaluation, taskType), wordCount };
}
