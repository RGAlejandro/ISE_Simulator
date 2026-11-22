"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotebookHeader, NotebookPage, Section } from "@/components/notebook/notebook";
import { useI18n } from "@/components/i18n/language-provider";
import { LevelPicker } from "@/components/practice/level-picker";
import { useStartRound } from "@/components/translation/translation-parts";
import { BandStamp } from "@/components/results/results-parts";
import { EXAM_LEVELS } from "@/lib/constants";
import { TRANSLATION_ROUND } from "@/lib/translation";

interface Round {
  id: string;
  level: string;
  total: number;
  done: number;
  score: number | null;
  completed: boolean;
  createdAt: string;
}

export function TranslationHomeClient({ isPro, canStart, defaultLevel, rounds }: {
  isPro: boolean;
  canStart: boolean;
  defaultLevel: string | null;
  rounds: Round[];
}) {
  const { dict, t, locale } = useI18n();
  const tr = dict.translation;
  const [level, setLevel] = useState<string>(defaultLevel ?? "ISE_II");
  const { start, starting, error } = useStartRound();
  const levelLabel = (v: string) => EXAM_LEVELS.find((l) => l.value === v)?.label ?? v;

  return (
    <div className="flex-1 bg-paper">
      <NotebookPage className="pb-16">
        <NotebookHeader title={tr.title} subtitle={tr.subtitle} />

        <Section n={1} title={tr.start}>
          <div className="max-w-2xl space-y-5">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{tr.level}</p>
              <LevelPicker value={level} onChange={setLevel} />
            </div>
            {canStart ? (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Button size="lg" onClick={() => start(level)} disabled={starting}>
                  {starting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tr.starting}</> : tr.start}
                </Button>
                <span className="text-sm text-ink-soft">{t("translation.roundInfo", { n: TRANSLATION_ROUND })}</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-hand text-xl leading-snug text-pen">{tr.limitReached}</p>
                {!isPro && (
                  <Button asChild size="sm"><Link href="/pricing">{tr.upgrade}</Link></Button>
                )}
              </div>
            )}
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-pen" role="alert">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
          </div>
        </Section>

        <Section n={2} title={tr.historyTitle}>
          {rounds.length === 0 ? (
            <p className="text-sm text-ink-soft">{tr.historyEmpty}</p>
          ) : (
            <ul className="max-w-2xl divide-y divide-rule border-y border-rule">
              {rounds.map((r) => (
                <li key={r.id}>
                  <Link href={`/translation/${r.id}`} className="group flex items-center gap-4 py-3">
                    <span className="w-24 shrink-0 text-sm tabular-nums text-ink-soft">
                      {new Date(r.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-medium text-ink group-hover:underline decoration-marker decoration-4 underline-offset-2">
                      {levelLabel(r.level)}
                    </span>
                    {r.completed && r.score != null ? (
                      <span className="flex items-center gap-3">
                        <BandStamp pct={r.score} />
                        <span className="w-12 text-right font-display text-lg font-semibold tabular-nums text-ink">{r.score}{" "}%</span>
                      </span>
                    ) : (
                      <span className="font-hand text-lg text-pen">{t("translation.inProgress", { n: r.done, total: r.total })}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </NotebookPage>
    </div>
  );
}
