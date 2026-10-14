"use client";

import { FileText, Mic, Volume2, Clock, CheckCircle2, Sparkles } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { BarChart } from "@/components/admin/bar-chart";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LEVEL_LABELS: Record<string, string> = {
  ISE_FOUNDATION: "ISE Foundation",
  ISE_I: "ISE I",
  ISE_II: "ISE II",
  ISE_III: "ISE III",
  ISE_IV: "ISE IV",
};

type Kind = "written" | "oral" | "listening";

interface Props {
  byLevel: {
    level: string;
    written: number;
    oral: number;
    listening: number;
    avgWritten: number | null;
    avgOral: number | null;
    avgListening: number | null;
  }[];
  status: {
    written:   { IN_PROGRESS: number; COMPLETED: number; EVALUATED: number };
    oral:      { IN_PROGRESS: number; COMPLETED: number; EVALUATED: number };
    listening: { IN_PROGRESS: number; COMPLETED: number; EVALUATED: number };
  };
  averages: { written: number | null; oral: number | null; listening: number | null };
  recent: {
    id: string;
    kind: Kind;
    level: string;
    status: string;
    score: number | null;
    createdAt: string;
    userEmail: string;
    userName: string | null;
  }[];
}

const KIND_STYLE: Record<Kind, { icon: typeof FileText; color: string; bg: string }> = {
  written:   { icon: FileText, color: "text-blue-600 dark:text-blue-300",   bg: "bg-blue-50 dark:bg-blue-950/50"     },
  oral:      { icon: Mic,      color: "text-rose-600 dark:text-rose-300",   bg: "bg-rose-50 dark:bg-rose-950/50"     },
  listening: { icon: Volume2,  color: "text-purple-600 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-950/50" },
};

const STATUS_STYLE: Record<string, string> = {
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  COMPLETED:   "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  EVALUATED:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const fmtScore = (s: number | null) => (s === null ? "—" : s.toFixed(1));
const fmtAvg = (s: number | null) => (s === null ? "—" : s.toFixed(1));

export function ExamsClient({ byLevel, status, averages, recent }: Props) {
  const completionRate = (s: { IN_PROGRESS: number; COMPLETED: number; EVALUATED: number }) => {
    const total = s.IN_PROGRESS + s.COMPLETED + s.EVALUATED;
    if (total === 0) return 0;
    return Math.round(((s.COMPLETED + s.EVALUATED) / total) * 100);
  };

  return (
    <>
      <AdminNav />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <AdminPageHeader
          title="Exams"
          description="Breakdown by level, type, status and average scores"
        />

        {/* Averages */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Avg Written Score"   value={fmtAvg(averages.written)}   hint="across all completed" icon={<FileText className="h-5 w-5" />} tone="blue" />
          <StatCard label="Avg Oral Score"      value={fmtAvg(averages.oral)}      hint="across all completed" icon={<Mic className="h-5 w-5" />} tone="rose" />
          <StatCard label="Avg Listening Score" value={fmtAvg(averages.listening)} hint="across all completed" icon={<Volume2 className="h-5 w-5" />} tone="purple" />
          <StatCard
            label="Completion Rate"
            value={`${completionRate({
              IN_PROGRESS: status.written.IN_PROGRESS + status.oral.IN_PROGRESS + status.listening.IN_PROGRESS,
              COMPLETED:   status.written.COMPLETED   + status.oral.COMPLETED   + status.listening.COMPLETED,
              EVALUATED:   status.written.EVALUATED   + status.oral.EVALUATED   + status.listening.EVALUATED,
            })}%`}
            hint="Completed + Evaluated"
            icon={<Sparkles className="h-5 w-5" />}
            tone="green"
          />
        </div>

        {/* By level */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Exams by Level</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Total sessions per CEFR band</p>
            <BarChart
              data={byLevel.map(r => ({ label: LEVEL_LABELS[r.level], value: r.written + r.oral + r.listening }))}
            />
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Average Score by Level</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Combined avg across modules</p>
            <div className="space-y-3">
              {byLevel.map(r => {
                const avgs = [r.avgWritten, r.avgOral, r.avgListening].filter((x): x is number => x !== null);
                const combined = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
                return (
                  <div key={r.level} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{LEVEL_LABELS[r.level]}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">W {fmtAvg(r.avgWritten)}</span>
                      <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">O {fmtAvg(r.avgOral)}</span>
                      <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">L {fmtAvg(r.avgListening)}</span>
                      <span className="ml-2 inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold tabular-nums">
                        {fmtAvg(combined)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status breakdown per kind */}
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["written", "oral", "listening"] as Kind[]).map(k => {
            const s = status[k];
            const total = s.IN_PROGRESS + s.COMPLETED + s.EVALUATED;
            const KIcon = KIND_STYLE[k].icon;
            return (
              <div key={k} className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", KIND_STYLE[k].bg, KIND_STYLE[k].color)}>
                    <KIcon className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">{k}</h3>
                  <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">{total} total</span>
                </div>
                <div className="space-y-3">
                  <StatusRow icon={<Clock className="h-3.5 w-3.5" />} label="In progress" value={s.IN_PROGRESS} total={total} color="bg-amber-400" />
                  <StatusRow icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Completed"   value={s.COMPLETED}   total={total} color="bg-blue-500" />
                  <StatusRow icon={<Sparkles className="h-3.5 w-3.5" />} label="Evaluated"   value={s.EVALUATED}   total={total} color="bg-emerald-500" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent exams */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Exam Sessions</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Last 15 across all modules</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50/60 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">User</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Level</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Score</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => {
                  const Icon = KIND_STYLE[r.kind].icon;
                  return (
                    <tr key={`${r.kind}-${r.id}`} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium capitalize", KIND_STYLE[r.kind].bg, KIND_STYLE[r.kind].color)}>
                          <Icon className="h-3 w-3" />
                          {r.kind}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">{r.userName || r.userEmail.split("@")[0]}</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">{r.userEmail}</div>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{LEVEL_LABELS[r.level]}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn("border-0 text-[10px]", STATUS_STYLE[r.status])}>{r.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-4 py-2.5 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{fmtScore(r.score)}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{relative(r.createdAt)}</td>
                    </tr>
                  );
                })}
                {recent.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No exam sessions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusRow({ icon, label, value, total, color }: { icon: React.ReactNode; label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">{icon}{label}</span>
        <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
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
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
