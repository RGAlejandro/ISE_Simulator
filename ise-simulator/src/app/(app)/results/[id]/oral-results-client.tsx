"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, ArrowLeft, Lock, Mic } from "lucide-react";
import Link from "next/link";
import type { OralTaskType } from "@/types";

const TASK_LABELS: Record<OralTaskType, string> = {
  TOPIC: "Topic Task",
  COLLABORATIVE: "Collaborative Task",
  CONVERSATION: "Conversation Task",
  LISTENING: "Listening Task",
};

// Trinity ISE Speaking & Listening 4-criterion rating scale (applies to spoken tasks).
const SPOKEN_SKILL_KEYS = [
  "communicativeEffectiveness",
  "interactiveListening",
  "languageControl",
  "delivery",
] as const;

const SKILL_LABELS: Record<string, string> = {
  communicativeEffectiveness: "Communicative Effectiveness",
  interactiveListening: "Interactive Listening",
  languageControl: "Language Control",
  delivery: "Delivery",
  listening: "Independent Listening",
};

interface OralResultsClientProps {
  exam: {
    id: string;
    level: string;
    status: string;
    overallScore: number | null;
    createdAt: string;
  };
  feedback: Array<{
    taskType: string;
    feedback: Record<string, unknown>;
    score: number | null;
  }>;
  exchanges: Array<{
    taskType: string;
    role: string;
    content: string;
  }>;
  isPro: boolean;
}

export function OralResultsClient({ exam, feedback, exchanges, isPro }: OralResultsClientProps) {
  const getBand = (score: number | null) => {
    if (score === null) return "N/A";
    if (score >= 80) return "Distinction";
    if (score >= 65) return "Merit";
    if (score >= 50) return "Pass";
    return "Fail";
  };

  const band = getBand(exam.overallScore);
  const bandColor =
    band === "Distinction" ? "text-purple-600" :
    band === "Merit" ? "text-blue-600" :
    band === "Pass" ? "text-green-600" :
    "text-red-600";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/dashboard">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </Button>
      </Link>

      {/* Overall Score */}
      <Card className="mb-8">
        <CardContent className="flex flex-col items-center py-10">
          <div className="flex items-center gap-2 mb-4">
            <Mic className={`h-12 w-12 ${bandColor}`} />
            <Trophy className={`h-12 w-12 ${bandColor}`} />
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {exam.overallScore != null ? `${exam.overallScore}%` : "Pending"}
          </h1>
          <Badge
            variant={band === "Fail" ? "warning" : "success"}
            className="mt-2 text-base px-4 py-1"
          >
            {band}
          </Badge>
          <p className="mt-2 text-sm text-zinc-500">
            Oral Exam • {exam.level.replace("_", " ")} • {new Date(exam.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Task-by-task feedback */}
      <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
        Performance by Task
      </h2>
      <div className="space-y-6">
        {feedback.map((f) => {
          const fb = f.feedback as Record<string, { score: number; comments: string }> & {
            suggestions?: string[];
          };
          const taskLabel = TASK_LABELS[f.taskType as OralTaskType] || f.taskType;

          // Trinity: Listening task is scored 0-5 on a single criterion; spoken tasks 0-20 (sum of 4).
          const isListening = f.taskType === "LISTENING";
          const maxScore = isListening ? 5 : 20;
          const passThreshold = isListening ? 3 : 10;
          const distinctionThreshold = isListening ? 5 : 17;
          const skillKeys: readonly string[] = isListening
            ? ["listening"]
            : SPOKEN_SKILL_KEYS;

          return (
            <Card key={f.taskType}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{taskLabel}</CardTitle>
                  {f.score != null && (
                    <Badge variant={f.score >= distinctionThreshold ? "success" : f.score >= passThreshold ? "default" : "warning"}>
                      {f.score}/{maxScore}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isPro ? (
                  <div className="space-y-4">
                    {/* Skill scores — Trinity 4-criterion rating scale */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {skillKeys.map((key) => {
                        const area = fb[key];
                        if (!area || typeof area !== "object") return null;
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{SKILL_LABELS[key] ?? key}</span>
                              <span className="font-semibold">{area.score}/5</span>
                            </div>
                            <Progress value={(area.score / 5) * 100} />
                            <p className="mt-1 text-xs text-zinc-500">{area.comments}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Suggestions */}
                    {fb.suggestions && fb.suggestions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-zinc-500 mb-2">Suggestions</h4>
                        <ul className="space-y-1">
                          {fb.suggestions.map((s: string, idx: number) => (
                            <li
                              key={idx}
                              className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2"
                            >
                              <span className="text-blue-600 shrink-0">💡</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Transcript */}
                    <details className="mt-2">
                      <summary className="text-sm font-medium text-zinc-500 cursor-pointer hover:text-zinc-700">
                        View Transcript
                      </summary>
                      <div className="mt-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-sm leading-relaxed border max-h-60 overflow-y-auto space-y-2">
                        {exchanges
                          .filter((e) => e.taskType === f.taskType)
                          .map((e, i) => {
                            // Skip JSON-encoded listening data
                            let content = e.content;
                            try {
                              const parsed = JSON.parse(e.content);
                              if (parsed.listeningText) {
                                content = `[Listening passage: ${parsed.listeningText.slice(0, 100)}...]`;
                              }
                            } catch {
                              // Not JSON, use as-is
                            }

                            return (
                              <div
                                key={i}
                                className={
                                  e.role === "EXAMINER"
                                    ? "text-blue-700 dark:text-blue-300"
                                    : "text-zinc-900 dark:text-zinc-100"
                                }
                              >
                                <strong>{e.role === "EXAMINER" ? "Examiner" : "You"}:</strong>{" "}
                                {content}
                              </div>
                            );
                          })}
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="rounded-lg bg-zinc-100 dark:bg-zinc-900 p-6 text-center border-dashed border-2 border-zinc-300 dark:border-zinc-700">
                    <Lock className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
                    <p className="text-sm text-zinc-500 mb-1">
                      Score: {f.score != null ? `${f.score}/${maxScore}` : "N/A"}
                    </p>
                    <p className="text-sm text-zinc-500 mb-3">
                      Detailed feedback and transcript available for Pro users
                    </p>
                    <Link href="/pricing">
                      <Button size="sm">Upgrade to Pro</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="lg">
            Take Another Exam
          </Button>
        </Link>
      </div>
    </div>
  );
}
