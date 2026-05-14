"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EXAM_DURATIONS } from "@/lib/constants";
import { Clock, ChevronLeft, ChevronRight, Send, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { DownloadPdfButton } from "@/components/exam/download-pdf-button";
import type { WrittenExamContent, ReadingTask1, ReadingTask2 } from "@/types";

const TASK_META = [
  { label: "Task 1", title: "Long Reading", qRange: "Questions 1–15" },
  { label: "Task 2", title: "Multi-Text Reading", qRange: "Questions 16–30" },
  { label: "Task 3", title: "Reading into Writing", qRange: "Writing task" },
  { label: "Task 4", title: "Extended Writing", qRange: "Writing task" },
];

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

  const levelLabel = level.replace(/_/g, " ");

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                ISE Simulator — {levelLabel}
              </p>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-tight">
                Reading & Writing Exam
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DownloadPdfButton content={content} level={level} examId={examId} />
            <Link href={`/exam/paper/${examId}/submit`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Submit Paper
              </Button>
            </Link>
            <div className={`flex items-center gap-2 text-base font-mono font-bold px-3 py-1.5 rounded-lg ${
              timeRemaining < 600
                ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                : "bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            }`}>
              <Clock className="h-4 w-4" />
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>

        {/* Task progress tabs */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div className="mx-auto max-w-4xl px-4 flex gap-0">
            {TASK_META.map((t, i) => (
              <button
                key={i}
                onClick={() => setCurrentTask(i)}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors border-b-2 ${
                  i === currentTask
                    ? "border-[#001a57] text-[#001a57] dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                <span className="block">{t.label}</span>
                <span className="hidden sm:block font-normal opacity-70">{t.qRange}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-4xl px-4 py-6">

        {/* Error */}
        {submitError && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <span>{submitError}</span>
            <button onClick={() => setSubmitError(null)} className="ml-4 font-medium text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Paper card */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">

          {/* Section header band */}
          <div className="bg-[#001a57] px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-200">
              {TASK_META[currentTask].label}  ·  {TASK_META[currentTask].qRange}
            </p>
            <h2 className="text-xl font-bold text-white mt-0.5">{TASK_META[currentTask].title}</h2>
          </div>

          {/* Task body */}
          <div className="p-6">
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
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-5">
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
            <Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Submitting...</>
              ) : (
                <><Send className="h-4 w-4 mr-1.5" /> Submit Exam</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// READING TASK 1
// ─────────────────────────────────────────────────────

function Reading1Task({ reading, answers, onAnswer }: {
  reading: ReadingTask1;
  answers: Record<string, string | string[]>;
  onAnswer: (key: string, value: string | string[]) => void;
}) {
  return (
    <div className="space-y-10">
      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{reading.title}</h3>

      {/* Paragraphs */}
      <div className="space-y-3">
        {reading.paragraphs.map((p) => (
          <div key={p.number} className="border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
            <div className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Paragraph {p.number}
              </span>
            </div>
            <p className="px-5 py-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{p.text}</p>
          </div>
        ))}
      </div>

      {/* Q1–5 Paragraph Matching */}
      <QSection title="Questions 1–5" instructions={reading.paragraphMatching.instructions}>
        {/* Options */}
        <div className="border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden mb-5">
          <div className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Summary options</span>
          </div>
          {reading.paragraphMatching.options.map((opt) => (
            <div key={opt.letter} className="flex border-b last:border-0 border-zinc-100 dark:border-zinc-800">
              <div className="w-10 shrink-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 border-r border-zinc-100 dark:border-zinc-800">
                <span className="font-bold text-sm text-[#001a57] dark:text-blue-400">{opt.letter}</span>
              </div>
              <p className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">{opt.summary}</p>
            </div>
          ))}
        </div>

        {/* Answer grid */}
        <div className="grid grid-cols-5 gap-2">
          {reading.paragraphs.map((p, idx) => (
            <div key={p.number} className="text-center">
              <div className="text-xs text-zinc-500 mb-1 font-medium">Q{idx + 1}</div>
              <select
                value={(answers[`pm_${p.number}`] as string) || ""}
                onChange={(e) => onAnswer(`pm_${p.number}`, e.target.value)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 px-2 py-2 text-sm text-center bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none"
              >
                <option value="">—</option>
                {reading.paragraphMatching.options.map((opt) => (
                  <option key={opt.letter} value={opt.letter}>{opt.letter}</option>
                ))}
              </select>
              <div className="text-[10px] text-zinc-400 mt-1">Para {p.number}</div>
            </div>
          ))}
        </div>
      </QSection>

      {/* Q6–10 Statement Selection */}
      <QSection title="Questions 6–10" instructions={reading.statementSelection.instructions}>
        <StatementGrid
          section={reading.statementSelection}
          answerKey="r1_ss"
          selected={(answers["r1_ss"] as string[]) || []}
          onToggle={(letter) => toggleSelection("r1_ss", letter, 5, answers, onAnswer)}
        />
      </QSection>

      {/* Q11–15 Gap Fill */}
      <QSection title="Questions 11–15" instructions={`${reading.gapFill.instructions} (1–3 words each)`}>
        <GapFillGrid section={reading.gapFill} startNumber={11} answers={answers} onAnswer={onAnswer} />
      </QSection>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// READING TASK 2
// ─────────────────────────────────────────────────────

function Reading2Task({ reading, answers, onAnswer }: {
  reading: ReadingTask2;
  answers: Record<string, string | string[]>;
  onAnswer: (key: string, value: string | string[]) => void;
}) {
  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{reading.title}</h3>
        <p className="text-sm text-zinc-500 mt-1">Topic: <span className="font-medium">{reading.topic}</span></p>
      </div>

      {/* 4 texts */}
      <div className="space-y-4">
        {reading.texts.map((t) => (
          <div key={t.letter} className="border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
            <div className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-2.5 flex items-center gap-3 flex-wrap">
              <Badge className="bg-[#001a57] text-white text-xs shrink-0">{t.letter}</Badge>
              <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{t.title}</span>
              <Badge variant="outline" className="text-xs ml-auto">{t.source}</Badge>
              {t.author && <span className="text-xs text-zinc-400">by {t.author}</span>}
            </div>
            <div className="px-5 py-4">
              {t.isGraph && t.graphData ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t.content}</p>
                  <SimpleBarChart data={t.graphData} />
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{t.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Q16–20 Text Matching */}
      <QSection title="Questions 16–20" instructions={reading.textMatching.instructions}>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
            <div className="px-4 py-2">Statement</div>
            <div className="px-4 py-2">Text</div>
          </div>
          {reading.textMatching.questions.map((q, idx) => (
            <div key={q.id} className="grid grid-cols-[1fr_auto] border-b last:border-0 border-zinc-100 dark:border-zinc-800 items-center">
              <p className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
                <span className="font-bold text-[#001a57] dark:text-blue-400 mr-2">{16 + idx}.</span>
                {q.statement}
              </p>
              <div className="px-4">
                <select
                  value={(answers[q.id] as string) || ""}
                  onChange={(e) => onAnswer(q.id, e.target.value)}
                  className="rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-none w-20"
                >
                  <option value="">—</option>
                  {["A", "B", "C", "D"].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </QSection>

      {/* Q21–25 Statement Selection */}
      <QSection title="Questions 21–25" instructions={reading.statementSelection.instructions}>
        <StatementGrid
          section={reading.statementSelection}
          answerKey="r2_ss"
          selected={(answers["r2_ss"] as string[]) || []}
          onToggle={(letter) => toggleSelection("r2_ss", letter, 5, answers, onAnswer)}
        />
      </QSection>

      {/* Q26–30 Gap Fill */}
      <QSection title="Questions 26–30" instructions={`${reading.gapFill.instructions} (1–3 words each)`}>
        <GapFillGrid section={reading.gapFill} startNumber={26} answers={answers} onAnswer={onAnswer} />
      </QSection>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────

function QSection({ title, instructions, children }: {
  title: string;
  instructions: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="border-l-4 border-[#001a57] dark:border-blue-500 pl-3">
        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h4>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 italic">{instructions}</p>
      </div>
      {children}
    </div>
  );
}

function StatementGrid({ section, answerKey, selected, onToggle }: {
  section: { instructions: string; statements: { letter: string; text: string }[] };
  answerKey: string;
  selected: string[];
  onToggle: (letter: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400 font-medium">
        Selected: {selected.length} / 5
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {section.statements.map((s) => {
          const isSelected = selected.includes(s.letter);
          return (
            <label
              key={`${answerKey}_${s.letter}`}
              className={`flex items-start gap-3 rounded border px-3 py-2.5 cursor-pointer transition-colors ${
                isSelected
                  ? "border-[#001a57] bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
                  : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(s.letter)}
                disabled={!isSelected && selected.length >= 5}
                className="mt-0.5 h-4 w-4 rounded accent-blue-700 shrink-0"
              />
              <span className="font-bold text-sm text-[#001a57] dark:text-blue-400 shrink-0 w-4">{s.letter}</span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{s.text}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function toggleSelection(
  key: string,
  letter: string,
  max: number,
  answers: Record<string, string | string[]>,
  onAnswer: (key: string, value: string | string[]) => void,
) {
  const current = (answers[key] as string[]) || [];
  const updated = current.includes(letter)
    ? current.filter((l) => l !== letter)
    : current.length < max ? [...current, letter] : current;
  onAnswer(key, updated);
}

function GapFillGrid({ section, startNumber, answers, onAnswer }: {
  section: { instructions: string; questions: { id: string; sentence: string }[] };
  startNumber: number;
  answers: Record<string, string | string[]>;
  onAnswer: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {section.questions.map((q, idx) => {
        const parts = q.sentence.split("_______");
        return (
          <div key={q.id} className="flex items-baseline gap-0 border border-zinc-200 dark:border-zinc-700 rounded px-4 py-3 bg-zinc-50 dark:bg-zinc-900 text-sm flex-wrap gap-y-1">
            <span className="font-bold text-[#001a57] dark:text-blue-400 mr-2 shrink-0">{startNumber + idx}.</span>
            <span className="text-zinc-700 dark:text-zinc-300 mr-1">{parts[0]}</span>
            <span className="inline-block border-b-2 border-[#001a57] dark:border-blue-500 min-w-[130px] mx-1">
              <input
                type="text"
                value={(answers[q.id] as string) || ""}
                onChange={(e) => {
                  const words = e.target.value.split(/\s+/).filter(Boolean);
                  if (words.length <= 3) onAnswer(q.id, e.target.value);
                }}
                placeholder="answer here"
                className="w-full bg-transparent text-[#001a57] dark:text-blue-400 font-semibold text-sm focus:outline-none px-1 py-0.5"
              />
            </span>
            {parts[1] && <span className="text-zinc-700 dark:text-zinc-300 ml-1">{parts[1]}</span>}
          </div>
        );
      })}
    </div>
  );
}

function SimpleBarChart({ data }: { data: { label: string; value: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3 h-36 px-4 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center flex-1 gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{d.value}</span>
          <div className="w-full bg-[#001a57] dark:bg-blue-600 rounded-t-sm transition-all" style={{ height: `${(d.value / maxVal) * 100}%` }} />
          <span className="text-[10px] text-zinc-500 text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// WRITING TASK
// ─────────────────────────────────────────────────────

function WritingTask({ task, value, onChange }: {
  task: { title: string; prompt: string; writingType?: string; wordLimit: { min: number; max: number }; bulletPoints?: string[] };
  value: string;
  onChange: (value: string) => void;
}) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const isUnder = wordCount < task.wordLimit.min;
  const isOver = wordCount > task.wordLimit.max;

  return (
    <div className="space-y-5">
      {/* Task prompt */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{task.title}</h3>
          {task.writingType && (
            <Badge variant="outline" className="capitalize text-xs">{task.writingType}</Badge>
          )}
        </div>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Task</span>
          </div>
          <div className="p-5">
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{task.prompt}</p>
            {task.bulletPoints && task.bulletPoints.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {task.bulletPoints.map((point, idx) => (
                  <li key={idx} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-[#001a57] dark:text-blue-400 shrink-0 font-bold">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-2">
          Word limit: <span className="font-semibold">{task.wordLimit.min}–{task.wordLimit.max} words</span>
        </p>
      </div>

      {/* Writing area */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Your answer</span>
          <span className={`text-sm font-semibold ${isUnder ? "text-amber-600" : isOver ? "text-red-600" : "text-green-600"}`}>
            {wordCount} words
            {isUnder && ` (min ${task.wordLimit.min})`}
            {isOver && ` (max ${task.wordLimit.max})`}
          </span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={18}
          placeholder="Write your response here..."
          className="w-full rounded border border-zinc-200 dark:border-zinc-700 p-4 text-sm leading-[2] font-mono bg-[repeating-linear-gradient(transparent,transparent_31px,#e4e4e7_31px,#e4e4e7_32px)] dark:bg-[repeating-linear-gradient(transparent,transparent_31px,#27272a_31px,#27272a_32px)] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y dark:bg-zinc-900"
        />
      </div>
    </div>
  );
}
