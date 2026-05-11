"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WRITTEN_TASKS, EXAM_DURATIONS } from "@/lib/constants";
import { Clock, ChevronLeft, ChevronRight, Send, Loader2, BarChart3 } from "lucide-react";
import type { WrittenExamContent, ReadingTask1, ReadingTask2 } from "@/types";

interface Props {
  examId: string;
  content: WrittenExamContent;
  level: string;
}

export function WrittenExamClient({ examId, content, level }: Props) {
  const router = useRouter();
  const [currentTask, setCurrentTask] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string | string[]>>({});
  const [timeRemaining, setTimeRemaining] = useState((EXAM_DURATIONS[level] ?? 120) * 60);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/exam/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, responses, readingAnswers }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || "Failed to submit exam");
        return;
      }
      router.push(`/results/${examId}`);
    } catch {
      setSubmitError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [examId, responses, readingAnswers, router]);

  useEffect(() => {
    if (timeRemaining === 0) handleSubmit();
  }, [timeRemaining, handleSubmit]);

  const progress = ((currentTask + 1) / 4) * 100;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Written Exam — {level.replace("_", " ")}
          </h1>
          <p className="text-sm text-zinc-500">
            {WRITTEN_TASKS[currentTask].label}: {WRITTEN_TASKS[currentTask].description}
          </p>
        </div>
        <div className={`flex items-center gap-2 text-lg font-mono font-bold ${timeRemaining < 600 ? "text-red-600" : "text-zinc-700 dark:text-zinc-300"}`}>
          <Clock className="h-5 w-5" />
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-zinc-500 mb-2">
          <span>Task {currentTask + 1} of 4</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <span>{submitError}</span>
          <button onClick={() => setSubmitError(null)} className="ml-4 font-medium text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Task Content */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{WRITTEN_TASKS[currentTask].label}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentTask === 0 && (
            <Reading1Task
              reading={content.reading1}
              answers={readingAnswers}
              onAnswer={(key, val) => setReadingAnswers((prev) => ({ ...prev, [key]: val }))}
            />
          )}
          {currentTask === 1 && (
            <Reading2Task
              reading={content.reading2}
              answers={readingAnswers}
              onAnswer={(key, val) => setReadingAnswers((prev) => ({ ...prev, [key]: val }))}
            />
          )}
          {currentTask === 2 && (
            <WritingTask
              task={content.readingIntoWriting}
              value={responses["READING_INTO_WRITING"] || ""}
              onChange={(val) => setResponses((prev) => ({ ...prev, READING_INTO_WRITING: val }))}
            />
          )}
          {currentTask === 3 && (
            <WritingTask
              task={content.extendedWriting}
              value={responses["EXTENDED_WRITING"] || ""}
              onChange={(val) => setResponses((prev) => ({ ...prev, EXTENDED_WRITING: val }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentTask((prev) => Math.max(0, prev - 1))}
          disabled={currentTask === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        {currentTask < 3 ? (
          <Button onClick={() => setCurrentTask((prev) => Math.min(3, prev + 1))}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700">
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Submitting...</>
            ) : (
              <><Send className="h-4 w-4 mr-1" /> Submit Exam</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// READING TASK 1 — 5 paragraphs + 3 question sections
// ═══════════════════════════════════════════════════

function Reading1Task({
  reading,
  answers,
  onAnswer,
}: {
  reading: ReadingTask1;
  answers: Record<string, string | string[]>;
  onAnswer: (key: string, value: string | string[]) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Title */}
      <h3 className="text-lg font-semibold">{reading.title}</h3>

      {/* 5 Paragraphs */}
      <div className="space-y-4">
        {reading.paragraphs.map((p) => (
          <div key={p.number} className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 border">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0 font-bold">
                {p.number}
              </Badge>
              <p className="text-sm leading-relaxed">{p.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Questions 1-5: Paragraph Matching */}
      <QuestionSection title="Questions 1–5" instructions={reading.paragraphMatching.instructions}>
        <div className="space-y-3">
          {reading.paragraphs.map((p, idx) => (
            <div key={p.number} className="flex items-center gap-4 rounded-lg border p-3">
              <span className="font-medium text-sm w-24 shrink-0">
                {idx + 1}. Paragraph {p.number}
              </span>
              <select
                value={(answers[`pm_${p.number}`] as string) || ""}
                onChange={(e) => onAnswer(`pm_${p.number}`, e.target.value)}
                className="rounded-md border px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select...</option>
                {reading.paragraphMatching.options.map((opt) => (
                  <option key={opt.letter} value={opt.letter}>{opt.letter}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {/* Options reference */}
        <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
          <p className="font-medium text-sm mb-2 text-blue-700 dark:text-blue-300">Summary options:</p>
          <div className="space-y-2">
            {reading.paragraphMatching.options.map((opt) => (
              <div key={opt.letter} className="flex gap-2 text-sm">
                <span className="font-bold text-blue-600 shrink-0">{opt.letter}.</span>
                <span>{opt.summary}</span>
              </div>
            ))}
          </div>
        </div>
      </QuestionSection>

      {/* Questions 6-10: Statement Selection */}
      <StatementSelectionUI
        title="Questions 6–10"
        section={reading.statementSelection}
        answerKey="r1_ss"
        selectedLetters={(answers["r1_ss"] as string[]) || []}
        onToggle={(letter) => {
          const current = (answers["r1_ss"] as string[]) || [];
          const updated = current.includes(letter)
            ? current.filter((l) => l !== letter)
            : current.length < 5
              ? [...current, letter]
              : current;
          onAnswer("r1_ss", updated);
        }}
      />

      {/* Questions 11-15: Gap Fill */}
      <GapFillUI
        title="Questions 11–15"
        section={reading.gapFill}
        startNumber={11}
        answers={answers}
        onAnswer={onAnswer}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// READING TASK 2 — 4 texts + 3 question sections
// ═══════════════════════════════════════════════════

function Reading2Task({
  reading,
  answers,
  onAnswer,
}: {
  reading: ReadingTask2;
  answers: Record<string, string | string[]>;
  onAnswer: (key: string, value: string | string[]) => void;
}) {
  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold">{reading.title}</h3>
      <p className="text-sm text-zinc-500">Topic: {reading.topic}</p>

      {/* 4 Texts */}
      <div className="space-y-6">
        {reading.texts.map((t) => (
          <div key={t.letter} className="rounded-lg border overflow-hidden">
            <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 flex items-center gap-2">
              <Badge className="font-bold">{t.letter}</Badge>
              <span className="font-semibold text-sm">{t.title}</span>
              <Badge variant="outline" className="ml-auto text-xs">{t.source}</Badge>
              {t.author && <span className="text-xs text-zinc-500">by {t.author}</span>}
            </div>
            <div className="p-4">
              {t.isGraph && t.graphData ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t.content}</p>
                  <SimpleBarChart data={t.graphData} />
                </div>
              ) : (
                <p className="text-sm leading-relaxed">{t.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Questions 16-20: Text Matching */}
      <QuestionSection title="Questions 16–20" instructions={reading.textMatching.instructions}>
        <div className="space-y-3">
          {reading.textMatching.questions.map((q, idx) => (
            <div key={q.id} className="flex items-start gap-4 rounded-lg border p-3">
              <span className="font-medium text-sm w-8 shrink-0">{16 + idx}.</span>
              <p className="text-sm flex-1">{q.statement}</p>
              <select
                value={(answers[q.id] as string) || ""}
                onChange={(e) => onAnswer(q.id, e.target.value)}
                className="rounded-md border px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shrink-0"
              >
                <option value="">Select...</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
          ))}
        </div>
      </QuestionSection>

      {/* Questions 21-25: Statement Selection */}
      <StatementSelectionUI
        title="Questions 21–25"
        section={reading.statementSelection}
        answerKey="r2_ss"
        selectedLetters={(answers["r2_ss"] as string[]) || []}
        onToggle={(letter) => {
          const current = (answers["r2_ss"] as string[]) || [];
          const updated = current.includes(letter)
            ? current.filter((l) => l !== letter)
            : current.length < 5
              ? [...current, letter]
              : current;
          onAnswer("r2_ss", updated);
        }}
      />

      {/* Questions 26-30: Gap Fill */}
      <GapFillUI
        title="Questions 26–30"
        section={reading.gapFill}
        startNumber={26}
        answers={answers}
        onAnswer={onAnswer}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════

function QuestionSection({ title, instructions, children }: {
  title: string;
  instructions: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h4>
        <p className="text-sm text-zinc-500 mt-1">{instructions}</p>
      </div>
      {children}
    </div>
  );
}

function StatementSelectionUI({ title, section, answerKey, selectedLetters, onToggle }: {
  title: string;
  section: { instructions: string; statements: { letter: string; text: string }[] };
  answerKey: string;
  selectedLetters: string[];
  onToggle: (letter: string) => void;
}) {
  return (
    <QuestionSection title={title} instructions={section.instructions}>
      <div className="space-y-2">
        <p className="text-xs text-zinc-400">Selected: {selectedLetters.length}/5</p>
        {section.statements.map((s) => {
          const selected = selectedLetters.includes(s.letter);
          return (
            <label
              key={`${answerKey}_${s.letter}`}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                selected
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(s.letter)}
                disabled={!selected && selectedLetters.length >= 5}
                className="mt-0.5 h-4 w-4 rounded text-blue-600"
              />
              <span className="font-bold text-sm shrink-0">{s.letter}.</span>
              <span className="text-sm">{s.text}</span>
            </label>
          );
        })}
      </div>
    </QuestionSection>
  );
}

function GapFillUI({ title, section, startNumber, answers, onAnswer }: {
  title: string;
  section: { instructions: string; questions: { id: string; sentence: string }[] };
  startNumber: number;
  answers: Record<string, string | string[]>;
  onAnswer: (key: string, value: string) => void;
}) {
  return (
    <QuestionSection title={title} instructions={`${section.instructions} Each answer must be between 1 and 3 words.`}>
      <div className="space-y-3">
        {section.questions.map((q, idx) => {
          const parts = q.sentence.split("_______");
          return (
            <div key={q.id} className="rounded-lg border p-4">
              <p className="text-sm mb-2">
                <span className="font-medium">{startNumber + idx}.</span>{" "}
                {parts[0]}
                <span className="inline-block mx-1 border-b-2 border-blue-500 min-w-[120px]">
                  <input
                    type="text"
                    value={(answers[q.id] as string) || ""}
                    onChange={(e) => {
                      const words = e.target.value.split(/\s+/).filter(Boolean);
                      if (words.length <= 3) onAnswer(q.id, e.target.value);
                    }}
                    className="w-full bg-transparent text-blue-600 dark:text-blue-400 font-medium text-sm focus:outline-none px-1"
                  />
                </span>
                {parts[1] || ""}
              </p>
            </div>
          );
        })}
      </div>
    </QuestionSection>
  );
}

function SimpleBarChart({ data }: { data: { label: string; value: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3 h-40 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center flex-1 gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{d.value}</span>
          <div
            className="w-full bg-blue-500 rounded-t-md transition-all"
            style={{ height: `${(d.value / maxVal) * 100}%` }}
          />
          <span className="text-xs text-zinc-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// WRITING TASK (unchanged)
// ═══════════════════════════════════════════════════

function WritingTask({
  task,
  value,
  onChange,
}: {
  task: { title: string; prompt: string; writingType?: string; wordLimit: { min: number; max: number }; bulletPoints?: string[] };
  value: string;
  onChange: (value: string) => void;
}) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const isUnderMin = wordCount < task.wordLimit.min;
  const isOverMax = wordCount > task.wordLimit.max;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg font-semibold">{task.title}</h3>
          {task.writingType && (
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 capitalize">
              {task.writingType}
            </Badge>
          )}
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 border">
          <p className="text-sm leading-relaxed">{task.prompt}</p>
          {task.bulletPoints && task.bulletPoints.length > 0 && (
            <ul className="mt-3 space-y-1">
              {task.bulletPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                  <span className="text-blue-600">•</span> {point}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline">
            Word limit: {task.wordLimit.min}–{task.wordLimit.max}
          </Badge>
        </div>
      </div>
      <div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={16}
          placeholder="Write your response here..."
          className="w-full rounded-lg border p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y dark:bg-zinc-900"
        />
        <div className="mt-2 flex justify-between text-sm">
          <span className={isUnderMin ? "text-yellow-600" : isOverMax ? "text-red-600" : "text-green-600"}>
            {wordCount} words
          </span>
          <span className="text-zinc-400">
            Target: {task.wordLimit.min}–{task.wordLimit.max} words
          </span>
        </div>
      </div>
    </div>
  );
}
