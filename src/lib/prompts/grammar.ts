import type { CefrLevel, GrammarExerciseType, GrammarQuestion, GrammarQuestionResult } from "@/types";

export function evaluateGrammarPrompt(
  level: CefrLevel,
  exerciseType: GrammarExerciseType,
  questions: GrammarQuestion[],
  results: Pick<GrammarQuestionResult, "questionId" | "isCorrect" | "userAnswer" | "correctAnswer">[]
): string {
  const resultLines = results.map((r) => {
    const q = questions.find((q) => q.id === r.questionId);
    if (!q) return "";
    const questionText = q.type === "mcq" ? q.question : q.sentence;
    const status = r.isCorrect ? "CORRECT" : "INCORRECT";
    return `${q.id} [${status}] | "${questionText}" | Student: "${r.userAnswer}" | Correct: "${r.correctAnswer}"`;
  }).filter(Boolean).join("\n");

  return `Generate educational grammar explanations for these exercise results.

Level: ${level} | Type: ${exerciseType.replace(/_/g, " ")}

Results:
${resultLines}

For each question, write a concise explanation (1-2 sentences max):
- If CORRECT: confirm the grammar rule that makes it right
- If INCORRECT: explain why it's wrong and what the correct form requires

Return ONLY valid JSON:
{
  "explanations": [
    { "questionId": "q1", "explanation": "..." },
    ...
  ]
}

Rules:
- Exactly ${results.length} items, one per question
- Keep explanations brief and educational
- Speak directly to the student ("You used..." / "This sentence requires...")
- No text outside the JSON`;
}
