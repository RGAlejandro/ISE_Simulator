"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Copy, Loader2, Sparkles, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { BandChip, VIZ } from "@/components/readiness/readiness-parts";
import { ASSIGNMENT_KINDS } from "@/lib/teams";
import type { TeamDashboard, TeamMemberRow } from "@/lib/teams-server";
import type { TeamLessonContent } from "@/lib/prompts/team-lesson";
import { cn } from "@/lib/utils";

// ─── Invite ─────────────────────────────────────────────────────────────────

export function InviteCard({ joinCode }: { joinCode: string }) {
  const { dict } = useI18n();
  const [copied, setCopied] = useState(false);
  // Origin only exists in the browser; the server snapshot keeps hydration consistent.
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const url = `${origin}/teams/join/${joinCode}`;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 truncate rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">{url}</code>
      <Button
        variant="outline"
        className="gap-2"
        onClick={async () => {
          await navigator.clipboard.writeText(url).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? dict.teams.copied : dict.teams.copy}
      </Button>
    </div>
  );
}

// ─── Students table ─────────────────────────────────────────────────────────

type SortKey = "name" | "pPass" | "trend" | "last" | "week";
type SortState = { key: SortKey; dir: 1 | -1 };

function SortHeader({ k, sort, onSort, children, className }: { k: SortKey; sort: SortState; onSort: (k: SortKey) => void; children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-2 py-2 font-medium", className)} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
        {children}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

export function MembersTable({ orgId, members, isAdmin = false }: { orgId: string; members: TeamMemberRow[]; isAdmin?: boolean }) {
  const { dict, t, locale } = useI18n();
  const tm = dict.teams;
  const [sort, setSort] = useState<SortState>({ key: "pPass", dir: 1 });
  const onSort = (k: SortKey) => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : k === "name" ? 1 : -1 }));
  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }), [locale]);

  const rows = useMemo(() => {
    const val = (m: TeamMemberRow): number | string => {
      switch (sort.key) {
        case "name": return m.name.toLowerCase();
        case "pPass": return m.observations ? m.pPass : -1;
        case "trend": return m.trendPerWeek ?? -99;
        case "last": return m.lastAt ? new Date(m.lastAt).getTime() : 0;
        case "week": return m.attempts7d;
      }
    };
    return [...members].sort((a, b) => (val(a) < val(b) ? -sort.dir : val(a) > val(b) ? sort.dir : 0));
  }, [members, sort]);

  if (members.length === 0) return <p className="text-sm text-zinc-500 dark:text-zinc-400">{tm.noStudents}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500">
            <SortHeader k="name" sort={sort} onSort={onSort}>{tm.colStudent}</SortHeader>
            <SortHeader k="pPass" sort={sort} onSort={onSort}>{tm.colChance}</SortHeader>
            <th className="px-2 py-2 font-medium">{tm.colBand}</th>
            <th className="px-2 py-2 font-medium">{tm.colWeakest}</th>
            <SortHeader k="trend" sort={sort} onSort={onSort}>{tm.colTrend}</SortHeader>
            <SortHeader k="last" sort={sort} onSort={onSort}>{tm.colLast}</SortHeader>
            <SortHeader k="week" sort={sort} onSort={onSort} className="text-right">{tm.colWeek}</SortHeader>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const p = Math.round(m.pPass * 100);
            const trend = m.trendPerWeek === null ? null : Math.round(m.trendPerWeek * 100);
            return (
              <tr key={m.userId} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40">
                <td className="px-2 py-2.5">
                  <Link href={`/teams/${orgId}/members/${m.userId}`} className="font-medium text-ink underline-offset-2 hover:underline">
                    {m.name}
                  </Link>
                  {isAdmin && (
                    <Link href={`/admin/users/${m.userId}`} className="mt-0.5 block w-fit whitespace-nowrap text-[11px] text-ink-soft underline decoration-marker decoration-2 underline-offset-2 hover:text-ink">
                      {dict.adminProfile.viewProfile}
                    </Link>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  {m.observations ? (
                    <div className="flex items-center gap-2">
                      <div className={cn("h-1.5 w-20 rounded-full", VIZ.track)}>
                        <div className={cn("h-full rounded-full", VIZ.fill)} style={{ width: `${p}%` }} />
                      </div>
                      <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{p}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">{tm.never}</span>
                  )}
                </td>
                <td className="px-2 py-2.5">{m.observations ? <BandChip band={m.band} /> : "—"}</td>
                <td className="px-2 py-2.5 text-zinc-700 dark:text-zinc-300">{m.observations && m.limitingSkill ? dict.readiness.skill[m.limitingSkill] : "—"}</td>
                <td className="px-2 py-2.5">
                  {trend === null || trend === 0 ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 tabular-nums text-zinc-800 dark:text-zinc-200">
                      {trend > 0 ? <TrendingUp className="h-3.5 w-3.5 text-[#0ca30c]" /> : <TrendingDown className="h-3.5 w-3.5 text-[#d03b3b]" />}
                      {trend > 0 ? "+" : ""}
                      {trend}
                      <span className="text-xs text-zinc-500">{tm.perWeek}</span>
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-zinc-600 dark:text-zinc-400">{m.lastAt ? fmt.format(new Date(m.lastAt)) : tm.never}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">{m.attempts7d ? t("teams.attemptsWeek", { n: m.attempts7d }) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Assignments ────────────────────────────────────────────────────────────

export function AssignmentsPanel({ orgId, assignments }: { orgId: string; assignments: TeamDashboard["assignments"] }) {
  const { dict, t, locale } = useI18n();
  const tm = dict.teams;
  const router = useRouter();
  const [kind, setKind] = useState<(typeof ASSIGNMENT_KINDS)[number]>("WRITING");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/teams/${orgId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, title: title.trim() || tm.assignKind[kind], dueDate: due }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Error");
    setTitle("");
    router.refresh();
  };

  const remove = async (id: string) => {
    await fetch(`/api/teams/${orgId}/assignments/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="space-y-1 text-xs text-zinc-500">
          {tm.assignKindLabel}
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="block w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
            {ASSIGNMENT_KINDS.map((k) => (
              <option key={k} value={k}>{tm.assignKind[k]}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          {tm.assignTitleLabel}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={tm.assignKind[kind]} className="block w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          {tm.assignDue}
          <input type="date" value={due} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDue(e.target.value)} className="block rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </label>
        <Button type="submit" disabled={busy} className="gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {tm.assignCreate}
        </Button>
      </form>
      {error && <p className="text-sm text-[#d03b3b]">{error}</p>}

      {assignments.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{tm.assignEmpty}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {assignments.map((a) => {
            const share = a.total ? a.done / a.total : 0;
            return (
              <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_6rem_auto]">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{a.title}</p>
                  <p className="text-xs text-zinc-500">
                    {tm.assignKind[a.kind]} · {a.overdue ? t("teams.assignClosed", { date: fmt.format(new Date(a.dueAt)) }) : t("teams.assignDueOn", { date: fmt.format(new Date(a.dueAt)) })}
                  </p>
                </div>
                <div className={cn("order-last col-span-2 h-2 rounded-full sm:order-none sm:col-span-1", VIZ.track)} role="meter" aria-valuemin={0} aria-valuemax={a.total} aria-valuenow={a.done}>
                  <div className={cn("h-full rounded-full", VIZ.fill)} style={{ width: `${Math.round(share * 100)}%` }} />
                </div>
                <span className="text-right text-sm tabular-nums text-zinc-800 dark:text-zinc-200">{t("teams.assignDone", { done: a.done, total: a.total })}</span>
                <button type="button" onClick={() => remove(a.id)} className="hidden justify-self-end rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 sm:block dark:hover:bg-zinc-800" aria-label={tm.assignDelete}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── AI mini-lesson ─────────────────────────────────────────────────────────

export function LessonPanel({ orgId, lesson: initial }: { orgId: string; lesson: TeamDashboard["lesson"] }) {
  const { dict, t } = useI18n();
  const tm = dict.teams;
  const [lesson, setLesson] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState(false);
  const c = lesson?.content as TeamLessonContent | undefined;
  const focus = lesson?.focus as { criteria?: { label: string }[]; errors?: { tag: string }[] } | undefined;

  const generate = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/teams/${orgId}/lesson`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Error");
    setLesson({ id: data.id, createdAt: data.createdAt, content: data.content, focus: data.focus });
    setAnswers(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={generate} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? tm.lessonGenerating : c ? tm.lessonRegenerate : tm.lessonGenerate}
        </Button>
        {error && <p className="text-sm text-[#d03b3b]">{error}</p>}
      </div>

      {!c ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{tm.lessonEmpty}</p>
      ) : (
        <article className={cn("space-y-5 border-y-2 border-ink py-5", busy && "opacity-60")}>
          <header className="space-y-1">
            <p className="text-xs text-zinc-500">
              {t("teams.lessonMinutes", { n: c.minutes })}
              {focus && (
                <>
                  {" · "}
                  {tm.lessonFocus}:{" "}
                  {[...(focus.criteria ?? []).map((x) => x.label), ...(focus.errors ?? []).map((x) => dict.writing.tags[x.tag as keyof typeof dict.writing.tags] ?? x.tag)].join(", ")}
                </>
              )}
            </p>
            <h3 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">{c.title}</h3>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">{tm.lessonObjective}: </span>
              {c.objective}
            </p>
          </header>

          <section>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{tm.lessonWarmUp}</h4>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{c.warmUp}</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{tm.lessonPoints}</h4>
            {c.points.map((p, i) => (
              <div key={i} className="rounded-xl bg-white p-3 text-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.point}</p>
                <dl className="mt-2 grid gap-1 sm:grid-cols-[7rem_1fr]">
                  <dt className="text-zinc-500">{tm.lessonExample}</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">{p.example}</dd>
                  <dt className="text-zinc-500">{tm.lessonMistake}</dt>
                  <dd className="text-zinc-800 line-through decoration-[#d03b3b]/60 dark:text-zinc-200">{p.mistake}</dd>
                  <dt className="text-zinc-500">{tm.lessonFix}</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">{p.fix}</dd>
                </dl>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{tm.lessonExercise}</h4>
              <button type="button" onClick={() => setAnswers((v) => !v)} className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400">
                {answers ? tm.lessonHideAnswers : tm.lessonAnswers}
              </button>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{c.exercise.instruction}</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
              {c.exercise.items.map((it, i) => (
                <li key={i}>
                  {it.prompt}
                  {answers && <span className="ml-2 font-medium text-[#006300] dark:text-[#0ca30c]">→ {it.answer}</span>}
                </li>
              ))}
            </ol>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{tm.lessonSpeaking}</h4>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{c.speakingTask}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{tm.lessonHomework}</h4>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{c.homework}</p>
            </div>
          </section>
        </article>
      )}
    </div>
  );
}
