import type { CefrLevel, GrammarExerciseType, GrammarQuestion, GrammarQuestionResult } from "@/types";

const CEFR_DESCRIPTORS: Record<CefrLevel, string> = {
  A1: "Absolute beginner. Present simple, subject pronouns, basic articles (a/an/the), singular/plural nouns, basic adjectives.",
  A2: "Elementary. Past simple regular/irregular, present continuous, possessives, prepositions of time/place, comparative adjectives.",
  B1: "Intermediate. Present perfect, future forms (will/going to), first conditional, modal verbs (can/could/should/must), passive voice (basic).",
  B2: "Upper-intermediate. Past perfect, second conditional, passive voice (all tenses), reported speech, relative clauses, modal perfect.",
  C1: "Advanced. Third conditional, mixed conditionals, subjunctive, complex passive, inversion, ellipsis, advanced modal nuances.",
  C2: "Mastery. Nuanced modal usage, complex inversion structures, sophisticated conditionals, stylistic grammar choices, formal/informal register.",
};

const EXERCISE_INSTRUCTIONS: Record<GrammarExerciseType, string> = {
  gap_fill: `Gap-fill: Provide a sentence with ___ where one word or short phrase is missing. The blank tests a specific grammar point.
  - "sentence": the sentence with ___ for the blank
  - "hint": brief grammatical clue in parentheses, e.g. "(past simple of 'go')" or "(modal verb for obligation)"
  - "correctAnswer": the exact word(s) that complete the blank`,

  mcq: `Multiple choice: Provide a grammar-focused question with exactly 4 options. Distractors must be plausible errors at this level.
  - "question": the question text (can be "Choose the correct sentence:" or "Which form is correct: She ___ for two hours?"
  - "options": array of exactly 4 strings
  - "correctAnswer": integer 0-3 (index of correct option)`,

  error_correction: `Error correction: Provide a sentence with exactly one grammatical error. The student must identify and correct only the wrong word.
  - "sentence": the sentence containing exactly one grammatical error
  - "correctAnswer": the single corrected word (not the full sentence — just the word that replaces the error)`,
};

export function generateGrammarPrompt(level: CefrLevel, exerciseType: GrammarExerciseType): string {
  const desc = CEFR_DESCRIPTORS[level];
  const instructions = EXERCISE_INSTRUCTIONS[exerciseType];

  return `You are generating grammar exercises for an English learner at CEFR level ${level}.

Level ${level} covers: ${desc}

Exercise type: ${exerciseType.replace(/_/g, " ")}
${instructions}

Generate exactly 10 exercises appropriate for ${level} level. Each must:
- Test a grammar point that is characteristic of ${level} level (not too easy, not too hard)
- Use natural, realistic sentences (not contrived examples)
- Have only ONE clearly correct answer
- Include "grammarPoint": a short label like "past simple", "second conditional", "present perfect with 'for'"

Return ONLY valid JSON:
{
  "exercises": [
    {
      "id": "q1",
      "type": "${exerciseType}",
      ${exerciseType === "gap_fill" ? '"sentence": "She ___ (hint: fill this in)", "hint": "(past simple of \'go\')", "correctAnswer": "went", "grammarPoint": "past simple irregular"' : ""}
      ${exerciseType === "mcq" ? '"question": "Choose the correct form:", "options": ["option A", "option B", "option C", "option D"], "correctAnswer": 0, "grammarPoint": "present perfect vs past simple"' : ""}
      ${exerciseType === "error_correction" ? '"sentence": "She don\'t like coffee.", "correctAnswer": "doesn\'t", "grammarPoint": "subject-verb agreement"' : ""}
    },
    ...9 more items
  ]
}

Rules:
- Exactly 10 items (id: "q1" through "q10")
- Cover different grammar points across the 10 questions — no repetition
- All sentences in natural English
- No text outside the JSON`;
}

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
