"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { EXAM_LEVELS } from "@/lib/constants";

interface Team {
  id: string;
  name: string;
  level: string;
  role: "OWNER" | "TEACHER" | "STUDENT";
  students: number;
}

interface Props {
  userId: string;
  levels: { value: string; label: string }[];
  defaultLevel: string;
  teams: Team[];
}

export function TeamsClient({ userId, levels, defaultLevel, teams }: Props) {
  const { dict, t } = useI18n();
  const tm = dict.teams;
  const router = useRouter();
  const [name, setName] = useState("");
  const [level, setLevel] = useState(defaultLevel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teaching = teams.filter((x) => x.role !== "STUDENT");
  const learning = teams.filter((x) => x.role === "STUDENT");
  const levelLabel = (v: string) => {
    const l = EXAM_LEVELS.find((x) => x.value === v);
    return l ? `${l.label} (${l.cefr})` : v;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, level }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Error");
    }
    router.push(`/teams/${data.id}`);
  };

  const leave = async (orgId: string) => {
    if (!window.confirm(tm.leaveConfirm)) return;
    await fetch(`/api/teams/${orgId}/members/${userId}`, { method: "DELETE" });
    router.refresh();
  };

  const TeamCard = ({ team }: { team: Team }) => (
    <li className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{team.name}</p>
        <p className="text-sm text-zinc-500">
          {levelLabel(team.level)} · {tm.role[team.role]}
          {team.role !== "STUDENT" && ` · ${team.students === 1 ? tm.studentsOne : t("teams.studentsCount", { n: team.students })}`}
        </p>
      </div>
      {team.role === "STUDENT" ? (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => leave(team.id)}>
          <LogOut className="h-3.5 w-3.5" /> {tm.leave}
        </Button>
      ) : (
        <Button asChild size="sm" className="gap-1.5">
          <Link href={`/teams/${team.id}`}>
            {tm.open} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      )}
    </li>
  );

  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        <header className="max-w-2xl space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Users className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {tm.title} <span className="marker-underline italic">{tm.titleAccent}</span>
          </h1>
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">{tm.subtitle}</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">{tm.teaching}</h2>
              {teaching.length === 0 ? <p className="text-sm text-zinc-500">{tm.none}</p> : <ul className="space-y-3">{teaching.map((x) => <TeamCard key={x.id} team={x} />)}</ul>}
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">{tm.memberOf}</h2>
              {learning.length === 0 ? <p className="text-sm text-zinc-500">{tm.joinHint}</p> : <ul className="space-y-3">{learning.map((x) => <TeamCard key={x.id} team={x} />)}</ul>}
            </section>
          </div>

          <form onSubmit={create} className="h-fit space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">{tm.createTitle}</h2>
            <label className="block space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {tm.nameLabel}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                placeholder={tm.namePlaceholder}
                className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="block space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {tm.levelLabel}
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                {levels.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </label>
            {error && <p className="text-sm text-[#d03b3b]">{error}</p>}
            <Button type="submit" disabled={busy || name.trim().length < 2} className="w-full gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? tm.creating : tm.create}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
