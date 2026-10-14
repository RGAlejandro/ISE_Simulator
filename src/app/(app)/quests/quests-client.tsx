"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";
import { useEnglishTTS } from "@/hooks/use-english-tts";
import { SCORE_TO_LEVEL, levelToStartScore, type CefrBand } from "@/lib/prompts/vocabulary";
import { ACHIEVEMENTS } from "@/lib/gamification";
import type { VocabCard } from "@/types";
import {
  Flame, Zap, Trophy, Heart, ArrowLeft, ArrowRight, Loader2, Volume2,
  Check, X, Crown, Target, Sparkles, RotateCcw, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

type View = "hub" | "loading" | "play" | "results";
type Category = "words" | "phrasal_verbs" | "idioms";
type QType = "translate" | "reverse" | "listen";

interface Question {
  type: QType;
  prompt: string;
  audio?: string;
  options: string[];
  answer: number;
}

interface Stats {
  xp: number; level: number; xpIntoLevel: number; xpForNextLevel: number; progress: number;
  currentStreak: number; longestStreak: number; todayXp: number; dailyGoal: number;
  totalCorrect: number; questsDone: number; achievements: string[];
}

interface LeaderEntry { rank: number; name: string; xp: number; isCurrentUser: boolean }

interface AwardResult {
  xpGained: number; level: number; leveledUp: boolean; currentStreak: number;
  todayXp: number; dailyGoal: number;
  newAchievements: { id: string; name: string; description: string; emoji: string }[];
}

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: "words", label: "Words", emoji: "🔤" },
  { id: "phrasal_verbs", label: "Phrasal verbs", emoji: "🔗" },
  { id: "idioms", label: "Idioms", emoji: "💬" },
];
const QUEST_SIZE = 8;
const START_LIVES = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(cards: VocabCard[]): Question[] {
  const usable = cards.filter((c) => c.english && c.translation);
  const types: QType[] = ["translate", "reverse", "listen"];
  return usable.slice(0, QUEST_SIZE).map((card, i) => {
    const type = types[i % types.length];
    const others = usable.filter((c) => c.english !== card.english);
    const distractPool = shuffle(others).slice(0, 3);
    if (type === "translate") {
      const options = shuffle([card.translation, ...distractPool.map((c) => c.translation)]);
      return { type, prompt: card.english, options, answer: options.indexOf(card.translation) };
    }
    // reverse & listen both answer with the English word
    const options = shuffle([card.english, ...distractPool.map((c) => c.english)]);
    return {
      type,
      prompt: type === "listen" ? "" : card.translation,
      audio: type === "listen" ? card.english : undefined,
      options,
      answer: options.indexOf(card.english),
    };
  });
}

