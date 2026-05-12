"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Volume2, BookOpen, Loader2, ChevronDown } from "lucide-react";
import { EXAM_LEVELS, FREE_DAILY_LIMIT } from "@/lib/constants";

type ExamLevel = "ISE_FOUNDATION" | "ISE_I" | "ISE_II" | "ISE_III" | "ISE_IV";

interface PracticeClientProps {
  isPro: boolean;
  listeningCount: number;
  canTakeListening: boolean;
}

export function PracticeClient({ isPro, listeningCount, canTakeListening }: PracticeClientProps) {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState<ExamLevel | "">("");
  const [loading, setLoading] = useState<"listening" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startListening = async () => {
    if (!selectedLevel) {
      setError("Please select a level first.");
      return;
    }
    if (!canTakeListening) {
      setError(`Daily limit reached (${FREE_DAILY_LIMIT.listening}/day for free users). Upgrade to Pro for unlimited sessions.`);
      return;
    }
    setError(null);
    setLoading("listening");
    try {
      const res = await fetch("/api/listening/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: selectedLevel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate session");
      router.push(`/listening/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(null);
    }
  };

  const listeningLabel = isPro
    ? `${listeningCount} sessions today`
    : `${listeningCount}/${FREE_DAILY_LIMIT.listening} today`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="mx-auto max-w-4xl space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Practice Modules</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Targeted practice to improve your Trinity ISE skills
          </p>
        </div>

        {/* Level selector */}
        <div className="mx-auto max-w-sm space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Select your level
          </label>
          <div className="relative">
            <select
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value as ExamLevel);
                setError(null);
              }}
            >
              <option value="">Choose a level...</option>
              {EXAM_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label} — {l.cefr}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-auto max-w-sm rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Practice modules */}
        <div className="grid gap-6 md:grid-cols-3">

          {/* Listening Practice */}
          <Card className="relative overflow-hidden border-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950 pointer-events-none" />
            <CardHeader className="relative pb-2">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Volume2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <Badge variant="outline" className="text-xs">
                  {listeningLabel}
                </Badge>
              </div>
              <CardTitle className="text-lg mt-3">Listening Practice</CardTitle>
              <CardDescription className="text-sm">
                Trinity-style two-round listening. First for gist, second for details.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-3">
              <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                <li>• AI reads passage aloud (TTS)</li>
                <li>• Round 1: General summary (60s)</li>
                <li>• Round 2: Detailed written notes</li>
                <li>• AI feedback on both rounds</li>
              </ul>
              <Button
                onClick={startListening}
                disabled={loading !== null || !canTakeListening}
                className="w-full gap-2"
              >
                {loading === "listening" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : !canTakeListening ? (
                  "Daily limit reached"
                ) : (
                  <>
                    <Volume2 className="h-4 w-4" />
                    Start Listening
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Grammar Exercises — LIVE */}
          <Card className="relative overflow-hidden border-2 hover:border-green-300 dark:hover:border-green-700 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent dark:from-green-950 pointer-events-none" />
            <CardHeader className="relative pb-2">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <Badge variant="outline" className="text-xs">Unlimited</Badge>
              </div>
              <CardTitle className="text-lg mt-3">Grammar Exercises</CardTitle>
              <CardDescription className="text-sm">
                AI-generated gap fills, MCQs, and error correction by CEFR level.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-3">
              <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                <li>• A1–C2 difficulty levels</li>
                <li>• Gap fill, MCQ, error correction</li>
                <li>• 10 questions per session</li>
                <li>• Unlimited practice</li>
              </ul>
              <Link href="/grammar">
                <Button className="w-full gap-2">
                  <BookOpen className="h-4 w-4" />
                  Open Grammar
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Vocabulary Flashcards — LIVE */}
          <Card className="relative overflow-hidden border-2 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-950 pointer-events-none" />
            <CardHeader className="relative pb-2">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <span className="text-xl">🃏</span>
                </div>
                <Badge variant="outline" className="text-xs">Unlimited</Badge>
              </div>
              <CardTitle className="text-lg mt-3">Vocabulary Flashcards</CardTitle>
              <CardDescription className="text-sm">
                AI-generated EN↔ES flip cards by level and topic.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-3">
              <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                <li>• English ↔ Spanish (A1–C2)</li>
                <li>• Choose topic or write your own</li>
                <li>• Tap to flip cards</li>
                <li>• Retry cards you don&apos;t know</li>
              </ul>
              <Link href="/vocabulary">
                <Button className="w-full gap-2">
                  <span>🃏</span>
                  Open Flashcards
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
