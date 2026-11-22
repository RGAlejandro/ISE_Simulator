"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Database, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { MAX_LIST_NAME, type TutorAction, type TutorDataKey } from "@/lib/tutor";

/** "Looked at: Readiness · Writing mistakes" — what the tutor based its answer on. */
export function UsedDataChips({ keys }: { keys: TutorDataKey[] }) {
  const { dict } = useI18n();
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
      <Database className="h-3 w-3" aria-hidden />
      <span>{dict.chat.usedData.label}:</span>
      {keys.map((k) => (
        <span key={k} className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60 px-2 py-0.5">
          {dict.chat.usedData[k]}
        </span>
      ))}
    </div>
  );
}

export function PracticeAction({ action }: { action: Extract<TutorAction, { type: "practice" }> }) {
  return (
    <Link
      href={action.href}
      className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 transition-colors"
    >
      {action.label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

type ListResult = { listId: string; added: number; skipped: number };

/** Proposed word list: the learner reviews, renames and confirms before anything is saved. */
export function VocabListAction({ action }: { action: Extract<TutorAction, { type: "create_vocab_list" }> }) {
  const { t, dict } = useI18n();
  const nameId = useId();
  const [name, setName] = useState(action.name);
  const [selected, setSelected] = useState<boolean[]>(() => action.words.map(() => true));
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ListResult | null>(null);

  const count = selected.filter(Boolean).length;

  async function create() {
    if (count === 0) {
      setError(dict.chat.list.needOne);
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/vocabulary/lists/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || action.name, words: action.words.filter((_, i) => selected[i]) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.list) throw new Error(data.error);
      setResult({ listId: data.list.id, added: data.added ?? 0, skipped: Array.isArray(data.skipped) ? data.skipped.length : 0 });
      setStatus("idle");
    } catch {
      setStatus("error");
      setError(dict.chat.list.failed);
    }
  }

  if (result) {
    return (
      <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <Check className="h-4 w-4" />
          {t("chat.list.created", { n: result.added })}
        </p>
        {result.skipped > 0 && (
          <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">{t("chat.list.skipped", { n: result.skipped })}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/vocabulary/study/${result.listId}`}>
            <Button size="sm" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" />{dict.chat.list.study}</Button>
          </Link>
          <Link href="/vocabulary/saved">
            <Button size="sm" variant="outline">{dict.chat.list.open}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-4 pt-3 pb-2 space-y-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
          <Sparkles className="h-3.5 w-3.5" />
          {dict.chat.list.badge}
        </p>
        <label className="block">
          <span className="sr-only">{dict.chat.list.nameLabel}</span>
          <input
            id={nameId}
            value={name}
            maxLength={MAX_LIST_NAME}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </label>
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{t("chat.list.selected", { n: count, total: action.words.length })}</span>
          <span className="flex gap-3">
            <button type="button" className="hover:text-brand" onClick={() => setSelected(action.words.map(() => true))}>{dict.chat.list.all}</button>
            <button type="button" className="hover:text-brand" onClick={() => setSelected(action.words.map(() => false))}>{dict.chat.list.none}</button>
          </span>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto border-t border-zinc-100 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr><th /><th>{dict.chat.list.colEnglish}</th><th>{dict.chat.list.colSpanish}</th><th>{dict.chat.list.colLevel}</th></tr>
          </thead>
          <tbody>
            {action.words.map((w, i) => (
              <tr
                key={w.english}
                onClick={() => setSelected((s) => s.map((v, j) => (j === i ? !v : v)))}
                className={cn("cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0", !selected[i] && "opacity-45")}
              >
                <td className="w-8 pl-4 py-2 align-top">
                  <input
                    type="checkbox"
                    checked={selected[i]}
                    onChange={() => setSelected((s) => s.map((v, j) => (j === i ? !v : v)))}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={w.english}
                    className="mt-0.5 h-4 w-4 accent-brand"
                  />
                </td>
                <td className="py-2 pr-2 align-top">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{w.english}</span>
                  {w.example && <span className="block text-xs text-zinc-500 dark:text-zinc-400 leading-snug">{w.example}</span>}
                </td>
                <td className="py-2 pr-2 align-top text-zinc-700 dark:text-zinc-300">{w.spanish}</td>
                <td className="py-2 pr-4 align-top text-right">
                  <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 tabular-nums">{w.level}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800 px-4 py-2.5">
        <p className="text-xs text-red-600 dark:text-red-400 min-h-4" role="alert">{error}</p>
        <Button size="sm" onClick={create} disabled={status === "saving"} className="gap-1.5 shrink-0">
          {status === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{dict.chat.list.creating}</> : t("chat.list.create", { n: count })}
        </Button>
      </div>
    </div>
  );
}
