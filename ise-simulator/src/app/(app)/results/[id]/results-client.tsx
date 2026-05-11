"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, ArrowLeft, Lock, BookOpen } from "lucide-react";
import Link from "next/link";
import type { WritingFeedback } from "@/types";

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
    aiFeedback: WritingFeedback | null;
    score: number | null;
  }>;
  isPro: boolean;
}

export function ResultsClient({ exam, responses, isPro }: ResultsClientProps) {
  const getBand = (score: number | null) => {
    if (score === null) return "N/A";
    if (score >= 80) return "Distinction";
    if (score >= 65) return "Merit";
    if (score >= 50) return "Pass";
    return "Fail";
  };

  const band = getBand(exam.score);
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
          <Trophy className={`h-16 w-16 mb-4 ${bandColor}`} />
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {exam.score != null ? `${exam.score}%` : "Pending"}
          </h1>
          <Badge
            variant={band === "Fail" ? "warning" : "success"}
            className="mt-2 text-base px-4 py-1"
          >
            {band}
          </Badge>
          <p className="mt-2 text-sm text-zinc-500">
            {exam.level.replace("_", " ")} • {new Date(exam.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Reading Scores */}
      {responses.some((r) => r.taskType === "READING_1" || r.taskType === "READING_2") && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Reading Scores
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {responses
              .filter((r) => r.taskType === "READING_1" || r.taskType === "READING_2")
              .map((r) => {
                const fb = r.aiFeedback as { score: number; total: number; percentage: number } | null;
                const label = r.taskType === "READING_1" ? "Reading Task 1" : "Reading Task 2";
                return (
                  <Card key={r.taskType}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
                        {fb && (
                          <Badge variant={fb.percentage >= 60 ? "success" : "warning"}>
                            {fb.score}/{fb.total}
                          </Badge>
                        )}
                      </div>
                      {fb && <Progress value={fb.percentage} />}
                      {fb && (
                        <p className="mt-2 text-sm text-zinc-500">{fb.percentage}% correct</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Writing Feedback */}
      <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
        Writing Feedback
      </h2>
      <div className="space-y-6">
        {responses.filter((r) => r.taskType !== "READING_1" && r.taskType !== "READING_2").map((r) => (
          <Card key={r.taskType}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {r.taskType.replace(/_/g, " ")}
                </CardTitle>
                {r.score != null && (
                  <Badge variant={r.score >= 10 ? "success" : "warning"}>
                    {r.score}/20
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Your response */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-zinc-500 mb-2">Your Response</h4>
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-sm leading-relaxed border max-h-48 overflow-y-auto">
                  {r.response}
                </div>
              </div>

              {/* AI Feedback */}
              {r.aiFeedback && isPro ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-zinc-500">AI Feedback</h4>

                  {/* Score bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(["taskFulfillment", "grammar", "vocabulary", "organization"] as const).map((key) => {
                      const area = r.aiFeedback![key];
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                            <span className="font-semibold">{area.score}/5</span>
                          </div>
                          <Progress value={(area.score / 5) * 100} />
                          <p className="mt-1 text-xs text-zinc-500">{area.comments}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Suggestions */}
                  {r.aiFeedback.suggestions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-500 mb-2">Suggestions</h4>
                      <ul className="space-y-1">
                        {r.aiFeedback.suggestions.map((s, idx) => (
                          <li key={idx} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                            <span className="text-blue-600 shrink-0">💡</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : !isPro ? (
                <div className="rounded-lg bg-zinc-100 dark:bg-zinc-900 p-6 text-center border-dashed border-2 border-zinc-300 dark:border-zinc-700">
                  <Lock className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
                  <p className="text-sm text-zinc-500 mb-3">
                    Detailed AI feedback is available for Pro users
                  </p>
                  <Link href="/pricing">
                    <Button size="sm">Upgrade to Pro</Button>
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="lg">Take Another Exam</Button>
        </Link>
      </div>
    </div>
  );
}
