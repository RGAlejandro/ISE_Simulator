"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenTool, Mic, BarChart2, Trophy, Loader2, ChevronRight, Upload, FileText, Lock } from "lucide-react";
import Link from "next/link";
import type { UserUsage } from "@/types";

interface DashboardClientProps {
  user: { name: string | null; email: string; plan: string };
  usage: UserUsage;
  isPro: boolean;
  recentExams: Array<{
    id: string;
    type: "written" | "oral";
    level: string;
    status: string;
    score: number | null;
    createdAt: string;
  }>;
  totalExams: number;
  levels: Array<{ value: string; label: string; cefr: string; color: string }>;
}

const LEVEL_SHORT: Record<string, string> = {
  ISE_FOUNDATION: "Foundation (A2)",
  ISE_I: "ISE I (B1)",
  ISE_II: "ISE II (B2)",
  ISE_III: "ISE III (C1)",
  ISE_IV: "ISE IV (C2)",
};

function ExamRow({ exam, isPro }: {
  exam: { id: string; type: "written" | "oral"; level: string; status: string; score: number | null; createdAt: string };
  isPro: boolean;
}) {
  const isWritten = exam.type === "written";
  const isEvaluated = exam.status === "EVALUATED";
  const isInProgress = exam.status === "IN_PROGRESS";

  const resultsHref = isWritten
    ? `/results/${exam.id}`
    : `/results/${exam.id}?type=oral`;
  const continueHref = isWritten
    ? `/exam/written/${exam.id}`
    : `/exam/oral/${exam.id}`;
  const submitPaperHref = `/exam/paper/${exam.id}/submit`;

  const bandLabel = (score: number | null) => {
    if (score === null) return null;
    if (score >= 80) return { label: "Distinction", cls: "text-purple-600 dark:text-purple-400" };
    if (score >= 65) return { label: "Merit", cls: "text-blue-600 dark:text-blue-400" };
    if (score >= 50) return { label: "Pass", cls: "text-green-600 dark:text-green-400" };
    return { label: "Fail", cls: "text-red-500" };
  };
  const band = bandLabel(exam.score);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex items-stretch">
          {/* Color stripe */}
          <div className={`w-1 flex-shrink-0 ${isWritten ? "bg-blue-500" : "bg-purple-500"}`} />

          <div className="flex-1 flex items-center gap-4 px-4 py-3 flex-wrap">
            {/* Icon + title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isWritten ? "bg-blue-100 dark:bg-blue-900" : "bg-purple-100 dark:bg-purple-900"
              }`}>
                {isWritten
                  ? <PenTool className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  : <Mic className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {LEVEL_SHORT[exam.level] ?? exam.level}
                  <span className="ml-2 text-xs text-zinc-400 font-normal">{isWritten ? "Written" : "Oral"}</span>
                </p>
                <p className="text-xs text-zinc-500">{new Date(exam.createdAt).toLocaleDateString("en-GB")}</p>
              </div>
            </div>

            {/* Score + band */}
            {exam.score !== null && (
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{Math.round(exam.score)}%</p>
                {band && <p className={`text-xs font-medium ${band.cls}`}>{band.label}</p>}
              </div>
            )}

            {/* Status + CTAs */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {isEvaluated ? (
                <>
                  <Badge variant="success" className="text-xs">Evaluated</Badge>
                  {!isPro && (
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Lock className="h-3 w-3" /> Full feedback: Pro
                    </span>
                  )}
                  <Link href={resultsHref}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      View Results <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </>
              ) : isInProgress ? (
                <>
                  <Badge variant="warning" className="text-xs">In Progress</Badge>
                  <Link href={continueHref}>
                    <Button size="sm" className="gap-1.5">
                      {isWritten ? <FileText className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                      Continue
                    </Button>
                  </Link>
                  {isWritten && (
                    <Link href={submitPaperHref}>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Upload className="h-3.5 w-3.5" /> Submit Paper
                      </Button>
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Badge variant="default" className="text-xs">Completed</Badge>
                  <Link href={resultsHref}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export function DashboardClient({ user, usage, isPro, recentExams, totalExams, levels }: DashboardClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [oralLoading, setOralLoading] = useState<string | null>(null);
  const [topicInputs, setTopicInputs] = useState<Record<string, string>>({});
  const [generatingMessage, setGeneratingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startWrittenExam(level: string) {
    if (!usage.canTakeWritten) return;
    setError(null);
    setLoading(level);
    setGeneratingMessage("Generating your written exam... This may take a moment.");

    try {
      const res = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to generate exam");
        return;
      }

      const data = await res.json();
      router.push(`/exam/written/${data.examId}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
      setGeneratingMessage(null);
    }
  }

  async function startOralExam(level: string) {
    if (!usage.canTakeOral) return;
    const topic = topicInputs[level]?.trim();
    if (!topic || topic.length < 3) {
      setError("Please enter your topic (at least 3 characters).");
      return;
    }
    setError(null);
    setOralLoading(level);
    setGeneratingMessage("Starting your oral exam... Preparing the examiner.");

    try {
      const res = await fetch("/api/exam/oral/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, topic }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start oral exam");
        return;
      }

      const data = await res.json();
      router.push(`/exam/oral/${data.examId}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setOralLoading(null);
      setGeneratingMessage(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Full-screen loading overlay */}
      {generatingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 rounded-2xl bg-white dark:bg-zinc-900 p-10 shadow-2xl max-w-md mx-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-blue-200 dark:border-blue-800" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                Generating your exam
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {generatingMessage}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">
                Our AI is crafting a unique exam just for you. This usually takes 15-30 seconds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700 font-medium">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Welcome back{user.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Ready to practice? Choose your exam type and level below.
          </p>
        </div>
        <Badge variant={user.plan === "PRO" ? "default" : "secondary"} className="self-start text-sm px-3 py-1">
          {user.plan} Plan
        </Badge>
      </div>

      {/* Usage Stats */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
              <PenTool className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Written Today</p>
              <p className="text-2xl font-bold">{usage.writtenCount}{user.plan === "FREE" ? "/1" : ""}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <Mic className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Oral Today</p>
              <p className="text-2xl font-bold">{usage.oralCount}{user.plan === "FREE" ? "/1" : ""}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
              <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Exams</p>
              <p className="text-2xl font-bold">{totalExams}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
              <BarChart2 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Last Score</p>
              <p className="text-2xl font-bold">
                {recentExams[0]?.score != null ? `${recentExams[0].score}%` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exam Selection */}
      <div className="mt-8">
        <Tabs defaultValue="written">
          <TabsList className="mb-6">
            <TabsTrigger value="written" className="gap-2">
              <PenTool className="h-4 w-4" /> Written Exam
            </TabsTrigger>
            <TabsTrigger value="oral" className="gap-2">
              <Mic className="h-4 w-4" /> Oral Exam
            </TabsTrigger>
          </TabsList>

          <TabsContent value="written">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {levels.map((level) => (
                <Card key={level.value} className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{level.label}</CardTitle>
                      <Badge variant="outline">{level.cefr}</Badge>
                    </div>
                    <CardDescription>
                      Written exam: 2 readings + 2 writings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      disabled={!usage.canTakeWritten || loading !== null}
                      onClick={() => startWrittenExam(level.value)}
                    >
                      {loading === level.value ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Exam...
                        </>
                      ) : (
                        "Start Written Exam"
                      )}
                    </Button>
                    {!usage.canTakeWritten && (
                      <p className="mt-2 text-center text-xs text-zinc-500">
                        Daily limit reached.{" "}
                        <a href="/pricing" className="text-blue-600 hover:underline">Upgrade to Pro</a>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="oral">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {levels.map((level) => (
                <Card key={level.value} className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{level.label}</CardTitle>
                      <Badge variant="outline">{level.cefr}</Badge>
                    </div>
                    <CardDescription>
                      Oral exam: topic + collaborative + conversation + listening
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">
                        Your topic for the exam:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Social media, Climate change..."
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={topicInputs[level.value] || ""}
                        onChange={(e) =>
                          setTopicInputs((prev) => ({ ...prev, [level.value]: e.target.value }))
                        }
                        disabled={!usage.canTakeOral || oralLoading !== null}
                      />
                    </div>
                    <Button
                      className="w-full gap-2"
                      variant="secondary"
                      disabled={!usage.canTakeOral || oralLoading !== null}
                      onClick={() => startOralExam(level.value)}
                    >
                      {oralLoading === level.value ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Starting Exam...
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4" />
                          Start Oral Exam
                        </>
                      )}
                    </Button>
                    {!usage.canTakeOral && (
                      <p className="mt-2 text-center text-xs text-zinc-500">
                        Daily limit reached.{" "}
                        <a href="/pricing" className="text-blue-600 hover:underline">Upgrade to Pro</a>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Recent Exams */}
      {recentExams.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">My Exams</h2>
            <span className="text-sm text-zinc-500">{recentExams.length} recent</span>
          </div>
          <div className="space-y-3">
            {recentExams.map((exam) => (
              <ExamRow key={exam.id} exam={exam} isPro={isPro} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
