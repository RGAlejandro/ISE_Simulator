"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenTool, Mic, BarChart2, Trophy, Loader2 } from "lucide-react";
import type { UserUsage } from "@/types";

interface DashboardClientProps {
  user: { name: string | null; email: string; plan: string };
  usage: UserUsage;
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

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  EVALUATED: "Evaluated",
};

export function DashboardClient({ user, usage, recentExams, totalExams, levels }: DashboardClientProps) {
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
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Recent Exams
          </h2>
          <div className="space-y-3">
            {recentExams.map((exam) => (
              <Card key={exam.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {exam.type === "oral" ? (
                      <Mic className="h-5 w-5 text-purple-400" />
                    ) : (
                      <PenTool className="h-5 w-5 text-zinc-400" />
                    )}
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {exam.level.replace("_", " ")}
                        <span className="ml-2 text-xs text-zinc-400 font-normal">
                          {exam.type === "oral" ? "Oral" : "Written"}
                        </span>
                      </p>
                      <p className="text-sm text-zinc-500">
                        {new Date(exam.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        exam.status === "EVALUATED" ? "success" :
                        exam.status === "COMPLETED" ? "default" : "warning"
                      }
                    >
                      {STATUS_LABEL[exam.status] ?? exam.status}
                    </Badge>
                    {exam.score != null && (
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {exam.score}%
                      </span>
                    )}
                    {exam.status === "EVALUATED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(
                            exam.type === "oral"
                              ? `/results/${exam.id}?type=oral`
                              : `/results/${exam.id}`
                          )
                        }
                      >
                        View Results
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
