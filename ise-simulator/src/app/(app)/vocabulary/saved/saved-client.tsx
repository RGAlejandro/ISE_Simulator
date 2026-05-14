"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { WordDetailsDialog } from "@/components/vocabulary/word-details-dialog";
import { LEVEL_COLORS } from "@/components/vocabulary/flashcard";
import { useEnglishTTS } from "@/hooks/use-english-tts";
import { useToast } from "@/components/ui/toaster";
import { ArrowLeft, Plus, Volume2, Info, Trash2, MoreVertical, BookOpen, Loader2 } from "lucide-react";
import type { CefrBand } from "@/lib/prompts/vocabulary";
import type { SavedWordData, VocabularyListData } from "@/types";

const COLORS = [
  { id: "blue", cls: "bg-blue-500" },
  { id: "purple", cls: "bg-purple-500" },
  { id: "pink", cls: "bg-pink-500" },
  { id: "green", cls: "bg-green-500" },
  { id: "orange", cls: "bg-orange-500" },
  { id: "red", cls: "bg-red-500" },
];

interface Props {
  initialLists: VocabularyListData[];
  initialWords: SavedWordData[];
}

export function SavedClient({ initialLists, initialWords }: Props) {
  const [lists, setLists] = useState(initialLists);
  const [words, setWords] = useState(initialWords);
  const [activeListId, setActiveListId] = useState<string | "all" | "_unfiled">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📚");
  const [newColor, setNewColor] = useState("blue");
  const [busy, setBusy] = useState(false);
  const [detailsWord, setDetailsWord] = useState<{ english: string; level: CefrBand } | null>(null);

  const { speak, isPlaying, supported } = useEnglishTTS();
  const { show } = useToast();

  const filteredWords = useMemo(() => {
    if (activeListId === "all") return words;
    if (activeListId === "_unfiled") return words.filter((w) => w.listId === null);
    return words.filter((w) => w.listId === activeListId);
  }, [words, activeListId]);

  const unfiledCount = useMemo(() => words.filter((w) => w.listId === null).length, [words]);

  const createList = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/vocabulary/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), emoji: newEmoji, color: newColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setLists((prev) => [data.list, ...prev]);
      setNewName("");
      setNewEmoji("📚");
      setNewColor("blue");
      setCreateOpen(false);
      show(`Created "${data.list.name}"`, "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "Create failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeWord = async (id: string) => {
    try {
      const res = await fetch(`/api/vocabulary/saved/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const removed = words.find((w) => w.id === id);
      setWords((prev) => prev.filter((w) => w.id !== id));
      if (removed?.listId) {
        setLists((prev) =>
          prev.map((l) => (l.id === removed.listId ? { ...l, wordCount: Math.max(0, l.wordCount - 1) } : l))
        );
      }
      show("Word removed", "success");
    } catch {
      show("Failed to remove", "error");
    }
  };

  const moveWord = async (wordId: string, newListId: string | null) => {
    try {
      const res = await fetch(`/api/vocabulary/saved/${wordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: newListId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Move failed");
      const oldWord = words.find((w) => w.id === wordId);
      const oldListId = oldWord?.listId ?? null;
      setWords((prev) => prev.map((w) => (w.id === wordId ? { ...w, listId: newListId } : w)));
      setLists((prev) =>
        prev.map((l) => {
          if (l.id === oldListId) return { ...l, wordCount: Math.max(0, l.wordCount - 1) };
          if (l.id === newListId) return { ...l, wordCount: l.wordCount + 1 };
          return l;
        })
      );
      show("Moved", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "Move failed", "error");
    }
  };

  const deleteList = async (listId: string) => {
    if (!confirm("Delete this list? Words stay saved (unfiled).")) return;
    try {
      const res = await fetch(`/api/vocabulary/lists/${listId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setLists((prev) => prev.filter((l) => l.id !== listId));
      setWords((prev) => prev.map((w) => (w.listId === listId ? { ...w, listId: null } : w)));
      if (activeListId === listId) setActiveListId("all");
      show("List deleted", "success");
    } catch {
      show("Failed to delete list", "error");
    }
  };

  const activeList = lists.find((l) => l.id === activeListId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* Header */}
        <div>
          <Link href="/vocabulary">
            <Button variant="ghost" size="sm" className="gap-1 text-zinc-500 mb-3">
              <ArrowLeft className="h-4 w-4" />
              Back to Vocabulary
            </Button>
          </Link>
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Saved Words</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {words.length} {words.length === 1 ? "word" : "words"} across {lists.length} {lists.length === 1 ? "list" : "lists"}
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New list
            </Button>
          </div>
        </div>

        {/* List tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveListId("all")}
            className={`flex-shrink-0 flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors cursor-pointer ${
              activeListId === "all"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400"
            }`}
          >
            <span>📖</span>
            <span className="text-sm font-medium">All</span>
            <span className={`text-xs ${activeListId === "all" ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"}`}>{words.length}</span>
          </button>
          {unfiledCount > 0 && (
            <button
              onClick={() => setActiveListId("_unfiled")}
              className={`flex-shrink-0 flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors cursor-pointer ${
                activeListId === "_unfiled"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400"
              }`}
            >
              <span>🔖</span>
              <span className="text-sm font-medium">Unfiled</span>
              <span className={`text-xs ${activeListId === "_unfiled" ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"}`}>{unfiledCount}</span>
            </button>
          )}
          {lists.map((l) => {
            const active = activeListId === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setActiveListId(l.id)}
                className={`flex-shrink-0 flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors cursor-pointer ${
                  active
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400"
                }`}
              >
                <span>{l.emoji}</span>
                <span className="text-sm font-medium">{l.name}</span>
                <span className={`text-xs ${active ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"}`}>{l.wordCount}</span>
              </button>
            );
          })}
        </div>

        {/* Active list header (study + delete) */}
        {activeList && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{activeList.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{activeList.name}</p>
                <p className="text-xs text-zinc-400">{activeList.wordCount} {activeList.wordCount === 1 ? "word" : "words"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {activeList.wordCount > 0 && (
                <Link href={`/vocabulary/study/${activeList.id}`}>
                  <Button size="sm" className="gap-2">
                    <BookOpen className="h-3.5 w-3.5" />
                    Study list
                  </Button>
                </Link>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950 gap-2"
                onClick={() => deleteList(activeList.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Word grid */}
        {filteredWords.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-12 text-center">
            <div className="text-4xl mb-3">📚</div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No words here yet. Start a vocabulary session and tap the bookmark on cards to save them.
            </p>
            <Link href="/vocabulary" className="inline-block mt-4">
              <Button size="sm">Start a session</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWords.map((w) => {
              const level = (w.level as CefrBand) ?? "B1";
              return (
                <Card key={w.id} className="group relative hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">{w.english}</p>
                        {w.partOfSpeech && (
                          <p className="text-xs text-zinc-400 capitalize">{w.partOfSpeech}</p>
                        )}
                      </div>
                      <Badge className={`${LEVEL_COLORS[level]} text-[10px] font-bold flex-shrink-0`}>{level}</Badge>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{w.spanish}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic line-clamp-2">&ldquo;{w.example}&rdquo;</p>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => supported && speak(w.english)}
                          disabled={!supported}
                          className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-40"
                          title="Pronounce"
                        >
                          <Volume2 className={`h-4 w-4 ${isPlaying ? "animate-pulse" : ""}`} />
                        </button>
                        <button
                          onClick={() => setDetailsWord({ english: w.english, level })}
                          className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Details"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-full text-zinc-400 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Move to list</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => moveWord(w.id, null)}>
                            <span>🔖</span>
                            <span>Unfiled</span>
                          </DropdownMenuItem>
                          {lists.map((l) => (
                            <DropdownMenuItem key={l.id} onSelect={() => moveWord(w.id, l.id)}>
                              <span>{l.emoji}</span>
                              <span>{l.name}</span>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => removeWord(w.id)}
                            className="text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-950"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create list dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New vocabulary list</DialogTitle>
            <DialogDescription className="sr-only">Create a new list to save words into</DialogDescription>
          </DialogHeader>
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
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Emoji</label>
                <input
                  type="text"
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value.slice(0, 4))}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy} className="flex-1">
              Cancel
            </Button>
            <Button onClick={createList} disabled={busy || !newName.trim()} className="flex-1 gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {detailsWord && (
        <WordDetailsDialog
          open={!!detailsWord}
          onOpenChange={(v) => !v && setDetailsWord(null)}
          word={detailsWord.english}
          level={detailsWord.level}
          onSpeak={speak}
        />
      )}
    </div>
  );
}
