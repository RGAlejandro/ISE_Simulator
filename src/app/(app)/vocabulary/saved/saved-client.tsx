"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useI18n } from "@/components/i18n/language-provider";
import { ArrowLeft, Plus, Volume2, Info, Trash2, MoreVertical, BookOpen, Loader2, Sparkles, Search, X } from "lucide-react";
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

/** Lower case, no accents: "Pájaro" finds "pajaro". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** 0 = the English starts with it, 1 = a translation starts with it, 2 = contains it, -1 = no match. */
function matchRank(w: SavedWordData, q: string): number {
  const en = fold(w.english);
  const tr = fold(w.spanish);
  if (en.startsWith(q)) return 0;
  if (tr.split(/[,;/]\s*/).some((t) => t.startsWith(q))) return 1;
  return en.includes(q) || tr.includes(q) ? 2 : -1;
}

/** Word types the filter offers, in display order. */
const POS_KEYS = ["noun", "verb", "adjective", "adverb", "phrasalVerb", "idiom", "phrase", "other"] as const;
type PosKey = (typeof POS_KEYS)[number];

/** The AI writes "phrasal verb · + on sth. · transitive", "Noun"…: keep the base type. */
function posKey(partOfSpeech: string | null): PosKey {
  const base = (partOfSpeech ?? "").split("·")[0].trim().toLowerCase();
  if (base === "phrasal verb") return "phrasalVerb";
  if (base === "collocation" || base === "expression") return "phrase";
  return (POS_KEYS as readonly string[]).includes(base) ? (base as PosKey) : "other";
}

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
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<PosKey | "all">("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const { speak, isPlaying, supported } = useEnglishTTS();
  const { show } = useToast();
  const { locale, dict, t } = useI18n();
  const ts = dict.vocab.savedSearch;

  const listWords = useMemo(() => {
    if (activeListId === "all") return words;
    if (activeListId === "_unfiled") return words.filter((w) => w.listId === null);
    return words.filter((w) => w.listId === activeListId);
  }, [words, activeListId]);

  const q = fold(query);
  // Best matches first: the word itself, then its translation, then anywhere inside.
  const searched = useMemo(() => {
    if (!q) return listWords;
    return listWords
      .map((w) => ({ w, rank: matchRank(w, q) }))
      .filter((x) => x.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.w);
  }, [listWords, q]);
  // Types present in what the list + search show, with counts.
  const posCounts = useMemo(() => {
    const c = new Map<PosKey, number>();
    for (const w of searched) c.set(posKey(w.partOfSpeech), (c.get(posKey(w.partOfSpeech)) ?? 0) + 1);
    return POS_KEYS.filter((k) => c.has(k) || k === pos).map((k) => ({ key: k, n: c.get(k) ?? 0 }));
  }, [searched, pos]);
  const filteredWords = useMemo(
    () => (pos === "all" ? searched : searched.filter((w) => posKey(w.partOfSpeech) === pos)),
    [searched, pos],
  );
  const filtering = !!q || pos !== "all";
  const matchesFilters = (w: SavedWordData) => (!q || matchRank(w, q) >= 0) && (pos === "all" || posKey(w.partOfSpeech) === pos);
  // Matches in other lists, so an empty result can point there.
  const elsewhere = filtering && activeListId !== "all" ? words.filter(matchesFilters).length - filteredWords.length : 0;
  const clearFilters = () => {
    setQuery("");
    setPos("all");
  };

  // "/" jumps to the search box (unless already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || el?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // Target list for newly added words: the active list, or unfiled for All/Unfiled views.
  const targetListId = activeListId === "all" || activeListId === "_unfiled" ? null : activeListId;

  const addWord = async () => {
    const term = addInput.trim();
    if (!term || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/vocabulary/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ english: term, listId: targetListId, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add word");
      const w = data.word as SavedWordData;
      const oldListId = words.find((x) => x.id === w.id)?.listId ?? undefined;
      setWords((prev) => [w, ...prev.filter((x) => x.id !== w.id)]);
      setLists((prev) =>
        prev.map((l) => {
          let c = l.wordCount;
          if (oldListId && l.id === oldListId) c -= 1;
          if (w.listId && l.id === w.listId) c += 1;
          return { ...l, wordCount: Math.max(0, c) };
        })
      );
      setAddInput("");
      show(
        data.alreadyExisted ? `"${w.english}" was already saved — moved here` : `Added "${w.english}"`,
        "success"
      );
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to add word", "error");
    } finally {
      setAdding(false);
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
              <h1 className="text-3xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Saved Words</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {words.length} {words.length === 1 ? "word" : "words"} across {lists.length} {lists.length === 1 ? "list" : "lists"}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <label className="relative flex min-w-0 flex-1 items-center sm:w-72 sm:flex-none">
                <span className="sr-only">{ts.label}</span>
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
                  placeholder={ts.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                    aria-label={ts.clear}
                    title={ts.clear}
                    className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>
              <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                New list
              </Button>
            </div>
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

        {/* Add a word — AI fills translation + example */}
        <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5">
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
          <input
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addWord(); }}
            placeholder={`Add a word to ${activeList ? activeList.name : "Unfiled"} — meaning & example auto-filled`}
            maxLength={60}
            disabled={adding}
            className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none disabled:opacity-50 placeholder:text-zinc-400"
          />
          <Button size="sm" onClick={addWord} disabled={adding || !addInput.trim()} className="gap-1.5 shrink-0">
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </Button>
        </div>

        <div className="space-y-3">
        {/* Word type filter (only when the list mixes types) */}
        {(posCounts.length > 1 || pos !== "all") && (
          <div role="radiogroup" aria-label={ts.typeLabel} className="flex gap-1.5 overflow-x-auto pb-1">
            {[{ key: "all" as const, n: searched.length }, ...posCounts].map(({ key, n }) => {
              const active = pos === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPos(key)}
                  className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-transparent bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {key === "all" ? ts.allTypes : ts.types[key]}
                  <span className={`ml-1.5 tabular-nums ${active ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"}`}>{n}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filter result line */}
        {filtering && filteredWords.length > 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {t("vocab.savedSearch.results", { n: filteredWords.length, total: listWords.length })}
          </p>
        )}

        {/* Word grid */}
        {filtering && filteredWords.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-10 text-center" aria-live="polite">
            <Search className="mx-auto mb-3 h-6 w-6 text-zinc-400" aria-hidden />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {q ? t("vocab.savedSearch.noMatch", { q: query.trim() }) : ts.noMatchFilters}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {elsewhere > 0 && (
                <Button size="sm" onClick={() => setActiveListId("all")}>{t("vocab.savedSearch.inAllLists", { n: elsewhere })}</Button>
              )}
              <Button size="sm" variant="outline" onClick={clearFilters}>{ts.clearFilters}</Button>
            </div>
          </div>
        ) : filteredWords.length === 0 ? (
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
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">{w.spanish}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic line-clamp-2">&ldquo;{w.example}&rdquo;</p>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => supported && speak(w.english)}
                          disabled={!supported}
                          className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-amber-900 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-40"
                          title="Pronounce"
                        >
                          <Volume2 className={`h-4 w-4 ${isPlaying ? "animate-pulse" : ""}`} />
                        </button>
                        <button
                          onClick={() => setDetailsWord({ english: w.english, level })}
                          className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-amber-900 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
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
