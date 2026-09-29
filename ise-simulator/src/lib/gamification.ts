/**
 * Gamification for the Quests mode — shared client/server helpers.
 * XP powers levels; a daily streak + goal drives habit; achievements and a
 * weekly leaderboard add motivation. Scoring stays separate from exam grading.
 */

export const XP_PER_CORRECT = 10;
export const QUEST_COMPLETE_BONUS = 5;
/** Safety cap so a single quest can never award a silly amount of XP. */
export const MAX_QUEST_XP = 250;
export const DEFAULT_DAILY_GOAL = 30;

/** Total cumulative XP required to REACH a given level (level 1 = 0 XP). */
export function totalXpForLevel(level: number): number {
  const n = Math.max(1, level);
  return 25 * (n - 1) * n; // L1=0, L2=50, L3=150, L4=300, L5=500, L6=750…
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number; // 0-1 toward next level
}

export function levelFromXp(xp: number): LevelInfo {
  const x = Math.max(0, xp);
  let level = 1;
  while (totalXpForLevel(level + 1) <= x) level++;
  const base = totalXpForLevel(level);
  const next = totalXpForLevel(level + 1);
  const span = next - base;
  const into = x - base;
  return {
    level,
    xpIntoLevel: into,
    xpForNextLevel: span,
    progress: span > 0 ? into / span : 0,
  };
}

/** Monday (UTC) of the week containing `d`, as a YYYY-MM-DD Date at 00:00 UTC. */
export function weekStart(d = new Date()): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

/** Midnight-UTC date for `d` (used to compare calendar days for streaks). */
export function dayStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / 86_400_000);
}

/** Persistent stats shape used to evaluate achievements (subset of the DB row). */
export interface StatsForAchievements {
  xp: number;
  longestStreak: number;
  totalCorrect: number;
  questsDone: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  check: (s: StatsForAchievements & { level: number }) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_quest", name: "First steps", description: "Complete your first quest", emoji: "🌱", check: (s) => s.questsDone >= 1 },
  { id: "streak_3", name: "On a roll", description: "Reach a 3-day streak", emoji: "🔥", check: (s) => s.longestStreak >= 3 },
  { id: "streak_7", name: "Committed", description: "Reach a 7-day streak", emoji: "⚡", check: (s) => s.longestStreak >= 7 },
  { id: "streak_30", name: "Unstoppable", description: "Reach a 30-day streak", emoji: "🏆", check: (s) => s.longestStreak >= 30 },
  { id: "level_5", name: "Rising star", description: "Reach level 5", emoji: "⭐", check: (s) => s.level >= 5 },
  { id: "level_10", name: "Word wizard", description: "Reach level 10", emoji: "🧙", check: (s) => s.level >= 10 },
  { id: "words_100", name: "Century", description: "Answer 100 words correctly", emoji: "💯", check: (s) => s.totalCorrect >= 100 },
  { id: "words_500", name: "Vocabulary vault", description: "Answer 500 words correctly", emoji: "📚", check: (s) => s.totalCorrect >= 500 },
  { id: "xp_1000", name: "Grinder", description: "Earn 1,000 XP", emoji: "💪", check: (s) => s.xp >= 1000 },
  { id: "quests_25", name: "Quest master", description: "Complete 25 quests", emoji: "🎯", check: (s) => s.questsDone >= 25 },
];

export function unlockedAchievementIds(s: StatsForAchievements): string[] {
  const level = levelFromXp(s.xp).level;
  return ACHIEVEMENTS.filter((a) => a.check({ ...s, level })).map((a) => a.id);
}
