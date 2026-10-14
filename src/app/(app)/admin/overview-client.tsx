"use client";

import { Users, Crown, Activity, FileText, Mic, Volume2, BookOpen, Bookmark, TrendingUp, ShieldCheck } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { Sparkline } from "@/components/admin/sparkline";
import { BarChart } from "@/components/admin/bar-chart";
import { Donut } from "@/components/admin/donut";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPageHeader } from "@/components/admin/page-header";

const LEVEL_LABELS: Record<string, string> = {
  ISE_FOUNDATION: "ISE Foundation",
  ISE_I: "ISE I",
  ISE_II: "ISE II",
  ISE_III: "ISE III",
  ISE_IV: "ISE IV",
};

interface Props {
  kpis: {
    totalUsers: number;
    proUsers: number;
    adminUsers: number;
    active7: number;
    totalWritten: number;
    totalOral: number;
    totalListening: number;
    totalGrammar: number;
    totalSavedWords: number;
    totalVocabLists: number;
    activity7: number;
  };
  signups: { date: string; count: number }[];
  planDist: { FREE: number; PRO: number; ADMIN: number };
  examsByLevel: { level: string; written: number; oral: number; listening: number }[];
}

export function OverviewClient({ kpis, signups, planDist, examsByLevel }: Props) {
  const signupsLast7 = signups.slice(-7).reduce((a, b) => a + b.count, 0);
  const signupsPrev7 = signups.slice(-14, -7).reduce((a, b) => a + b.count, 0);
  const signupTrend = signupsPrev7 === 0 ? (signupsLast7 > 0 ? 100 : 0)
    : Math.round(((signupsLast7 - signupsPrev7) / signupsPrev7) * 100);

  const totalExams = kpis.totalWritten + kpis.totalOral + kpis.totalListening;

  return (
    <>
      <AdminNav />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <AdminPageHeader
          title="Admin Overview"
          description="Real-time platform health and engagement"
        />

        {/* Top KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Users"
            value={kpis.totalUsers.toLocaleString()}
            hint={`${kpis.adminUsers} admin${kpis.adminUsers !== 1 ? "s" : ""}`}
            icon={<Users className="h-5 w-5" />}
            tone="blue"
          />
          <StatCard
            label="Pro Subscribers"
            value={kpis.proUsers.toLocaleString()}
            hint={`${kpis.totalUsers > 0 ? ((kpis.proUsers / kpis.totalUsers) * 100).toFixed(1) : "0"}% conversion`}
            icon={<Crown className="h-5 w-5" />}
            tone="amber"
          />
          <StatCard
            label="Active (7d)"
            value={kpis.active7.toLocaleString()}
            hint="Users with activity in last 7 days"
            icon={<Activity className="h-5 w-5" />}
            tone="green"
          />
          <StatCard
            label="New Signups (7d)"
            value={signupsLast7.toLocaleString()}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="purple"
            trend={{ value: signupTrend, suffix: "%" }}
          />
        </div>

        {/* Signups chart + Plan donut */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Signups — last 30 days</h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{signups.reduce((a, b) => a + b.count, 0)} total</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Daily new user registrations</p>
            <Sparkline data={signups.map(s => ({ label: s.date, value: s.count }))} height={130} />
            <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
              <span>{signups[0]?.date}</span>
              <span>{signups[signups.length - 1]?.date}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Plan Distribution</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Users by subscription tier</p>
            <Donut
              size={160}
              thickness={20}
              centerValue={kpis.totalUsers}
              centerLabel="users"
              data={[
                { label: "Free",  value: planDist.FREE,  color: "#a1a1aa" },
                { label: "Pro",   value: planDist.PRO,   color: "#3b82f6" },
                { label: "Admin", value: planDist.ADMIN, color: "#a855f7" },
              ]}
            />
          </div>
        </div>

        {/* Content engagement KPIs */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Content Engagement</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <StatCard label="Written Exams"  value={kpis.totalWritten.toLocaleString()}   icon={<FileText className="h-5 w-5" />} tone="blue"   />
            <StatCard label="Oral Exams"     value={kpis.totalOral.toLocaleString()}      icon={<Mic className="h-5 w-5" />}      tone="rose"   />
            <StatCard label="Listening"      value={kpis.totalListening.toLocaleString()} icon={<Volume2 className="h-5 w-5" />}  tone="purple" />
            <StatCard label="Grammar"        value={kpis.totalGrammar.toLocaleString()}   icon={<BookOpen className="h-5 w-5" />} tone="green"  />
            <StatCard label="Vocab Saved"    value={kpis.totalSavedWords.toLocaleString()} hint={`${kpis.totalVocabLists} lists`} icon={<Bookmark className="h-5 w-5" />} tone="amber" />
          </div>
        </div>

        {/* Exams by level */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Exams by Level</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Combined written + oral + listening · {totalExams} total</p>
            <BarChart
              data={examsByLevel.map(r => ({
                label: LEVEL_LABELS[r.level],
                value: r.written + r.oral + r.listening,
              }))}
            />
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">By Module Type</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Total sessions per content area</p>
            <BarChart
              data={[
                { label: "Written",   value: kpis.totalWritten,   color: "linear-gradient(90deg,#3b82f6,#6366f1)" },
                { label: "Oral",      value: kpis.totalOral,      color: "linear-gradient(90deg,#f43f5e,#ec4899)" },
                { label: "Listening", value: kpis.totalListening, color: "linear-gradient(90deg,#a855f7,#8b5cf6)" },
                { label: "Grammar",   value: kpis.totalGrammar,   color: "linear-gradient(90deg,#10b981,#22c55e)" },
                { label: "Vocab",     value: kpis.totalSavedWords, color: "linear-gradient(90deg,#f59e0b,#f97316)" },
              ]}
            />
          </div>
        </div>

        {/* Footer credit */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-200/60 bg-zinc-50/40 dark:bg-zinc-900/40 dark:border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="h-4 w-4" />
            Admin-only view · Data computed live from PostgreSQL
          </div>
          <span className="text-xs text-zinc-400 tabular-nums">Activity 7d: {kpis.activity7}</span>
        </div>
      </div>
    </>
  );
}
