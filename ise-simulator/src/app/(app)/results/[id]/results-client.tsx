"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Trophy, ArrowLeft, Lock, BookOpen, PenTool, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Sparkles, Award,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { WritingFeedback, ReadingQuestionResult } from "@/types";

interface ReadingAggregate {
  score: number;
  total: number;
  percentage: number;
  questions?: ReadingQuestionResult[];
}

interface ResultsClientProps {
  exam: {
    id: string;
    level: string;
    status: string;
    score: number | null;
    createdAt: string;
  };
  responses: Array<{
    taskType: string;
    taskNumber: number;
    response: string;
    aiFeedback: (WritingFeedback | ReadingAggregate) | null;
    score: number | null;
  }>;
  isPro: boolean;
}

function getBand(score: number | null) {
  if (score === null) return "N/A";
  if (score >= 80) return "Distinction";
  if (score >= 65) return "Merit";
  if (score >= 50) return "Pass";
  return "Fail";
}

function bandColor(band: string) {
  return band === "Distinction" ? "text-purple-600 dark:text-purple-400" :
    band === "Merit" ? "text-blue-600 dark:text-blue-400" :
    band === "Pass" ? "text-green-600 dark:text-green-400" :
    "text-red-600 dark:text-red-400";
}

function bandBg(band: string) {
  return band === "Distinction" ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" :
    band === "Merit" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" :
    band === "Pass" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" :
    "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  paragraph_matching: "Paragraph matching",
  statement_selection: "Statement selection",
  text_matching: "Text matching",
  gap_fill: "Gap fill",
};

