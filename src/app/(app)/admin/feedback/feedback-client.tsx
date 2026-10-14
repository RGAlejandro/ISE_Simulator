"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Lightbulb, Bug, MessageCircle, Check, Mail, Trash2 } from "lucide-react";

type Category = "SUGGESTION" | "BUG" | "OTHER";

interface FeedbackItem {
  id: string;
  category: Category;
  message: string;
  isRead: boolean;
  userAgent: string | null;
  createdAt: string;
}

interface Props {
  initialItems: FeedbackItem[];
  unreadCount: number;
}

const CATEGORY_META: Record<Category, { label: string; icon: typeof Lightbulb; color: string }> = {
  SUGGESTION: { label: "Suggestion", icon: Lightbulb,     color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900" },
  BUG:        { label: "Bug",        icon: Bug,           color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900" },
  OTHER:      { label: "Other",      icon: MessageCircle, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900" },
};

export function FeedbackClient({ initialItems, unreadCount }: Props) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<"all" | "unread" | Category>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = items.filter(item => {
    if (filter === "all") return true;
    if (filter === "unread") return !item.isRead;
    return item.category === filter;
  });

  async function toggleRead(item: FeedbackItem) {
    setPendingId(item.id);
    try {
      const res = await fetch(`/api/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: !item.isRead }),
      });
      if (res.ok) {
        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, isRead: !item.isRead } : i)));
      }
    } finally {
      setPendingId(null);
    }
  }

  async function deleteItem(item: FeedbackItem) {
    if (!confirm("Delete this feedback permanently?")) return;
    setPendingId(item.id);
    try {
      const res = await fetch(`/api/feedback/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== item.id));
      }
    } finally {
      setPendingId(null);
    }
  }

  const liveUnread = items.filter(i => !i.isRead).length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <AdminPageHeader
        title="User feedback"
        description={`${items.length} total · ${liveUnread} unread · last ${initialItems.length === 200 ? "200 (capped)" : initialItems.length}`}
      />

      <div className="flex flex-wrap gap-2">
        {[
          { value: "all" as const,        label: `All (${items.length})` },
          { value: "unread" as const,     label: `Unread (${liveUnread})` },
          { value: "SUGGESTION" as const, label: "Suggestions" },
          { value: "BUG" as const,        label: "Bugs" },
          { value: "OTHER" as const,      label: "Other" },
        ].map(opt => {
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                active
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="mx-auto h-10 w-10 text-zinc-400 mb-2" />
          <p className="text-zinc-500 dark:text-zinc-400">No feedback in this view.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const meta = CATEGORY_META[item.category];
            const Icon = meta.icon;
            return (
              <Card
                key={item.id}
                className={`p-4 sm:p-5 ${item.isRead ? "opacity-70" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className={`gap-1 ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </Badge>
                    {!item.isRead && (
                      <Badge variant="success" className="gap-1">
                        New
                      </Badge>
                    )}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendingId === item.id}
                      onClick={() => toggleRead(item)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {item.isRead ? "Mark unread" : "Mark read"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendingId === item.id}
                      onClick={() => deleteItem(item)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                  {item.message}
                </p>
                {item.userAgent && (
                  <details className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
                    <summary className="cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-400">
                      User agent
                    </summary>
                    <code className="mt-1 block break-all">{item.userAgent}</code>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Initial unread reference used during server render */}
      <span className="sr-only">{unreadCount} unread on load</span>
    </div>
  );
}
