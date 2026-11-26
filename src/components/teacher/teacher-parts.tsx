"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import type { TeachableTag } from "@/lib/teacher";

/** The error tag's name in the learner's language ("Preposiciones"). */
export function useTagLabel() {
  const { dict } = useI18n();
  return (tag: string) => (dict.writing.tags as Record<string, string>)[tag] ?? tag;
}

/** Start a lesson on `focus` and open it. */
export function useStartLesson() {
  const router = useRouter();
  const { dict, locale } = useI18n();
  const tc = dict.teacher;
  const [starting, setStarting] = useState<TeachableTag | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (focus: TeachableTag) => {
    if (starting) return;
    setStarting(focus);
    setError(null);
    try {
      const res = await fetch("/api/teacher/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.code === "DAILY_LIMIT" ? tc.limitReached : data.code === "AI_LIMIT" ? tc.aiLimit : tc.error);
      }
      router.push(`/grammar/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc.error);
      setStarting(null);
    }
  };

  return { start, starting, error };
}

/** Full-page wait while the lesson is written (~20 s). */
export function LessonLoading({ topic }: { topic: string }) {
  const { t, dict } = useI18n();
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-paper/95 px-6 backdrop-blur-sm">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rule text-ink">
          <GraduationCap className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 font-display text-2xl font-semibold text-ink">{dict.teacher.preparing}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("teacher.preparingHint", { topic: topic.toLowerCase() })}</p>
        <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-ink-soft" aria-hidden />
      </div>
    </div>
  );
}