export function ResultsClient({ exam, responses, isPro }: ResultsClientProps) {
  const r1 = responses.find(r => r.taskType === "READING_1");
  const r2 = responses.find(r => r.taskType === "READING_2");
  const w1 = responses.find(r => r.taskType === "READING_INTO_WRITING");
  const w2 = responses.find(r => r.taskType === "EXTENDED_WRITING");

  const r1fb = r1?.aiFeedback as ReadingAggregate | undefined;
  const r2fb = r2?.aiFeedback as ReadingAggregate | undefined;

  const readingScore = (r1fb?.score ?? 0) + (r2fb?.score ?? 0);
  const readingTotal = (r1fb?.total ?? 0) + (r2fb?.total ?? 0);
  const readingPct = readingTotal > 0 ? Math.round((readingScore / readingTotal) * 100) : 0;
  const readingBand = getBand(readingPct);

  // Writing: avg of completed tasks (each scored 0-20, normalize to 0-100)
  const wScores: number[] = [];
  if (w1?.score != null) wScores.push((w1.score / 20) * 100);
  if (w2?.score != null) wScores.push((w2.score / 20) * 100);
  const writingPct = wScores.length > 0 ? Math.round(wScores.reduce((a, b) => a + b, 0) / wScores.length) : null;
  const writingBand = writingPct !== null ? getBand(writingPct) : "N/A";

  const overallBand = getBand(exam.score);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/30 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className={cn("flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-3xl", bandBg(overallBand))}>
              <Trophy className="h-10 w-10 sm:h-12 sm:w-12" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-300">
                {exam.level.replace("_", " ")} · {new Date(exam.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
              <h1 className="mt-1 text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {exam.score != null ? `${exam.score}%` : "Pending"}
              </h1>
              <div className="mt-2 flex items-center gap-2">
                <Badge className={cn("border-0 px-3 py-1 text-sm gap-1.5", bandBg(overallBand))}>
                  <Award className="h-3.5 w-3.5" /> {overallBand}
                </Badge>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Overall result</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* SECTION SCORES SUMMARY */}
        <div className="grid gap-4 sm:grid-cols-2">
          <SectionCard
            icon={<BookOpen className="h-5 w-5" />}
            tone="blue"
            label="Reading"
            sublabel="Tasks 1 & 2"
            score={readingPct}
            band={readingBand}
            detail={`${readingScore} / ${readingTotal} questions correct`}
          />
          <SectionCard
            icon={<PenTool className="h-5 w-5" />}
            tone="emerald"
            label="Writing"
            sublabel="Tasks 3 & 4"
            score={writingPct}
            band={writingBand}
            detail={
              wScores.length === 0
                ? "No writing submitted"
                : `${wScores.length} of 2 tasks evaluated`
            }
          />
        </div>

        {/* READING — per-task + per-question breakdown */}
        <section className="space-y-4">
          <div className="flex items-end gap-2">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Reading breakdown
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 pb-1">{readingScore}/30 correct</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ReadingTaskCard label="Task 1 — Long Reading" fb={r1fb} startQ={1} endQ={15} />
            <ReadingTaskCard label="Task 2 — Multi-text Reading" fb={r2fb} startQ={16} endQ={30} />
          </div>

          {/* Per-question detail (Pro) */}
          {isPro && (r1fb?.questions || r2fb?.questions) && (
            <ReadingQuestionDetail
              r1Questions={r1fb?.questions ?? []}
              r2Questions={r2fb?.questions ?? []}
            />
          )}

          {!isPro && (
            <UpgradeCard
              title="Unlock detailed reading feedback"
              body="Pro users see per-question breakdown with examiner explanations for every wrong answer."
            />
          )}
        </section>

        {/* WRITING — per-task feedback */}
        <section className="space-y-4">
          <div className="flex items-end gap-2">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <PenTool className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Writing feedback
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 pb-1">
              {wScores.length === 0 ? "Not submitted" : `${wScores.length} task${wScores.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {[w1, w2].filter(Boolean).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 p-8 text-center">
              <PenTool className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">No writing submitted</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Task 3 (Reading into Writing) and Task 4 (Extended Writing) were not completed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {[w1, w2].filter((x): x is NonNullable<typeof x> => !!x).map((r) => (
                <WritingTaskCard key={r.taskType} r={r} isPro={isPro} />
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href="/practice">
            <Button size="lg" className="gap-2">Take another exam</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────

function SectionCard({
  icon, tone, label, sublabel, score, band, detail,
}: {
  icon: React.ReactNode;
  tone: "blue" | "emerald";
  label: string;
  sublabel: string;
  score: number | null;
  band: string;
  detail: string;
}) {
  const toneClasses = tone === "blue"
    ? { iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300", ring: "ring-blue-200/60 dark:ring-blue-900/40", grad: "from-blue-50/80 to-transparent dark:from-blue-950/30" }
    : { iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300", ring: "ring-emerald-200/60 dark:ring-emerald-900/40", grad: "from-emerald-50/80 to-transparent dark:from-emerald-950/30" };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 sm:p-6 ring-1", toneClasses.ring)}>
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", toneClasses.grad)} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneClasses.iconBg)}>
            {icon}
          </div>
          {score !== null && (
            <Badge className={cn("border-0", bandBg(band))}>
              <Award className="h-3 w-3 mr-1" /> {band}
            </Badge>
          )}
        </div>
        <p className="mt-3 text-[10px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400">{sublabel}</p>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{label}</h3>
        <p className="mt-3 text-3xl sm:text-4xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
          {score !== null ? `${score}%` : "—"}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
        {score !== null && (
          <div className="mt-3 h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                bandColor(band).includes("purple") ? "bg-purple-500" :
                bandColor(band).includes("blue") ? "bg-blue-500" :
                bandColor(band).includes("green") ? "bg-green-500" :
                "bg-red-500",
              )}
              style={{ width: `${score}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ReadingTaskCard({ label, fb, startQ, endQ }: {
  label: string;
  fb?: ReadingAggregate;
  startQ: number;
  endQ: number;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{label}</p>
          {fb && (
            <Badge variant={fb.percentage >= 60 ? "success" : "warning"}>
              {fb.score}/{fb.total}
            </Badge>
          )}
        </div>
        {fb ? (
          <>
            <Progress value={fb.percentage} />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Questions {startQ}–{endQ} · {fb.percentage}% correct
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-400">No data</p>
        )}
      </CardContent>
    </Card>
  );
}

function ReadingQuestionDetail({ r1Questions, r2Questions }: {
  r1Questions: ReadingQuestionResult[];
  r2Questions: ReadingQuestionResult[];
}) {
  const [open, setOpen] = useState(false);
  const all = [...r1Questions, ...r2Questions];
  const wrongCount = all.filter(q => !q.isCorrect).length;

  if (all.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Per-question feedback</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {wrongCount === 0 ? "All correct — perfect score!" : `${wrongCount} wrong · with examiner explanations`}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="border-t border-zinc-100 dark:border-zinc-800/60 divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {all.map((q) => (
            <div key={q.num} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  q.isCorrect ? "bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-300" : "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300",
                )}>
                  {q.isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Q{q.num}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {QUESTION_TYPE_LABEL[q.type] ?? q.type}
                    </Badge>
                  </div>
                  {q.context && (
                    <p className="mt-1 text-xs italic text-zinc-500 dark:text-zinc-400 leading-relaxed">{q.context}</p>
                  )}
                  <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400 mr-1">Your answer:</span>
                      <span className={cn("font-semibold", q.isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300")}>
                        {q.userAnswer || "(blank)"}
                      </span>
                    </div>
                    <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400 mr-1">Correct:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{q.correctAnswer}</span>
                    </div>
                  </div>
                  {!q.isCorrect && q.explanation && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30 p-3">
                      <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" />
                      <p className="text-xs text-blue-900/90 dark:text-blue-100/90 leading-relaxed">{q.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WritingTaskCard({ r, isPro }: {
  r: { taskType: string; response: string; aiFeedback: (WritingFeedback | ReadingAggregate) | null; score: number | null };
  isPro: boolean;
}) {
  const fb = r.aiFeedback as WritingFeedback | null;
  const label = r.taskType === "READING_INTO_WRITING" ? "Task 3 — Reading into Writing" : "Task 4 — Extended Writing";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base sm:text-lg">{label}</CardTitle>
          {r.score != null && (
            <Badge variant={r.score >= 10 ? "success" : "warning"}>{r.score}/20</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Your response</h4>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/60 p-4 text-sm leading-relaxed border border-zinc-200/80 dark:border-zinc-800 max-h-48 overflow-y-auto whitespace-pre-wrap">
            {r.response}
          </div>
        </div>

        {fb && isPro ? (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">AI feedback · Trinity rating 0-4</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {(["readingAndWriting", "taskFulfilment", "organisationAndStructure", "languageControl"] as const).map((key) => {
                const area = fb[key];
                if (!area) return null;
                const labelMap: Record<string, string> = {
                  readingAndWriting: "Reading & Writing",
                  taskFulfilment: "Task Fulfilment",
                  organisationAndStructure: "Organisation & Structure",
                  languageControl: "Language Control",
                };
                return (
                  <div key={key} className="rounded-lg border border-zinc-200/80 dark:border-zinc-800 p-3">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">{labelMap[key]}</span>
                      <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{area.score}/4</span>
                    </div>
                    <Progress value={(area.score / 4) * 100} />
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{area.comments}</p>
                  </div>
                );
              })}
            </div>

            {fb.suggestions && fb.suggestions.length > 0 && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/60 dark:border-violet-900/50 dark:bg-violet-950/30 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300 mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Suggestions
                </h4>
                <ul className="space-y-1.5">
                  {fb.suggestions.map((s, idx) => (
                    <li key={idx} className="text-sm text-violet-900/90 dark:text-violet-100/90 flex items-start gap-2">
                      <span className="text-violet-600 dark:text-violet-300 shrink-0">→</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : !isPro ? (
          <UpgradeCard
            title="Unlock detailed writing feedback"
            body="Pro users see per-criteria scores (grammar, vocab, organisation, task fulfilment) and personalised suggestions."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function UpgradeCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 p-6 text-center">
      <Lock className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">{body}</p>
      <Link href="/pricing">
        <Button size="sm" className="mt-3 gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
          Upgrade to Pro
        </Button>
      </Link>
    </div>
  );
}
