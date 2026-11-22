"use client";

import { useId, useImperativeHandle, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Database, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { MAX_LIST_NAME, type TutorAction, type TutorDataKey } from "@/lib/tutor";
import { EXAM_LEVELS } from "@/lib/constants";

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

type ListResult = { listId: string; name: string; added: number; skipped: number };
type ListAction = Extract<TutorAction, { type: "create_vocab_list" }>;
type ListHandle = { create: () => Promise<void> };

/**
 * Several proposed lists (e.g. one per photo): each card can be edited and
 * created on its own, or all at once with the button on top.
 */
export function VocabListGroup({ actions }: { actions: ListAction[] }) {
  const { t, dict } = useI18n();
  const handles = useRef<(ListHandle | null)[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const total = actions.reduce((n, a) => n + a.words.length, 0);

  async function createAll() {
    setState("saving");
    for (const h of handles.current) await h?.create();
    setState("done");
  }

  if (actions.length === 1) return <VocabListAction action={actions[0]} />;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("chat.list.groupInfo", { n: actions.length, words: total })}</p>
        {state !== "done" && (
          <Button size="sm" onClick={createAll} disabled={state === "saving"} className="gap-1.5">
            {state === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{dict.chat.list.creating}</> : t("chat.list.createAll", { n: actions.length })}
          </Button>
        )}
      </div>
      {actions.map((a, i) => (
        <VocabListAction key={`${i}-${a.name}`} action={a} ref={(h) => { handles.current[i] = h; }} />
      ))}
    </div>
  );
}

/** Proposed word list: the learner reviews, renames and confirms before anything is saved. */
export function VocabListAction({ action, ref }: { action: ListAction; ref?: React.Ref<ListHandle> }) {
  const { t, dict } = useI18n();
  const nameId = useId();
  const [name, setName] = useState(action.name);
  const [selected, setSelected] = useState<boolean[]>(() => action.words.map(() => true));
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ListResult | null>(null);

  const count = selected.filter(Boolean).length;

  async function create() {
    if (result || status === "saving") return;
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
      setResult({ listId: data.list.id, name: name.trim() || action.name, added: data.added ?? 0, skipped: Array.isArray(data.skipped) ? data.skipped.length : 0 });
      setStatus("idle");
    } catch {
      setStatus("error");
      setError(dict.chat.list.failed);
    }
  }

  useImperativeHandle(ref, () => ({ create }));

  if (result) {
    return (
      <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <Check className="h-4 w-4" />
          {t("chat.list.createdNamed", { name: result.name, n: result.added })}
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
    <div className="overflow-hidden border-y-2 border-ink bg-paper">
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

/** Proposed change of exam goal (module, target band, level, date): saved only when the learner confirms. */
export function SetGoalAction({ action }: { action: Extract<TutorAction, { type: "set_goal" }> }) {
  const { dict, locale } = useI18n();
  const g = dict.goal;
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const rows: [string, string][] = [];
  if (action.examModules) rows.push([g.card.modules, g.modules[action.examModules]]);
  if (action.targetBand) rows.push([g.card.target, g.targets[action.targetBand]]);
  if (action.examLevel) {
    const l = EXAM_LEVELS.find((x) => x.value === action.examLevel);
    rows.push([g.card.level, l ? `${l.label} (${l.cefr})` : action.examLevel]);
  }
  if (action.examDate) rows.push([g.card.date, new Date(`${action.examDate}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })]);

  async function save() {
    setStatus("saving");
    try {
      const { type: _type, ...goal } = action;
      void _type;
      const res = await fetch("/api/user/exam-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goal),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="border-y-2 border-ink bg-paper px-4 py-3 space-y-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
        <Sparkles className="h-3.5 w-3.5" /> {g.card.badge}
      </p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2 text-sm">
            <dt className="shrink-0 text-ink-soft">{k}</dt>
            <span aria-hidden className="min-w-6 flex-1 -translate-y-1 border-b-2 border-dotted border-rule" />
            <dd className="shrink-0 font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {status === "saved" ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> {g.card.saved}
          <Link href="/dashboard" className="ml-2 font-normal text-ink underline decoration-marker decoration-2 underline-offset-2">{dict.nav.dashboard}</Link>
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-pen" role="alert">{status === "error" ? g.card.failed : ""}</p>
          <Button size="sm" onClick={save} disabled={status === "saving"} className="gap-1.5 shrink-0">
            {status === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{g.card.saving}</> : g.card.save}
          </Button>
        </div>
      )}
    </div>
  );
}
