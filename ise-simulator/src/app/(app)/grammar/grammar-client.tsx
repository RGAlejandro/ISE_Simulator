"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { CefrLevel, GrammarExerciseType } from "@/types";

const CEFR_LEVELS: { level: CefrLevel; label: string; description: string; color: string }[] = [
  { level: "A1", label: "A1", description: "Beginner", color: "bg-emerald-100 dark:bg-emerald-900 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200" },
  { level: "A2", label: "A2", description: "Elementary", color: "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200" },
  { level: "B1", label: "B1", description: "Intermediate", color: "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200" },
  { level: "B2", label: "B2", description: "Upper-Int.", color: "bg-violet-100 dark:bg-violet-900 border-violet-300 dark:border-violet-700 text-violet-800 dark:text-violet-200" },
  { level: "C1", label: "C1", description: "Advanced", color: "bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200" },
  { level: "C2", label: "C2", description: "Mastery", color: "bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200" },
];

const EXERCISE_TYPES: { type: GrammarExerciseType; label: string; icon: string; description: string }[] = [
  { type: "gap_fill", label: "Gap Fill", icon: "✏️", description: "Fill in the missing word or phrase" },
  { type: "mcq", label: "Multiple Choice", icon: "☑️", description: "Choose the correct grammatical form" },
  { type: "error_correction", label: "Error Correction", icon: "🔍", description: "Find and fix the grammar mistake" },
];

export function GrammarClient() {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState<CefrLevel | null>(null);
  const [selectedType, setSelectedType] = useState<GrammarExerciseType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = selectedLevel !== null && selectedType !== null && !loading;

  const generate = async () => {
    if (!selectedLevel || !selectedType) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/grammar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cefrLevel: selectedLevel, exerciseType: selectedType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate exercises");
      router.push(`/grammar/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="mx-auto max-w-2xl space-y-8">

        <div className="flex items-center gap-3">
          <Link href="/practice">
            <Button variant="ghost" size="sm" className="gap-1 text-zinc-500">
              <ArrowLeft className="h-4 w-4" />
              Practice
            </Button>
          </Link>
        </div>

        <div className="text-center space-y-2">
          <div className="text-4xl">📝</div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Grammar Exercises</h1>
          <p className="text-zinc-500 dark:text-zinc-400">10 AI-generated questions tailored to your CEFR level</p>
        </div>

        {/* Level selector */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 text-center">Select your level</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {CEFR_LEVELS.map(({ level, label, description, color }) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`
                  flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all cursor-pointer
                  ${selectedLevel === level
                    ? `${color} border-current shadow-md scale-105`
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }
                `}
              >
                <span className="text-xl font-bold">{label}</span>
                <span className="text-xs mt-0.5 text-zinc-500 dark:text-zinc-400">{description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Exercise type selector */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 text-center">Select exercise type</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {EXERCISE_TYPES.map(({ type, label, icon, description }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`
                  flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all cursor-pointer
                  ${selectedType === type
                    ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-400 dark:border-emerald-500 shadow-md"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }
                `}
              >
                <span className="text-2xl">{icon}</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{label}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300 text-center">
            {error}
          </div>
        )}

        <Button
          onClick={generate}
          disabled={!canGenerate}
          className="w-full h-12 text-base gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating 10 questions...
            </>
          ) : (
            <>
              <span>📝</span>
              Start Exercise
            </>
          )}
        </Button>

        {(!selectedLevel || !selectedType) && (
          <p className="text-center text-xs text-zinc-400">
            {!selectedLevel && !selectedType ? "Select a level and exercise type to start" :
             !selectedLevel ? "Select a level" : "Select an exercise type"}
          </p>
        )}
      </div>
    </div>
  );
}
