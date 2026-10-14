"use client";

import { useState } from "react";
import { UserPlus, FileText, Mic, Volume2, BookOpen, Bookmark } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";

type Kind = "signup" | "written" | "oral" | "listening" | "grammar" | "vocab";

interface Event {
  kind: Kind;
  id: string;
  createdAt: string;
  user: { email: string; name: string | null };
  meta: Record<string, unknown>;
}

interface Props {
  events: Event[];
}

const LEVEL_LABELS: Record<string, string> = {
  ISE_FOUNDATION: "ISE Foundation",
  ISE_I: "ISE I",
  ISE_II: "ISE II",
  ISE_III: "ISE III",
  ISE_IV: "ISE IV",
};

const KIND_META: Record<Kind, { label: string; Icon: typeof FileText; color: string; bg: string }> = {
  signup:    { label: "Signups",   Icon: UserPlus, color: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  written:   { label: "Written",   Icon: FileText, color: "text-blue-600 dark:text-blue-300",       bg: "bg-blue-50 dark:bg-blue-950/40"       },
  oral:      { label: "Oral",      Icon: Mic,      color: "text-rose-600 dark:text-rose-300",       bg: "bg-rose-50 dark:bg-rose-950/40"       },
  listening: { label: "Listening", Icon: Volume2,  color: "text-purple-600 dark:text-purple-300",   bg: "bg-purple-50 dark:bg-purple-950/40"   },
  grammar:   { label: "Grammar",   Icon: BookOpen, color: "text-green-600 dark:text-green-300",     bg: "bg-green-50 dark:bg-green-950/40"     },
  vocab:     { label: "Vocab",     Icon: Bookmark, color: "text-amber-600 dark:text-amber-300",     bg: "bg-amber-50 dark:bg-amber-950/40"     },
};

function describe(e: Event): string {
  if (e.kind === "signup")    return `joined as ${(e.meta.plan as string).toLowerCase()}`;
  if (e.kind === "written")   return `started Written exam · ${LEVEL_LABELS[e.meta.level as string]} · ${(e.meta.status as string).replace("_", " ")}`;
  if (e.kind === "oral")      return `started Oral exam · ${LEVEL_LABELS[e.meta.level as string]} · ${(e.meta.status as string).replace("_", " ")}`;
  if (e.kind === "listening") return `started Listening · ${LEVEL_LABELS[e.meta.level as string]} · ${(e.meta.status as string).replace("_", " ")}`;
  if (e.kind === "grammar") {
    const score = e.meta.score as number | null;
    return `practiced Grammar · ${e.meta.cefrLevel} · ${e.meta.exerciseType}${score !== null ? ` · ${score} pts` : ""}`;
  }
  if (e.kind === "vocab")     return `saved word "${e.meta.english}" · ${e.meta.level}`;
  return "";
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ActivityClient({ events }: Props) {
  const [filter, setFilter] = useState<"ALL" | Kind>("ALL");

  const counts: Record<Kind, number> = {
    signup: 0, written: 0, oral: 0, listening: 0, grammar: 0, vocab: 0,
  };
  for (const e of events) counts[e.kind]++;

  const filtered = filter === "ALL" ? events : events.filter(e => e.kind === filter);

  return (
    <>
      <AdminNav />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <AdminPageHeader
          title="Activity Feed"
          description="Real-time stream of platform events"
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")} label={`All (${events.length})`} />
          {(Object.keys(KIND_META) as Kind[]).map(k => {
            const Icon = KIND_META[k].Icon;
            return (
              <FilterChip
                key={k}
                active={filter === k}
                onClick={() => setFilter(k)}
                label={`${KIND_META[k].label} (${counts[k]})`}
                icon={<Icon className="h-3.5 w-3.5" />}
                color={KIND_META[k].color}
              />
            );
          })}
        </div>

        {/* Feed */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">No events match the current filter.</div>
          ) : (
            <ul>
              {filtered.map((e, i) => {
                const { Icon, color, bg } = KIND_META[e.kind];
                const display = e.user.name || e.user.email.split("@")[0];
                return (
                  <li
                    key={`${e.kind}-${e.id}-${i}`}
                    className="flex items-start gap-4 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20"
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", bg, color)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        <span className="font-medium">{display}</span>
                        <span className="text-zinc-500 dark:text-zinc-400"> {describe(e)}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">{e.user.email}</p>
                    </div>
                    <time className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500 tabular-nums" title={new Date(e.createdAt).toLocaleString("en-GB")}>
                      {relative(e.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function FilterChip({
  active, onClick, label, icon, color,
}: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
          : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800",
      )}
    >
      {icon && <span className={active ? "text-current" : color}>{icon}</span>}
      {label}
    </button>
  );
}
