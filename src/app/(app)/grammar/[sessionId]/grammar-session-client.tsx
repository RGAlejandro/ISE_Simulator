"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import type { CefrLevel, GrammarExerciseType, GrammarQuestionResult } from "@/types";

type ClientQuestion = {
  id: string;
  type: string;
  sentence?: string;
  question?: string;
  options?: string[];
  hint?: string;
};

interface Props {
  sessionId: string;
  cefrLevel: CefrLevel;
  exerciseType: GrammarExerciseType;
  questions: ClientQuestion[];
  initialFeedback: GrammarQuestionResult[] | null;
  initialScore: number | null;
}

const EXERCISE_LABELS: Record<GrammarExerciseType, string> = {
  gap_fill: "Gap Fill",
  mcq: "Multiple Choice",
  error_correction: "Error Correction",
};

const CEFR_COLORS: Record<CefrLevel, string> = {
  A1: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  A2: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  B1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  B2: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  C1: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  C2: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function scoreMessage(score: number, total: number): { text: string; emoji: string } {
  const pct = score / total;
  if (pct === 1) return { text: "Perfect score!", emoji: "🏆" };
  if (pct >= 0.8) return { text: "Great job!", emoji: "⭐" };
  if (pct >= 0.6) return { text: "Good effort!", emoji: "👍" };
  if (pct >= 0.4) return { text: "Keep practicing!", emoji: "💪" };
  return { text: "Review this level", emoji: "📚" };
}

function renderSentenceWithBlank(sentence: string) {
  const parts = sentence.split("___");
  if (parts.length === 1) return <span>{sentence}</span>;
  return (
    <span>
      {parts[0]}
      <span className="inline-block w-20 border-b-2 border-zinc-400 dark:border-zinc-500 mx-1 align-bottom" />
      {parts[1]}
    </span>
  );
}

function GapFillQuestion({
  question,
  answer,
  onChange,
  result,
  submitted,
}: {
  question: ClientQuestion;
  answer: string;
  onChange: (v: string) => void;
  result?: GrammarQuestionResult;
  submitted: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base italic">
        {renderSentenceWithBlank(question.sentence ?? "")}
      </p>
      {question.hint && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{question.hint}</p>
      )}
      {!submitted ? (
        <input
          type="text"
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer..."
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium px-2 py-1 rounded ${result?.isCorrect ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
            Your answer: &ldquo;{answer || "(blank)"}&rdquo;
          </span>
          {!result?.isCorrect && (
            <span className="text-sm px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              Correct: &ldquo;{result?.correctAnswer}&rdquo;
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function McqQuestion({
  question,
  answer,
  onChange,
  result,
  submitted,
}: {
  question: ClientQuestion;
  answer: string;
  onChange: (v: string) => void;
  result?: GrammarQuestionResult;
  submitted: boolean;
}) {
  const options = question.options ?? [];
  const correctIndex = result
    ? options.findIndex((o) => o === result.correctAnswer)
    : -1;

  return (
    <div className="space-y-3">
      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base">{question.question}</p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const selected = answer === String(i);
          const isCorrectOpt = submitted && i === correctIndex;
          const isWrongSelected = submitted && selected && !result?.isCorrect;

          let cls = "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ";
          if (!submitted) {
            cls += selected
              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-500"
              : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-500";
          } else {
            if (isCorrectOpt) cls += "border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-600 text-green-800 dark:text-green-200";
            else if (isWrongSelected) cls += "border-red-400 bg-red-50 dark:bg-red-950 dark:border-red-600 text-red-800 dark:text-red-200";
            else cls += "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600";
          }

          return (
            <button
              key={i}
              disabled={submitted}
              onClick={() => onChange(String(i))}
              className={cls}
            >
              <span className="font-mono mr-2">{["A", "B", "C", "D"][i]}.</span>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ErrorCorrectionQuestion({
  question,
  answer,
  onChange,
  result,
  submitted,
}: {
  question: ClientQuestion;
  answer: string;
  onChange: (v: string) => void;
  result?: GrammarQuestionResult;
  submitted: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Find and correct the grammatical error. Write only the corrected word.</p>
      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base italic">&ldquo;{question.sentence}&rdquo;</p>
      {!submitted ? (
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Corrected word:</label>
          <input
            type="text"
            value={answer}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type the correct word..."
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium px-2 py-1 rounded ${result?.isCorrect ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
            Your answer: &ldquo;{answer || "(blank)"}&rdquo;
          </span>
          {!result?.isCorrect && (
            <span className="text-sm px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              Correct: &ldquo;{result?.correctAnswer}&rdquo;
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function GrammarSessionClient({
  sessionId,
  cefrLevel,
  exerciseType,
  questions,
  initialFeedback,
  initialScore,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<GrammarQuestionResult[] | null>(initialFeedback);
  const [score, setScore] = useState<number | null>(initialScore);
  const [error, setError] = useState<string | null>(null);

  const submitted = feedback !== null;
  const allAnswered = questions.every((q) => (answers[q.id] ?? "").trim() !== "");

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/grammar/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed");
      setFeedback(data.feedback);
      setScore(data.score);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const resultMap = feedback
    ? Object.fromEntries(feedback.map((r) => [r.questionId, r]))
    : {};

  const scoreMsg = score !== null ? scoreMessage(score, questions.length) : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/grammar">
            <Button variant="ghost" size="sm" className="gap-1 text-zinc-500">
              <ArrowLeft className="h-4 w-4" />
              Grammar
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Badge className={CEFR_COLORS[cefrLevel]}>{cefrLevel}</Badge>
            <Badge variant="outline">{EXERCISE_LABELS[exerciseType]}</Badge>
          </div>
        </div>

        {/* Score results banner */}
        {submitted && score !== null && scoreMsg && (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-6 text-center space-y-2 shadow-sm">
            <div className="text-4xl">{scoreMsg.emoji}</div>
            <div className="text-5xl font-bold text-zinc-900 dark:text-zinc-100">
              {score} <span className="text-2xl text-zinc-400">/ {questions.length}</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">{scoreMsg.text}</p>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${score / questions.length >= 0.6 ? "bg-green-500" : "bg-orange-400"}`}
                style={{ width: `${(score / questions.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, index) => {
            const result = resultMap[q.id];
            return (
              <div
                key={q.id}
                className={`rounded-2xl bg-white dark:bg-zinc-900 border p-5 space-y-3 shadow-sm transition-colors ${
                  submitted
                    ? result?.isCorrect
                      ? "border-green-200 dark:border-green-800"
                      : "border-red-200 dark:border-red-800"
                    : "border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {/* Question header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    Question {index + 1}
                  </span>
                  {submitted && (
                    result?.isCorrect
                      ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                      : <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>

                {/* Question body */}
                {q.type === "gap_fill" && (
                  <GapFillQuestion
                    question={q}
                    answer={answers[q.id] ?? ""}
                    onChange={(v) => setAnswer(q.id, v)}
                    result={result}
                    submitted={submitted}
                  />
                )}
                {q.type === "mcq" && (
                  <McqQuestion
                    question={q}
                    answer={answers[q.id] ?? ""}
                    onChange={(v) => setAnswer(q.id, v)}
                    result={result}
                    submitted={submitted}
                  />
                )}
                {q.type === "error_correction" && (
                  <ErrorCorrectionQuestion
                    question={q}
                    answer={answers[q.id] ?? ""}
                    onChange={(v) => setAnswer(q.id, v)}
                    result={result}
                    submitted={submitted}
                  />
                )}

                {/* AI Explanation */}
                {submitted && result?.explanation && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-100 dark:border-zinc-700">
                    {result.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Action buttons */}
        {!submitted ? (
          <Button
            onClick={submit}
            disabled={!allAnswered || submitting}
            className="w-full h-12 text-base gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Evaluating answers...
              </>
            ) : (
              <>
                <Trophy className="h-5 w-5" />
                Submit Answers {!allAnswered && `(${questions.filter(q => (answers[q.id] ?? "").trim() !== "").length}/${questions.length} answered)`}
              </>
            )}
          </Button>
        ) : (
          <div className="flex gap-3">
            <Link href="/grammar" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <RotateCcw className="h-4 w-4" />
                New Exercise
              </Button>
            </Link>
            <Link href="/practice" className="flex-1">
              <Button className="w-full gap-2">
                Back to Practice
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
