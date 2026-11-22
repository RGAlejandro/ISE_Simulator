"use client";

import { useState } from "react";
import { ArrowRight, Bookmark, BookmarkCheck, Camera, Check, CheckCircle2, Clock, Copy, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toaster";
import { useI18n } from "@/components/i18n/language-provider";
import { AnnotatedText, type AnnotationRef } from "./annotated-text";
import { SourceTexts } from "./source-texts";
import { CRITERIA_FOR_TASK, bandFromScore, type WritingBand } from "@/lib/writing";
import { cn } from "@/lib/utils";
import type { WritingDraftData, WritingTaskContent, WritingTaskType } from "@/types";

export const BAND_STYLES: Record<WritingBand, string> = {
  distinction: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  merit: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  pass: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  below: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

interface Props {
  draft: WritingDraftData;
  previous: WritingDraftData | null;
  taskType: WritingTaskType;
  task: WritingTaskContent;
  cefr: string;
}

export function FeedbackView({ draft, previous, taskType, task, cefr }: Props) {
  const { dict, t } = useI18n();
  const w = dict.writing;
  const { show } = useToast();
  const fb = draft.feedback;
  const band = bandFromScore(draft.score);

  const [selected, setSelected] = useState<AnnotationRef | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tagLabel = (tag: string) => w.tags[tag as keyof typeof w.tags] ?? tag;

  const select = (ref: AnnotationRef, scrollTo: "list" | "text") => {
    setSelected(ref);
    const id = scrollTo === "list" ? `item-${ref.kind}-${ref.index}` : `ann-${ref.kind}-${ref.index}`;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const saveUpgrade = async (upgradeIndex: number, suggestionIndex: number) => {
    const key = `${upgradeIndex}-${suggestionIndex}`;
    if (saved.has(key) || saving) return;
    setSaving(key);
    try {
      const res = await fetch("/api/writing/upgrades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, upgradeIndex, suggestionIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved((prev) => new Set(prev).add(key));
      show(t("writing.savedTo", { list: data.list.name }), "success");
    } catch {
      show(w.saveError, "error");
    } finally {
      setSaving(null);
    }
  };

  const copyImproved = async () => {
    try {
      await navigator.clipboard.writeText(fb.improvedVersion);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — nothing to do */
    }
  };

  return (
    <div className="space-y-5">
      {/* Score */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,14rem)_1fr]">
          <div className="flex lg:flex-col items-center lg:items-start gap-4">
            <div className={cn("flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl", BAND_STYLES[band])}>
              <span className="text-2xl font-bold tabular-nums">{draft.score.toFixed(1)}</span>
              <span className="text-[10px] font-medium opacity-80">/ 4</span>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{w.estimatedBand}</p>
              <p className="font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{w.bands[band]}</p>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
                <Badge variant="outline">{t("writing.version", { n: draft.version })}</Badge>
                <Badge variant="outline">{t("writing.wordCount", { n: draft.wordCount })}</Badge>
                {draft.secondsUsed !== null && draft.secondsUsed >= 60 && (
                  <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{t("writing.minutesUsed", { n: Math.round(draft.secondsUsed / 60) })}</Badge>
                )}
                {draft.source === "photo" && <Badge variant="outline" className="gap-1"><Camera className="h-3 w-3" />{w.fromPhoto}</Badge>}
              </div>
            </div>
          </div>

          <ul className="space-y-4">
            {CRITERIA_FOR_TASK[taskType].map((key) => {
              const c = fb.criteria[key];
              if (!c) return null;
              const prev = previous?.feedback.criteria[key]?.score;
              const delta = prev === undefined ? null : c.score - prev;
              return (
                <li key={key} className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{w.criteria[key]}</span>
                    {delta !== null && delta !== 0 && (
                      <span className={cn("text-xs font-semibold tabular-nums", delta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                    <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{c.score}/4</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1" aria-hidden>
                    {[1, 2, 3, 4].map((n) => (
                      <span
                        key={n}
                        className={cn(
                          "h-1.5 rounded-full",
                          n <= c.score
                            ? c.score >= 3 ? "bg-blue-600 dark:bg-blue-500" : c.score === 2 ? "bg-green-500" : "bg-red-500"
                            : "bg-zinc-200 dark:bg-zinc-800",
                        )}
                      />
                    ))}
                  </div>
                  {c.comment && <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{c.comment}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Summary */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-3 rounded-2xl border border-blue-200/70 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">{w.summaryTitle}</p>
          <p className="mt-1.5 leading-relaxed text-zinc-800 dark:text-zinc-200">{fb.summary}</p>
        </div>
        {fb.strengths.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">{w.strengthsTitle}</p>
            <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {fb.strengths.map((s) => (
                <li key={s} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />{s}</li>
              ))}
            </ul>
          </div>
        )}
        {fb.nextSteps.length > 0 && (
          <div className={cn("rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5", fb.strengths.length > 0 ? "md:col-span-2" : "md:col-span-3")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">{w.nextStepsTitle}</p>
            <ol className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {fb.nextSteps.map((s, i) => (
                <li key={s} className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-[11px] font-bold text-blue-700 dark:text-blue-300">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* Detail tabs */}
      <Tabs defaultValue="corrections" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="corrections" className="gap-1.5">
            {w.tabCorrections} <span className="rounded-full bg-red-100 dark:bg-red-950 px-1.5 text-[10px] font-bold text-red-700 dark:text-red-300">{fb.issues.length}</span>
          </TabsTrigger>
          <TabsTrigger value="upgrades" className="gap-1.5">
            {w.tabUpgrades} <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">{fb.upgrades.length}</span>
          </TabsTrigger>
          {fb.improvedVersion && <TabsTrigger value="improved">{w.tabImproved}</TabsTrigger>}
          <TabsTrigger value="task">{w.tabTask}</TabsTrigger>
        </TabsList>

        <TabsContent value="corrections" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7">
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span>{w.correctionsHint}</span>
                <span className="inline-flex items-center gap-1.5"><span className="underline decoration-wavy decoration-red-500 decoration-2 underline-offset-4">abc</span>{w.legendError}</span>
                <span className="inline-flex items-center gap-1.5"><span className="underline decoration-dotted decoration-amber-500 decoration-2 underline-offset-4">abc</span>{w.legendUpgrade}</span>
              </div>
              <AnnotatedText
                text={draft.text}
                issues={fb.issues}
                upgrades={fb.upgrades}
                selected={selected}
                onSelect={(ref) => select(ref, "list")}
              />
            </div>

            <div className="lg:col-span-2 space-y-2 lg:max-h-[42rem] lg:overflow-y-auto lg:pr-1">
              {fb.issues.length === 0 && (
                <p className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 p-4 text-sm text-green-800 dark:text-green-300">{w.noIssues}</p>
              )}
              {fb.issues.map((issue, i) => {
                const isSel = selected?.kind === "issue" && selected.index === i;
                return (
                  <button
                    key={`${issue.start}-${i}`}
                    id={`item-issue-${i}`}
                    type="button"
                    onClick={() => select({ kind: "issue", index: i }, "text")}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      isSel
                        ? "border-red-300 bg-red-50/80 dark:border-red-800 dark:bg-red-950/40"
                        : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700",
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{w.categories[issue.category]}</Badge>
                      {tagLabel(issue.tag) !== w.categories[issue.category] && (
                        <span className="text-[10px] text-zinc-400">{tagLabel(issue.tag)}</span>
                      )}
                    </div>
                    <p className="font-serif text-sm leading-snug">
                      <span className="text-red-600 line-through decoration-red-400 dark:text-red-400">{issue.quote}</span>
                      <ArrowRight className="mx-1.5 inline h-3 w-3 text-zinc-400" />
                      <span className="font-semibold text-green-700 dark:text-green-400">{issue.correction}</span>
                    </p>
                    {(isSel || fb.issues.length <= 6) && issue.explanation && (
                      <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{issue.explanation}</p>
                    )}
                  </button>
                );
              })}
              {selected?.kind === "upgrade" && fb.upgrades[selected.index] && (
                <div id={`item-upgrade-${selected.index}`} className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 p-3 text-sm">
                  <p className="text-xs text-amber-800 dark:text-amber-300">{w.instead} <span className="font-serif font-semibold">“{fb.upgrades[selected.index].quote}”</span></p>
                  <p className="mt-1 font-serif font-semibold text-zinc-900 dark:text-zinc-100">
                    {fb.upgrades[selected.index].suggestions.map((s) => s.text).join(" · ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="upgrades" className="mt-0 space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{w.upgradesHint}</p>
          {fb.upgrades.length === 0 && <p className="text-sm text-zinc-500">{w.upgradesEmpty}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {fb.upgrades.map((u, ui) => (
              <div key={`${u.start}-${ui}`} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
                <p className="text-xs text-zinc-500">
                  {w.instead} <span className="font-serif text-sm text-zinc-700 dark:text-zinc-300 line-through decoration-amber-500">“{u.quote}”</span>
                </p>
                <ul className="space-y-1.5">
                  {u.suggestions.map((s, si) => {
                    const key = `${ui}-${si}`;
                    const isSaved = saved.has(key);
                    return (
                      <li key={s.text} className="flex items-center gap-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 px-3 py-2">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="min-w-0 flex-1">
                          <span className="font-serif font-semibold text-zinc-900 dark:text-zinc-100">{s.text}</span>
                          {s.translation && <span className="ml-1.5 text-xs text-zinc-500">· {s.translation}</span>}
                        </span>
                        <Button
                          size="sm"
                          variant={isSaved ? "secondary" : "outline"}
                          className="h-7 gap-1 px-2 text-[11px]"
                          disabled={isSaved || saving !== null}
                          onClick={() => saveUpgrade(ui, si)}
                        >
                          {saving === key ? <Loader2 className="h-3 w-3 animate-spin" /> : isSaved ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                          {isSaved ? w.savedWord : w.saveWord}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                {u.example && <p className="font-serif text-sm italic leading-relaxed text-zinc-700 dark:text-zinc-300">“{u.example}”</p>}
                {u.note && <p className="text-xs leading-relaxed text-zinc-500">{u.note}</p>}
              </div>
            ))}
          </div>
        </TabsContent>

        {fb.improvedVersion && (
          <TabsContent value="improved" className="mt-0">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-prose">{t("writing.improvedHint", { cefr })}</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={copyImproved}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? w.copied : w.copy}
                </Button>
              </div>
              <div className="whitespace-pre-wrap font-serif text-[15px] sm:text-base leading-8 text-zinc-800 dark:text-zinc-200">{fb.improvedVersion}</div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="task" className="mt-0 space-y-4">
          <TaskCard task={task} />
          {task.sources && <SourceTexts sources={task.sources} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function TaskCard({ task, className }: { task: WritingTaskContent; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3", className)}>
      <p className="font-serif leading-relaxed text-zinc-800 dark:text-zinc-200">{task.prompt}</p>
      <ul className="space-y-1.5">
        {task.bulletPoints.map((b) => (
          <li key={b} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            {b}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Badge variant="outline">{t("writing.wordsRange", { min: task.wordLimit.min, max: task.wordLimit.max })}</Badge>
        <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{t("writing.suggestedTime", { n: task.minutes })}</Badge>
      </div>
    </div>
  );
}
