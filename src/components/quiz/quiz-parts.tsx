"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { useTagLabel } from "@/components/teacher/teacher-parts";
import type { QuizSource } from "@/lib/quiz";

/** Make a quiz and open it. */
export function useStartQuiz() {
  const router = useRouter();
  const { dict, locale } = useI18n();
  const tq = dict.quiz;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.code === "DAILY_LIMIT" ? tq.limitReached : data.code === "AI_LIMIT" ? tq.aiLimit : data.code === "NO_MISTAKES" ? tq.empty : tq.error,
        );
      }
      router.push(`/quiz/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tq.error);
      setStarting(false);
    }
  };

  return { start, starting, error };
}

/** Full-page wait while the questions are written (~20 s). */
export function QuizLoading() {
  const { dict } = useI18n();
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-paper/95 px-6 backdrop-blur-sm">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rule text-ink">
          <ListChecks className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 font-display text-2xl font-semibold text-ink">{dict.quiz.preparing}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{dict.quiz.preparingHint}</p>
        <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-ink-soft" aria-hidden />
      </div>
    </div>
  );
}

/** "From your writing · 18 Nov", "From the Teacher · Prepositions"… */
export function useSourceLine() {
  const { t, locale } = useI18n();
  const tag = useTagLabel();
  return (q: { source: QuizSource; date: string; topic: string }) => {
    const date = new Date(q.date).toLocaleDateString(locale, { day: "numeric", month: "short" });
    return t(`quiz.from.${q.source}`, { date, topic: q.topic ? tag(q.topic) : "" });
  };
}

/** "___" drawn as a blank line. */
export function WithGaps({ text }: { text: string }) {
  return (
    <>
      {text.split(/_{3,}/).map((part, i, all) => (
        <span key={i}>
          {part}
          {i < all.length - 1 && <span aria-label="___" className="mx-1 inline-block w-16 border-b-2 border-ink-soft align-baseline" />}
        </span>
      ))}
    </>
  );
}
