"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, ArrowLeft, RotateCcw, BookOpen } from "lucide-react";

const LEVEL_LABELS: Record<string, string> = {
  ISE_FOUNDATION: "ISE Foundation (A2)",
  ISE_I: "ISE I (B1)",
  ISE_II: "ISE II (B2)",
  ISE_III: "ISE III (C1)",
  ISE_IV: "ISE IV (C2)",
};

interface WritingTaskFeedback {
  transcription?: string;
  wordCount?: number;
  overallScore?: number;
  feedback?: {
    taskFulfilment?: { score: number; comment: string };
    grammar?: { score: number; comment: string };
    vocabulary?: { score: number; comment: string };
    organisation?: { score: number; comment: string };
  };
  suggestions?: string[];
}

interface PaperFeedback {
  readingScore?: {
    total: number;
    outOf: number;
    breakdown: Record<string, number>;
  };
  writingTask3?: WritingTaskFeedback;
  writingTask4?: WritingTaskFeedback;
  overallScore?: number;
  overallBand?: string;
  generalComments?: string;
}

interface Props {
  examId: string;
  level: string;
  feedback: Record<string, unknown>;
  score: number | null;
}

const CRITERIA_LABELS: Record<string, string> = {
  taskFulfilment: "Task Fulfilment",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  organisation: "Organisation",
};

const BREAKDOWN_LABELS: Record<string, string> = {
  paragraphMatching: "Q1–5 Paragraph Matching",
  statementSelection_r1: "Q6–10 Statement Selection (T1)",
  gapFill_r1: "Q11–15 Gap Fill (T1)",
  textMatching: "Q16–20 Text Matching",
  statementSelection_r2: "Q21–25 Statement Selection (T2)",
  gapFill_r2: "Q26–30 Gap Fill (T2)",
};

function ScoreCircle({ score, total }: { score: number; total: number }) {
  const pct = Math.round((score / total) * 100);
  const color = pct >= 70 ? "text-green-600 dark:text-green-400" : pct >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-4xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-zinc-500">/ {total}</span>
      <Badge variant="outline" className={`text-xs ${color}`}>{pct}%</Badge>
    </div>
  );
}

function WritingTaskCard({ task, title }: { task: WritingTaskFeedback; title: string }) {
  const criteria = task.feedback ?? {};
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {task.wordCount !== undefined && (
              <Badge variant="outline" className="text-xs">{task.wordCount} words</Badge>
            )}
            {task.overallScore !== undefined && (
              <Badge className="text-xs bg-blue-600">{task.overallScore}/10</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Criteria breakdown */}
        <div className="space-y-2.5">
          {Object.entries(criteria).map(([key, val]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {CRITERIA_LABELS[key] ?? key}
                </span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300 font-bold">{val.score}/10</span>
              </div>
              <Progress value={val.score * 10} className="h-1.5" />
              {val.comment && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{val.comment}</p>
              )}
            </div>
          ))}
        </div>

        {/* Transcription */}
        {task.transcription && (
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Your answer (as read)</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed italic">{task.transcription}</p>
          </div>
        )}

        {/* Suggestions */}
        {task.suggestions && task.suggestions.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Suggestions</p>
            <ul className="space-y-1">
              {task.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="text-blue-500 mt-0.5">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PaperResultsClient({ examId, level, feedback, score }: Props) {
  const f = feedback as PaperFeedback;
  const readingTotal = f.readingScore?.outOf ?? 30;
  const readingScore = f.readingScore?.total ?? 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Back */}
        <Link href="/practice" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Practice
        </Link>

        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white shadow-lg">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-blue-200 text-sm">Paper Exam Results</p>
              <h1 className="text-2xl font-bold mt-0.5">{LEVEL_LABELS[level] ?? level}</h1>
              {f.overallBand && <p className="text-blue-100 text-sm mt-1">Band: {f.overallBand}</p>}
            </div>
            {score !== null && (
              <div className="text-center bg-white/10 rounded-xl px-6 py-3">
                <p className="text-3xl font-bold">{Math.round(score)}</p>
                <p className="text-xs text-blue-200">Overall Score</p>
              </div>
            )}
          </div>
          {f.generalComments && (
            <p className="mt-4 text-blue-100 text-sm leading-relaxed">{f.generalComments}</p>
          )}
        </div>

        {/* Reading Score */}
        {f.readingScore && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Reading Score</CardTitle>
                <ScoreCircle score={readingScore} total={readingTotal} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {Object.entries(f.readingScore.breakdown).map(([key, val]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{BREAKDOWN_LABELS[key] ?? key}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{val}/5</span>
                      {val === 5 ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : val === 0 ? (
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      ) : null}
                    </div>
                  </div>
                  <Progress value={(val / 5) * 100} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Writing tasks */}
        {f.writingTask3 && (
          <WritingTaskCard task={f.writingTask3} title="Writing Task 3 — Reading into Writing" />
        )}
        {f.writingTask4 && (
          <WritingTaskCard task={f.writingTask4} title="Writing Task 4 — Extended Writing" />
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Link href={`/exam/paper/${examId}/submit`}>
            <Button variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Submit another attempt
            </Button>
          </Link>
          <Link href="/practice">
            <Button className="gap-2">
              <BookOpen className="h-4 w-4" />
              Practice more
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
