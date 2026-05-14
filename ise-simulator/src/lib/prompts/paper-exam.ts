import type { WrittenExamContent } from "@/types";

export function buildPaperGradingPrompt(content: WrittenExamContent): string {
  const { reading1, reading2, readingIntoWriting, extendedWriting } = content;

  const r1Questions = [
    `READING TASK 1 — "${reading1.title}"`,
    `Q1-5 (Paragraph Matching): Correct answers = [${reading1.paragraphMatching.correctAnswers.join(", ")}]`,
    `Q6-10 (Statement Selection): Correct answers = [${reading1.statementSelection.correctAnswers.join(", ")}]`,
    `Q11-15 (Gap Fill):`,
    ...reading1.gapFill.questions.map(
      (q, i) => `  Q${11 + i}: "${q.sentence}" → correct: "${q.correctAnswer}"`
    ),
  ].join("\n");

  const r2Questions = [
    `READING TASK 2 — Topic: "${reading2.topic}"`,
    `Text labels: ${reading2.texts.map((t) => `${t.letter}="${t.title}"`).join(", ")}`,
    `Q16-20 (Text Matching): Correct answers = [${reading2.textMatching.correctAnswers.join(", ")}]`,
    `Q21-25 (Statement Selection): Correct answers = [${reading2.statementSelection.correctAnswers.join(", ")}]`,
    `Q26-30 (Gap Fill):`,
    ...reading2.gapFill.questions.map(
      (q, i) => `  Q${26 + i}: "${q.sentence}" → correct: "${q.correctAnswer}"`
    ),
  ].join("\n");

  return `You are an expert Trinity ISE examiner grading a handwritten/printed exam paper.

The student has completed the following exam on paper and the image(s) show their answers.

EXAM STRUCTURE AND CORRECT ANSWERS:
${r1Questions}

${r2Questions}

WRITING TASK 3 (Reading into Writing): "${readingIntoWriting.prompt}" (${readingIntoWriting.wordLimit.min}–${readingIntoWriting.wordLimit.max} words)

WRITING TASK 4 (Extended Writing): "${extendedWriting.prompt}" (${extendedWriting.wordLimit.min}–${extendedWriting.wordLimit.max} words)

YOUR TASK:
1. Carefully read each section of the student's paper in the image.
2. Extract the student's answers for Q1-30 (reading sections).
3. Compare each answer against the correct answers above — accept minor spelling variants and synonyms for gap fills.
4. Transcribe the full text of Writing Task 3 and Writing Task 4.
5. Grade each writing task on the ISE rubric (task fulfilment, grammar, vocabulary, organisation) — 0-10 each.

Return ONLY valid JSON in this exact schema:
{
  "readingAnswers": {
    "paragraphMatching": ["A","B","C","D","E"],
    "statementSelection_r1": ["A","B","C","D","E"],
    "gapFill_r1": ["answer1","answer2","answer3","answer4","answer5"],
    "textMatching": ["A","B","C","D","E"],
    "statementSelection_r2": ["A","B","C","D","E"],
    "gapFill_r2": ["answer1","answer2","answer3","answer4","answer5"]
  },
  "readingScore": {
    "total": 0,
    "outOf": 30,
    "breakdown": {
      "paragraphMatching": 0,
      "statementSelection_r1": 0,
      "gapFill_r1": 0,
      "textMatching": 0,
      "statementSelection_r2": 0,
      "gapFill_r2": 0
    }
  },
  "writingTask3": {
    "transcription": "full text of what student wrote",
    "wordCount": 0,
    "feedback": {
      "taskFulfilment": { "score": 0, "comment": "" },
      "grammar": { "score": 0, "comment": "" },
      "vocabulary": { "score": 0, "comment": "" },
      "organisation": { "score": 0, "comment": "" }
    },
    "overallScore": 0,
    "suggestions": []
  },
  "writingTask4": {
    "transcription": "full text of what student wrote",
    "wordCount": 0,
    "feedback": {
      "taskFulfilment": { "score": 0, "comment": "" },
      "grammar": { "score": 0, "comment": "" },
      "vocabulary": { "score": 0, "comment": "" },
      "organisation": { "score": 0, "comment": "" }
    },
    "overallScore": 0,
    "suggestions": []
  },
  "overallScore": 0,
  "overallBand": "",
  "generalComments": ""
}

If a section is not visible or illegible, use null for that field's answers and note it in generalComments.`;
}
