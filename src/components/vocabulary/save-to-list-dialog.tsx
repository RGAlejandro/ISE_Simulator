"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Bookmark, BookmarkCheck } from "lucide-react";
import type { VocabularyListData } from "@/types";

const COLORS = [
  { id: "blue", cls: "bg-blue-500" },
  { id: "purple", cls: "bg-purple-500" },
  { id: "pink", cls: "bg-pink-500" },
  { id: "green", cls: "bg-green-500" },
  { id: "orange", cls: "bg-orange-500" },
  { id: "red", cls: "bg-red-500" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lists: VocabularyListData[];
  currentListId: string | null;
  word: string;
  isSaved: boolean;
  onSelectList: (listId: string | null) => Promise<void>;
  onRemove: () => Promise<void>;
  onCreateList: (name: string, emoji: string, color: string) => Promise<VocabularyListData>;
}

export function SaveToListDialog({
  open,
  onOpenChange,
  lists,
  currentListId,
  word,
  isSaved,
  onSelectList,
  onRemove,
  onCreateList,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📚");
  const [newColor, setNewColor] = useState("blue");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const list = await onCreateList(newName.trim(), newEmoji, newColor);
      await onSelectList(list.id);
      setCreating(false);
      setNewName("");
      setNewEmoji("📚");
      setNewColor("blue");
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = async (listId: string | null) => {
    setBusy(true);
    try {
      await onSelectList(listId);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await onRemove();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isSaved ? "Manage saved word" : "Save word"}
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">&ldquo;{word}&rdquo;</span>
          </DialogDescription>
        </DialogHeader>

        {!creating ? (
          <>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              <button
                disabled={busy}
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors border ${
                  isSaved && currentListId === null
                    ? "border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700"
                    : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="text-xl">🔖</span>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex-1">Unfiled (just save)</span>
                {isSaved && currentListId === null && <BookmarkCheck className="h-4 w-4 text-amber-500" />}
              </button>
              {lists.map((l) => {
                const active = isSaved && currentListId === l.id;
                return (
                  <button
                    key={l.id}
                    disabled={busy}
                    onClick={() => handleSelect(l.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors border ${
                      active
                        ? "border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700"
                        : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="text-xl">{l.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">{l.name}</p>
                      <p className="text-xs text-zinc-400">{l.wordCount} {l.wordCount === 1 ? "word" : "words"}</p>
                    </div>
                    {active && <BookmarkCheck className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              onClick={() => setCreating(true)}
              className="w-full gap-2"
              disabled={busy}
            >
              <Plus className="h-4 w-4" />
              Create new list
            </Button>

            {isSaved && (
              <Button
                variant="outline"
                onClick={handleRemove}
                disabled={busy}
                className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950 border-red-200 dark:border-red-900"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove from saved"}
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Travel words"
                  maxLength={60}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-zinc-500 mb-1 block">Emoji</label>
                  <input
                    type="text"
                    value={newEmoji}
                    onChange={(e) => setNewEmoji(e.target.value.slice(0, 4))}
                    placeholder="📚"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="text-xs font-medium text-zinc-500 mb-1 block">Colour</label>
                  <div className="flex gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setNewColor(c.id)}
                        className={`h-8 w-8 rounded-full ${c.cls} transition-all ${
                          newColor === c.id ? "ring-2 ring-offset-2 ring-zinc-700 dark:ring-zinc-200" : "opacity-60 hover:opacity-100"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreating(false)} disabled={busy} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={busy || !newName.trim()} className="flex-1 gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
                Create & Save
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