export function QuestsClient() {
  const { locale } = useI18n();
  const { speak } = useEnglishTTS();

  const [view, setView] = useState<View>("hub");
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ entries: LeaderEntry[]; me: LeaderEntry | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // quest config
  const [level, setLevel] = useState<CefrBand>("B2");
  const [category, setCategory] = useState<Category>("words");

  // quest run state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [award, setAward] = useState<AwardResult | null>(null);
  const answeredRef = useRef(0);

  const loadStats = useCallback(async () => {
    try {
      const [s, lb] = await Promise.all([
        fetch("/api/gamification").then((r) => r.json()),
        fetch("/api/gamification/leaderboard").then((r) => r.json()),
      ]);
      setStats(s);
      setLeaderboard({ entries: lb.entries ?? [], me: lb.me ?? null });
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const startQuest = async () => {
    setView("loading");
    setError(null);
    try {
      const score = levelToStartScore(level);
      const seen: string[] = [];
      const collected: VocabCard[] = [];
      // Two batches of 5 → ~10 cards for an 8-question quest.
      for (let i = 0; i < 2; i++) {
        const res = await fetch("/api/vocabulary/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score, alreadySeen: seen, locale, category }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate");
        for (const c of data.cards as VocabCard[]) { collected.push(c); seen.push(c.english); }
      }
      const qs = buildQuestions(collected);
      if (qs.length < 4) throw new Error("Couldn't build a quest. Try again.");
      setQuestions(qs);
      setQIndex(0);
      setSelected(null);
      setCorrectCount(0);
      setLives(START_LIVES);
      answeredRef.current = 0;
      setView("play");
      // Pre-play first listen question
      if (qs[0].audio) setTimeout(() => speak(qs[0].audio!), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start quest");
      setView("hub");
    }
  };

  const answer = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    answeredRef.current += 1;
    const ok = i === questions[qIndex].answer;
    if (ok) setCorrectCount((c) => c + 1);
    else setLives((l) => l - 1);
  };

  const finishQuest = useCallback(async (correct: number, total: number) => {
    setView("results");
    try {
      const res = await fetch("/api/gamification/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct, total }),
      });
      const data = await res.json();
      if (res.ok) setAward(data);
      loadStats();
    } catch {
      /* leave award null */
    }
  }, [loadStats]);

  const next = () => {
    const outOfLives = lives <= 0;
    const last = qIndex >= questions.length - 1;
    if (outOfLives || last) {
      finishQuest(correctCount, answeredRef.current);
      return;
    }
    const ni = qIndex + 1;
    setQIndex(ni);
    setSelected(null);
    if (questions[ni]?.audio) setTimeout(() => speak(questions[ni].audio!), 200);
  };

  // ───────── RESULTS ─────────
  if (view === "results") {
    const total = answeredRef.current || 1;
    const pct = Math.round((correctCount / total) * 100);
    return (
      <div className="paper-bg min-h-[calc(100dvh-4rem)] flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-xl"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.6 }}
            className="text-6xl mb-2"
          >
            {pct >= 80 ? "🎉" : pct >= 50 ? "💪" : "📖"}
          </motion.div>
          <h2 className="text-2xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Quest complete!
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {correctCount} / {total} correct
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat icon={<Zap className="h-4 w-4" />} value={award ? `+${award.xpGained}` : "…"} label="XP" tone="text-sky-600 dark:text-sky-400" />
            <Stat icon={<Flame className="h-4 w-4" />} value={award ? String(award.currentStreak) : "…"} label="Streak" tone="text-orange-500" />
            <Stat icon={<Star className="h-4 w-4" />} value={award ? String(award.level) : "…"} label="Level" tone="text-amber-500" />
          </div>

          {award?.leveledUp && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              ⭐ Level up! You reached level {award.level}
            </motion.div>
          )}

          {award && award.newAchievements.length > 0 && (
            <div className="mt-4 space-y-2">
              {award.newAchievements.map((a) => (
                <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 px-3 py-2 text-left">
                  <span className="text-2xl">{a.emoji}</span>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{a.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{a.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => setView("hub")}>
              <ArrowLeft className="h-4 w-4" /> Hub
            </Button>
            <Button className="flex-1 gap-2 bg-sky-600 hover:bg-sky-700" onClick={startQuest}>
              <RotateCcw className="h-4 w-4" /> New quest
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ───────── PLAY ─────────
  if (view === "play" && questions[qIndex]) {
    const q = questions[qIndex];
    const answered = selected !== null;
    return (
      <div className="paper-bg min-h-[calc(100dvh-4rem)]">
        <div className="mx-auto max-w-xl px-4 sm:px-6 py-6">
          {/* Top bar: progress + lives */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView("hub")} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <X className="h-5 w-5" />
            </button>
            <div className="flex-1 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-sky-500"
                animate={{ width: `${(qIndex / questions.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-1 text-rose-500">
              <Heart className="h-4 w-4 fill-rose-500" />
              <span className="text-sm font-bold tabular-nums">{lives}</span>
            </div>
          </div>

          {/* Prompt */}
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-wide font-semibold text-zinc-400 mb-3">
              {q.type === "translate" ? "Translate to your language" : q.type === "reverse" ? "Which English word?" : "Listen and choose"}
            </p>
            {q.type === "listen" ? (
              <button
                onClick={() => q.audio && speak(q.audio)}
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-lg shadow-sky-600/20"
              >
                <Volume2 className="h-9 w-9" />
              </button>
            ) : (
              <p className="text-3xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 break-words">
                {q.prompt}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="grid gap-3">
            {q.options.map((opt, i) => {
              const isAnswer = i === q.answer;
              const isPicked = i === selected;
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={answered}
                  className={cn(
                    "flex items-center justify-between rounded-xl border-2 px-4 py-3.5 text-left text-sm font-medium transition-all",
                    !answered && "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-sky-400 dark:hover:border-sky-600",
                    answered && isAnswer && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200",
                    answered && isPicked && !isAnswer && "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200",
                    answered && !isAnswer && !isPicked && "opacity-60",
                  )}
                >
                  {opt}
                  {answered && isAnswer && <Check className="h-4 w-4 text-emerald-600" />}
                  {answered && isPicked && !isAnswer && <X className="h-4 w-4 text-rose-600" />}
                </button>
              );
            })}
          </div>

          {/* Continue */}
          <AnimatePresence>
            {answered && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                <Button onClick={next} className="w-full gap-2 bg-sky-600 hover:bg-sky-700">
                  {lives <= 0 || qIndex >= questions.length - 1 ? "See results" : "Continue"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ───────── LOADING ─────────
  if (view === "loading") {
    return (
      <div className="paper-bg min-h-[calc(100dvh-4rem)] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <p className="text-sm text-zinc-500">Building your quest…</p>
      </div>
    );
  }

  // ───────── HUB ─────────
  return (
    <div className="paper-bg min-h-[calc(100dvh-4rem)]">
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/practice" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-4">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to practice
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Quests</h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Short vocabulary quests. Earn XP, keep your streak, climb the weekly leaderboard.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
        )}

        {/* Stats header */}
        <div className="grid grid-cols-3 gap-3">
          <HubStat
            icon={<Star className="h-5 w-5" />} tone="text-amber-500"
            value={stats ? `Lvl ${stats.level}` : "—"}
            sub={stats ? `${stats.xpIntoLevel}/${stats.xpForNextLevel} XP` : ""}
            progress={stats?.progress ?? 0}
          />
          <HubStat
            icon={<Flame className="h-5 w-5" />} tone="text-orange-500"
            value={stats ? `${stats.currentStreak}` : "—"}
            sub="day streak"
          />
          <HubStat
            icon={<Target className="h-5 w-5" />} tone="text-sky-500"
            value={stats ? `${stats.todayXp}/${stats.dailyGoal}` : "—"}
            sub="daily goal"
            progress={stats ? Math.min(1, stats.todayXp / stats.dailyGoal) : 0}
          />
        </div>

        {/* Start quest */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-3">Start a quest</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Level</p>
              <div className="grid grid-cols-6 gap-2">
                {SCORE_TO_LEVEL.map((b) => (
                  <button
                    key={b.cefr}
                    onClick={() => setLevel(b.cefr)}
                    className={cn(
                      "rounded-lg py-2 text-sm font-bold border-2 transition-all",
                      level === b.cefr
                        ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300",
                    )}
                  >
                    {b.cefr}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Category</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "rounded-xl py-3 flex flex-col items-center gap-1 border-2 transition-all",
                      category === c.id
                        ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300",
                    )}
                  >
                    <span className="text-lg">{c.emoji}</span>
                    <span className="text-xs font-semibold">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={startQuest} size="lg" className="w-full gap-2 bg-sky-600 hover:bg-sky-700">
              <Sparkles className="h-4 w-4" /> Start quest ({QUEST_SIZE} questions)
            </Button>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-1 flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" /> Weekly leaderboard
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Resets every Monday. Top XP this week.</p>
          {leaderboard && leaderboard.entries.length > 0 ? (
            <ul className="space-y-1.5">
              {leaderboard.entries.slice(0, 8).map((e) => <LeaderRow key={e.rank} e={e} />)}
              {leaderboard.me && !leaderboard.entries.some((x) => x.isCurrentUser) && (
                <>
                  <li className="text-center text-xs text-zinc-400 py-1">···</li>
                  <LeaderRow e={leaderboard.me} />
                </>
              )}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No XP yet this week. Be the first — start a quest!</p>
          )}
        </div>

        {/* Achievements */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-4">Achievements</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = stats?.achievements.includes(a.id);
              return (
                <div
                  key={a.id}
                  title={a.description}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all",
                    unlocked
                      ? "border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30"
                      : "border-zinc-200 dark:border-zinc-800 opacity-50 grayscale",
                  )}
                >
                  <span className="text-2xl">{a.emoji}</span>
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 leading-tight">{a.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
      <div className={cn("flex justify-center mb-1", tone)}>{icon}</div>
      <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
    </div>
  );
}

function HubStat({ icon, value, sub, tone, progress }: {
  icon: React.ReactNode; value: string; sub: string; tone: string; progress?: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className={cn("flex items-center gap-2", tone)}>{icon}
        <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</span>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{sub}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-current opacity-80" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function LeaderRow({ e }: { e: LeaderEntry }) {
  const medal = e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : null;
  return (
    <li className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2",
      e.isCurrentUser ? "bg-sky-50 dark:bg-sky-950/40 ring-1 ring-sky-200 dark:ring-sky-900" : "",
    )}>
      <span className="w-6 text-center text-sm font-bold text-zinc-500 tabular-nums">{medal ?? e.rank}</span>
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {e.name}{e.isCurrentUser && <span className="text-sky-600 dark:text-sky-400"> (you)</span>}
      </span>
      <span className="text-sm font-bold tabular-nums text-zinc-700 dark:text-zinc-300">{e.xp} XP</span>
    </li>
  );
}
