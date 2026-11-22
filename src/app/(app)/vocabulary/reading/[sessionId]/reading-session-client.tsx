"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LEVEL_COLORS } from "@/components/vocabulary/flashcard";
import { SaveToListDialog } from "@/components/vocabulary/save-to-list-dialog";
import { WordDetailsDialog } from "@/components/vocabulary/word-details-dialog";
import { ReadingPassage, tapKey, type WordTap } from "@/components/vocabulary/reading/reading-passage";
import { WordPanel, type GlossState } from "@/components/vocabulary/reading/word-panel";
import { ReadingQuiz } from "@/components/vocabulary/reading/reading-quiz";
import { useEnglishTTS } from "@/hooks/use-english-tts";
import { useToast } from "@/components/ui/toaster";
import { useI18n } from "@/components/i18n/language-provider";
import { gradeAnswers, isAnswerCorrect, locatePhrase, normalizeWord, splitSentences } from "@/lib/reading";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, CheckCircle2, Highlighter,
  Loader2, MousePointerClick, Square, Volume2, XCircle, BookOpen, RotateCcw,
} from "lucide-react";
import type { CefrBand } from "@/lib/prompts/vocabulary";
import type { ReadingAnswer, ReadingContent, ReadingLookupData, VocabularyListData } from "@/types";

const CEFR: CefrBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

interface Props {
  sessionId: string;
  title: string;
  level: CefrBand;
  topic: string;
  content: ReadingContent;
  initialLookups: ReadingLookupData[];
  initialResult: { answers: ReadingAnswer[]; score: number; total: number } | null;
}

type Phase = "read" | "quiz" | "saving" | "results";

/** What gets written to the user's saved words. */
interface SaveItem {
  english: string;
  translation: string;
  example: string;
  partOfSpeech: string | null;
  level: string;
}

