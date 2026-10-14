"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpDown, Crown, ShieldCheck, User as UserIcon, Loader2 } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Plan = "FREE" | "PRO" | "ADMIN";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  createdAt: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  counts: { written: number; oral: number; listening: number; grammar: number; vocab: number; total: number };
}

type SortKey = "createdAt" | "email" | "plan" | "total";

interface Props {
  users: UserRow[];
  currentUserId: string;
}

const PLAN_STYLES: Record<Plan, string> = {
  FREE:  "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PRO:   "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

export function UsersClient({ users, currentUserId }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<"ALL" | Plan>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = users;
    if (q) {
      rows = rows.filter(u =>
        u.email.toLowerCase().includes(q) || (u.name?.toLowerCase().includes(q) ?? false)
      );
    }
    if (planFilter !== "ALL") rows = rows.filter(u => u.plan === planFilter);

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
      else if (sortKey === "email") cmp = a.email.localeCompare(b.email);
      else if (sortKey === "plan") cmp = a.plan.localeCompare(b.plan);
      else if (sortKey === "total") cmp = a.counts.total - b.counts.total;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [users, query, planFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const changePlan = async (id: string, plan: Plan) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update plan");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const stats = {
    free:  users.filter(u => u.plan === "FREE").length,
    pro:   users.filter(u => u.plan === "PRO").length,
    admin: users.filter(u => u.plan === "ADMIN").length,
  };

  return (
    <>
      <AdminNav />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <AdminPageHeader
          title="Users"
          description={`${users.length} total · ${stats.free} free · ${stats.pro} pro · ${stats.admin} admin`}
        />

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
            {(["ALL", "FREE", "PRO", "ADMIN"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlanFilter(p)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  planFilter === p
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    <button onClick={() => toggleSort("email")} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
                      User <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    <button onClick={() => toggleSort("plan")} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
                      Plan <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Activity</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    <button onClick={() => toggleSort("total")} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
                      Total <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    <button onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
                      Joined <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isMe = u.id === currentUserId;
                  return (
                    <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
                            {(u.name || u.email).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2">
                              {u.name || u.email.split("@")[0]}
                              {isMe && <span className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">You</span>}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn("border-0", PLAN_STYLES[u.plan])}>
                          {u.plan === "ADMIN" ? <ShieldCheck className="h-3 w-3 mr-1" /> : u.plan === "PRO" ? <Crown className="h-3 w-3 mr-1" /> : <UserIcon className="h-3 w-3 mr-1" />}
                          {u.plan}
                        </Badge>
                        {u.subscriptionStatus && u.plan === "PRO" && (
                          <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{u.subscriptionStatus}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 text-[10px] text-zinc-600 dark:text-zinc-400">
                          {u.counts.written > 0   && <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">W·{u.counts.written}</span>}
                          {u.counts.oral > 0      && <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">O·{u.counts.oral}</span>}
                          {u.counts.listening > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">L·{u.counts.listening}</span>}
                          {u.counts.grammar > 0   && <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">G·{u.counts.grammar}</span>}
                          {u.counts.vocab > 0     && <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">V·{u.counts.vocab}</span>}
                          {u.counts.total === 0 && u.counts.vocab === 0 && <span className="text-zinc-400">No activity</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{u.counts.total}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {(["FREE", "PRO", "ADMIN"] as Plan[]).map(p => (
                            <Button
                              key={p}
                              size="sm"
                              variant={u.plan === p ? "default" : "outline"}
                              disabled={u.plan === p || busyId === u.id || (isMe && p !== "ADMIN")}
                              onClick={() => changePlan(u.id, p)}
                              className="h-7 px-2 text-[10px]"
                            >
                              {busyId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : p}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No users match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
