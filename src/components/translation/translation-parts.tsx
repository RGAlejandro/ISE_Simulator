"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stamp, type StampBand } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { DEFAULT_ROUND, isRoundSize, type RoundSize, type TranslationResult, type Verdict } from "@/lib/translation";

const VERDICT_BAND: Record<Verdict, StampBand> = { correct: "pass", almost: "distinction", wrong: "below" };

export function VerdictStamp({ verdict, className }: { verdict: Verdict; className?: string }) {
  const { dict } = useI18n();
  return <Stamp band={VERDICT_BAND[verdict]} className={className}>{dict.translation.verdict[verdict]}</Stamp>;
}

/** Remembered round size (per browser; storage may be unavailable). */
const COUNT_KEY = "translation.count";
export function loadRoundSize(): RoundSize {
  try {
    const n = Number(localStorage.getItem(COUNT_KEY));
    return isRoundSize(n) ? n : DEFAULT_ROUND;
  } catch {
    return DEFAULT_ROUND;
  }
}
export function saveRoundSize(n: RoundSize) {
  try { localStorage.setItem(COUNT_KEY, String(n)); } catch { /* storage blocked */ }
}

/** Start a new round at `level` (of `count` sentences) and open it. Returns `start`, `starting` and an error message. */
export function useStartRound() {
  const router = useRouter();
  const { dict, locale } = useI18n();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (level: string, count: RoundSize = loadRoundSize()) => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/translation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, locale, count }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.code === "DAILY_LIMIT" ? dict.translation.limitReached : dict.translation.error);
      router.push(`/translation/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.translation.error);
      setStarting(false);
    }
  };

  return { start, starting, error };
}

/** The correction of one sentence: answer, fixed version, the rule, a more natural option. */
export function ResultDetail({ result }: { result: TranslationResult }) {
  const { dict } = useI18n();
  const tr = dict.translation;
  const changed = result.corrected.trim() !== result.answer.trim();
  return (
    <div className="space-y-3">
      <Row label={tr.yourAnswer}>
        <span className={result.verdict === "correct" ? "text-ink" : "text-ink-soft"}>{result.answer}</span>
      </Row>
      {changed && result.verdict !== "correct" && (
        <Row label={tr.corrected}><span className="font-medium text-ink">{result.corrected}</span></Row>
      )}
      {result.note && <p className="border-l-2 border-pen pl-3 text-sm leading-relaxed text-ink">{result.note}</p>}
      {result.natural && (
        <Row label={tr.natural}><span className="italic text-ink">{result.natural}</span></Row>
      )}
      {!!result.hints && <p className="text-xs text-ink-soft">{tr.withHint}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed">
      <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{label}</span>
      {children}
    </p>
  );
}