export function ReadingSessionClient({ sessionId, title, level, topic, content, initialLookups, initialResult }: Props) {
  const { dict, t } = useI18n();
  const r = dict.vocab.reading;
  const { show } = useToast();

  const ttsErrorShown = useRef(false);
  const onTtsError = useCallback((msg: string) => {
    if (ttsErrorShown.current) return;
    ttsErrorShown.current = true;
    show(`Pronunciation failed (${msg}).`, "error");
  }, [show]);
  const { speak, stop, isPlaying } = useEnglishTTS(onTtsError);
  const [aloud, setAloud] = useState(false);

  const [phase, setPhase] = useState<Phase>(initialResult ? "results" : "read");
  const [result, setResult] = useState(initialResult);
  const [highlight, setHighlight] = useState(true);
  const [showTextInQuiz, setShowTextInQuiz] = useState(false);

  const [selected, setSelected] = useState<WordTap | null>(null);
  const [glosses, setGlosses] = useState<Record<string, GlossState>>(() =>
    Object.fromEntries(initialLookups.map((l) => [tapKey(l.word, l.paragraph, l.sentence), { status: "ready", data: l }])),
  );

  const [lists, setLists] = useState<VocabularyListData[]>([]);
  const [savedMap, setSavedMap] = useState<Map<string, string | null>>(new Map());
  const [saveItems, setSaveItems] = useState<SaveItem[] | null>(null);
  const [detailsFor, setDetailsFor] = useState<{ word: string; level: CefrBand } | null>(null);

  const sentences = useMemo(() => content.paragraphs.map((p) => splitSentences(p)), [content.paragraphs]);
  const sentenceAt = useCallback((p: number, s: number) => sentences[p]?.[s] ?? "", [sentences]);
  const fullText = useMemo(() => content.paragraphs.join("\n\n"), [content.paragraphs]);

  useEffect(() => {
    Promise.all([
      fetch("/api/vocabulary/lists").then((res) => (res.ok ? res.json() : { lists: [] })),
      fetch("/api/vocabulary/saved").then((res) => (res.ok ? res.json() : { words: [] })),
    ])
      .then(([listsRes, savedRes]) => {
        setLists(listsRes.lists ?? []);
        setSavedMap(new Map((savedRes.words ?? []).map((w: { english: string; listId: string | null }) => [w.english.toLowerCase(), w.listId])));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // ── Looking words up ──────────────────────────────────────────────────────

  const requestLookup = useCallback(async (tap: WordTap) => {
    const key = tapKey(tap.word, tap.paragraph, tap.sentence);
    try {
      const res = await fetch(`/api/vocabulary/reading/${sessionId}/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: tap.word, paragraph: tap.paragraph, sentence: tap.sentence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setGlosses((g) => ({ ...g, [key]: { status: "ready", data: data.lookup } }));
    } catch {
      setGlosses((g) => (g[key]?.status === "ready" ? g : { ...g, [key]: { status: "error" } }));
    }
  }, [sessionId]);

  const onWordTap = (tap: WordTap) => {
    const key = tapKey(tap.word, tap.paragraph, tap.sentence);
    if (selected && tapKey(selected.word, selected.paragraph, selected.sentence) === key) {
      setSelected(null);
      return;
    }
    setSelected(tap);
    const current = glosses[key];
    if (current && current.status !== "error") return;

    if (tap.target !== null) {
      // Key words are glossed in the text already — show instantly, record in the background.
      const tw = content.targetWords[tap.target];
      setGlosses((g) => ({
        ...g,
        [key]: {
          status: "ready",
          data: {
            word: normalizeWord(tap.word), paragraph: tap.paragraph, sentence: tap.sentence,
            lemma: tw.lemma, partOfSpeech: tw.partOfSpeech, translation: tw.translation, definition: tw.definition, level,
          },
        },
      }));
      void requestLookup(tap);
      return;
    }
    setGlosses((g) => ({ ...g, [key]: { status: "loading" } }));
    void requestLookup(tap);
  };

  const retrySelected = () => {
    if (!selected) return;
    setGlosses((g) => ({ ...g, [tapKey(selected.word, selected.paragraph, selected.sentence)]: { status: "loading" } }));
    void requestLookup(selected);
  };

  const speakWord = (text: string) => {
    setAloud(false);
    void speak(text);
  };

  const toggleAloud = () => {
    if (aloud) {
      stop();
      setAloud(false);
      return;
    }
    setAloud(true);
    void speak(fullText, { onEnd: () => setAloud(false) });
  };

  // ── Words found in this session ───────────────────────────────────────────

  const discovered = useMemo(() => {
    const seen = new Set<string>();
    const out: ReadingLookupData[] = [];
    for (const g of Object.values(glosses)) {
      if (g.status !== "ready") continue;
      const k = normalizeWord(g.data.lemma);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(g.data);
    }
    return out;
  }, [glosses]);

  const lookedUpKeys = useMemo(
    () => new Set(Object.entries(glosses).filter(([, g]) => g.status === "ready").map(([k]) => k)),
    [glosses],
  );

  const keyWordItems: SaveItem[] = useMemo(
    () =>
      content.targetWords.map((tw) => ({
        english: tw.lemma,
        translation: tw.translation,
        example: locatePhrase(content.paragraphs, tw.word)?.text ?? "",
        partOfSpeech: tw.partOfSpeech,
        level,
      })),
    [content, level],
  );

  const lookupItem = useCallback((l: ReadingLookupData): SaveItem => ({
    english: l.lemma,
    translation: l.translation,
    example: sentenceAt(l.paragraph, l.sentence),
    partOfSpeech: l.partOfSpeech,
    level: l.level ?? level,
  }), [sentenceAt, level]);

  // Results list key words separately, so "looked up" only shows the extra words.
  const lookedUpExtra = useMemo(() => {
    const keyLemmas = new Set(content.targetWords.map((tw) => normalizeWord(tw.lemma)));
    return discovered.filter((l) => !keyLemmas.has(normalizeWord(l.lemma)));
  }, [discovered, content.targetWords]);

  const isSaved = (english: string) => savedMap.has(english.toLowerCase());

  const unsavedItems = useMemo(() => {
    const seen = new Set<string>();
    return [...keyWordItems, ...discovered.map(lookupItem)].filter((it) => {
      const k = it.english.toLowerCase();
      if (seen.has(k) || savedMap.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [keyWordItems, discovered, lookupItem, savedMap]);

  // ── Saving to lists ───────────────────────────────────────────────────────

  const refreshLists = async () => {
    const res = await fetch("/api/vocabulary/lists").then((x) => x.json()).catch(() => null);
    if (res?.lists) setLists(res.lists);
  };

  const saveToList = async (listId: string | null) => {
    if (!saveItems) return;
    const saved: string[] = [];
    for (const it of saveItems) {
      const res = await fetch("/api/vocabulary/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          english: it.english,
          spanish: it.translation,
          example: it.example || it.english,
          partOfSpeech: it.partOfSpeech,
          level: it.level,
          listId,
        }),
      }).catch(() => null);
      if (res?.ok) saved.push(it.english.toLowerCase());
    }
    if (saved.length === 0) {
      show(r.saveFailed, "error");
      return;
    }
    setSavedMap((prev) => {
      const next = new Map(prev);
      for (const k of saved) next.set(k, listId);
      return next;
    });
    void refreshLists();
    const listName = listId ? lists.find((l) => l.id === listId)?.name ?? "" : r.unfiled;
    show(
      saved.length === 1 ? t("vocab.reading.savedTo", { list: listName }) : t("vocab.reading.savedMany", { n: saved.length, list: listName }),
      "success",
    );
  };

  const removeSaved = async () => {
    const item = saveItems?.[0];
    if (!item) return;
    try {
      const savedRes = await fetch("/api/vocabulary/saved").then((x) => x.json());
      const record = savedRes.words?.find((w: { id: string; english: string }) => w.english.toLowerCase() === item.english.toLowerCase());
      if (!record) return;
      const res = await fetch(`/api/vocabulary/saved/${record.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSavedMap((prev) => {
        const next = new Map(prev);
        next.delete(item.english.toLowerCase());
        return next;
      });
      void refreshLists();
    } catch {
      show(r.saveFailed, "error");
    }
  };

  const createList = async (name: string, emoji: string, color: string): Promise<VocabularyListData> => {
    const res = await fetch("/api/vocabulary/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji, color }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Create failed");
    setLists((prev) => [data.list, ...prev]);
    return data.list;
  };

  // ── Quiz ──────────────────────────────────────────────────────────────────

  const finishQuiz = async (answers: ReadingAnswer[]) => {
    setPhase("saving");
    try {
      const res = await fetch(`/api/vocabulary/reading/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ answers, score: data.score, total: data.total });
    } catch {
      show(r.saveError, "error");
      setResult({ answers, score: gradeAnswers(content.questions, answers), total: content.questions.length });
    }
    setPhase("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startQuiz = () => {
    stop();
    setAloud(false);
    setSelected(null);
    setPhase("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedKey = selected ? tapKey(selected.word, selected.paragraph, selected.sentence) : null;
  const selectedGloss = selectedKey ? glosses[selectedKey] : undefined;
  const selectedLemma = selectedGloss?.status === "ready" ? selectedGloss.data.lemma : null;
  const selectedTarget = selected
    ? selected.target !== null
      ? content.targetWords[selected.target]
      : content.targetWords.find((tw) => normalizeWord(tw.word) === normalizeWord(selected.word))
    : undefined;

  const panel = selected && (
    <WordPanel
      word={selected.word}
      sentence={sentenceAt(selected.paragraph, selected.sentence)}
      gloss={selectedGloss}
      isKeyWord={!!selectedTarget}
      fromList={!!selectedTarget?.fromList}
      isSaved={selectedLemma ? isSaved(selectedLemma) : false}
      isPlaying={isPlaying && !aloud}
      onSave={() => {
        if (selectedGloss?.status === "ready") setSaveItems([lookupItem(selectedGloss.data)]);
      }}
      onDetails={() => {
        if (selectedGloss?.status !== "ready") return;
        const lv = selectedGloss.data.level as CefrBand | null;
        setDetailsFor({ word: selectedGloss.data.lemma, level: lv && CEFR.includes(lv) ? lv : level });
      }}
      onSpeak={speakWord}
      onRetry={retrySelected}
      onClose={() => setSelected(null)}
    />
  );

  const header = (
    <div className="flex items-center justify-between gap-3">
      <Link href="/vocabulary/reading">
        <Button variant="ghost" size="sm" className="gap-1 text-zinc-500 -ml-2">
          <ArrowLeft className="h-4 w-4" /> {r.backToReadings}
        </Button>
      </Link>
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-zinc-500">{topic}</span>
        <Badge className={cn(LEVEL_COLORS[level], "text-xs font-bold")}>{level}</Badge>
      </div>
    </div>
  );

  const dialogs = (
    <>
      <SaveToListDialog
        open={saveItems !== null}
        onOpenChange={(open) => { if (!open) setSaveItems(null); }}
        lists={lists}
        currentListId={saveItems?.length === 1 ? savedMap.get(saveItems[0].english.toLowerCase()) ?? null : null}
        word={saveItems?.length === 1 ? saveItems[0].english : t("vocab.reading.wordsSelected", { n: saveItems?.length ?? 0 })}
        isSaved={saveItems?.length === 1 ? isSaved(saveItems[0].english) : false}
        onSelectList={saveToList}
        onRemove={removeSaved}
        onCreateList={createList}
      />
      {detailsFor && (
        <WordDetailsDialog
          open
          onOpenChange={(open) => { if (!open) setDetailsFor(null); }}
          word={detailsFor.word}
          level={detailsFor.level}
          onSpeak={speakWord}
        />
      )}
    </>
  );

  // ── SAVING ──
  if (phase === "saving") {
    return (
      <div className="paper-bg min-h-[calc(100dvh-4rem)] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-zinc-500">{r.saving}</p>
      </div>
    );
  }

  // ── QUIZ ──
  if (phase === "quiz") {
    return (
      <div className="paper-bg min-h-[calc(100dvh-4rem)]">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
          {header}
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {r.quizTitle}
          </h1>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
            <div className="lg:order-2 lg:sticky lg:top-24">
              <ReadingQuiz questions={content.questions} onFinish={finishQuiz} />
            </div>
            <div className="lg:order-1 space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden w-full gap-2"
                onClick={() => setShowTextInQuiz((v) => !v)}
              >
                <BookOpen className="h-4 w-4" /> {showTextInQuiz ? r.hideText : r.showText}
              </Button>
              <div
                className={cn(
                  "rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-900/70 p-6 sm:pl-12 shadow-sm",
                  showTextInQuiz ? "block" : "hidden lg:block",
                )}
              >
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">{title}</h2>
                <ReadingPassage paragraphs={content.paragraphs} targetWords={content.targetWords} highlight={false} interactive={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ──
  if (phase === "results" && result) {
    const pct = result.total > 0 ? result.score / result.total : 0;
    const emoji = pct === 1 ? "🏆" : pct >= 0.75 ? "🎯" : pct >= 0.5 ? "📚" : "💪";

    const wordRow = (key: string, item: SaveItem, definition?: string, fromList?: boolean) => {
      const saved = isSaved(item.english);
      return (
        <li key={key} className="flex items-start gap-3 py-3">
          <button
            type="button"
            onClick={() => speakWord(item.english)}
            className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center hover:bg-amber-200"
            aria-label="Pronounce"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.english}</span>
              <span className="text-zinc-400"> — </span>
              <span className="text-brand font-medium">{item.translation}</span>
              {fromList && (
                <span className="ml-2 rounded-full bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                  {r.fromList}
                </span>
              )}
            </p>
            {definition && <p className="text-xs text-zinc-500 mt-0.5">{definition}</p>}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSaveItems([item])}
            className={cn("h-8 gap-1.5 shrink-0", saved ? "text-amber-600" : "text-zinc-500")}
          >
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            <span className="hidden sm:inline">{saved ? r.saved : r.save}</span>
          </Button>
        </li>
      );
    };

    const answerText = (i: number): string => {
      const q = content.questions[i];
      const a = result.answers[i];
      if (a === null || a === undefined || a === "") return r.noAnswer;
      if (q.type === "find") return String(a);
      return typeof a === "number" ? q.options[a] ?? r.noAnswer : r.noAnswer;
    };

    return (
      <div className="paper-bg min-h-[calc(100dvh-4rem)]">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 space-y-6">
          {header}

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center space-y-4 shadow-sm">
            <div className="text-5xl">{emoji}</div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{r.resultsTitle}</p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
            </div>
            <div className="flex flex-wrap items-stretch justify-center gap-3">
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 px-5 py-3 min-w-[6.5rem]">
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{result.score}/{result.total}</p>
                <p className="text-xs text-zinc-500">{r.score}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">{r.keyWordsTitle}</h2>
              <Button
                size="sm"
                onClick={() => setSaveItems(unsavedItems)}
                disabled={unsavedItems.length === 0}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700"
              >
                {unsavedItems.length === 0 ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                {unsavedItems.length === 0 ? r.allSaved : `${r.saveAll} (${unsavedItems.length})`}
              </Button>
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {content.targetWords.map((tw, i) => wordRow(tw.word, keyWordItems[i], tw.definition, tw.fromList))}
            </ul>

            {lookedUpExtra.length > 0 && (
              <>
                <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50 mt-6 mb-1">{r.lookedUpTitle}</h2>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {lookedUpExtra.map((l) => wordRow(`${l.word}|${l.paragraph}|${l.sentence}`, lookupItem(l), l.definition))}
                </ul>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">{r.reviewTitle}</h2>
            <ol className="space-y-3">
              {content.questions.map((q, i) => {
                const ok = isAnswerCorrect(q, result.answers[i] ?? null);
                const prompt = q.type === "find" ? q.clue : q.question;
                const right = q.type === "find" ? q.answer : q.options[q.answer];
                return (
                  <li key={i} className="flex gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 p-3">
                    {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" /> : <XCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />}
                    <div className="min-w-0 space-y-1 text-sm">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{prompt}</p>
                      <p className={ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {r.yourAnswer}: {answerText(i)}
                      </p>
                      {!ok && (
                        <p className="text-zinc-700 dark:text-zinc-300">
                          {r.correctAnswer}: <strong>{right}</strong>
                        </p>
                      )}
                      {q.explanation && <p className="text-xs text-zinc-500">{q.explanation}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/vocabulary/reading" className="block">
              <Button className="w-full gap-2 h-11 bg-amber-600 hover:bg-amber-700">
                <RotateCcw className="h-4 w-4" /> {r.newReading}
              </Button>
            </Link>
            <Button variant="outline" className="w-full gap-2 h-11" onClick={() => setPhase("read")}>
              <BookOpen className="h-4 w-4" /> {r.reread}
            </Button>
          </div>
        </div>
        {dialogs}
      </div>
    );
  }

  // ── READ ──
  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <div className={cn("mx-auto max-w-6xl px-4 py-6 sm:py-8", selected && "pb-[22rem] lg:pb-8")}>
        {header}

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <main className="space-y-6 min-w-0">
            <header className="space-y-4">
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                {title}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleAloud} className="gap-1.5">
                  {aloud ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-4 w-4" />}
                  {aloud ? r.stop : r.listen}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHighlight((h) => !h)}
                  aria-pressed={highlight}
                  className={cn("gap-1.5", highlight && "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200")}
                >
                  <Highlighter className="h-4 w-4" /> {r.highlightKeyWords}
                </Button>
              </div>
              <p className="flex items-start gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <MousePointerClick className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" /> {r.tapHint}
              </p>
            </header>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-900/70 px-5 py-6 sm:px-10 sm:pl-14 sm:py-10 shadow-sm">
              <ReadingPassage
                paragraphs={content.paragraphs}
                targetWords={content.targetWords}
                highlight={highlight}
                interactive
                lookedUp={lookedUpKeys}
                selectedKey={selectedKey}
                onWordTap={onWordTap}
              />
            </div>

            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                {r.discoveredTitle} {discovered.length > 0 && <span className="text-zinc-400">({discovered.length})</span>}
              </h2>
              {discovered.length === 0 ? (
                <p className="text-sm text-zinc-400">{r.discoveredEmpty}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {discovered.map((l) => (
                    <button
                      key={`${l.word}|${l.paragraph}|${l.sentence}`}
                      type="button"
                      onClick={() => setSelected({ word: l.word, paragraph: l.paragraph, sentence: l.sentence, target: null })}
                      className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1 text-xs hover:border-amber-400 transition-colors"
                    >
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{l.lemma}</span>
                      <span className="text-zinc-400"> · </span>
                      <span className="text-brand">{l.translation}</span>
                      {isSaved(l.lemma) && <BookmarkCheck className="inline h-3 w-3 ml-1 text-amber-500" />}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <Button
              onClick={result ? () => setPhase("results") : startQuiz}
              size="lg"
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {result ? r.seeResults : r.toQuiz} <ArrowRight className="h-4 w-4" />
            </Button>
          </main>

          <aside className="hidden lg:block sticky top-24">
            {panel ?? (
              <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-5 text-sm text-zinc-500 dark:text-zinc-400 space-y-2">
                <MousePointerClick className="h-5 w-5 text-amber-500" />
                <p>{r.tapHint}</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {panel && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-h-[60dvh] overflow-y-auto rounded-2xl">{panel}</div>
        </div>
      )}

      {dialogs}
    </div>
  );
}
