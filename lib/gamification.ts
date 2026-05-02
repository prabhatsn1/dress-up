/**
 * gamification.ts
 *
 * XP model, badge definitions, streak tracking, and weekly challenges.
 *
 * Design:
 * - All state stored locally in SQLite via local-db helpers (offline-first).
 * - XP is awarded for engagement actions; level is derived from XP thresholds.
 * - Badges are one-time awards stored in earned_badges table.
 * - Weekly challenges rotate every Monday and are stored per-week in SQLite.
 * - All write paths return the updated GamificationState so callers can react.
 */

import * as Crypto from "expo-crypto";

import {
  getEarnedBadgeIds,
  getGamificationState,
  getWeeklyChallengesForWeek,
  insertEarnedBadge,
  saveGamificationState,
  upsertWeeklyChallenge,
  type GamificationState,
  type WeeklyChallengeRow,
} from "@/lib/local-db";
import type { OutfitLog } from "@/lib/local-db";

// ─── XP Events ───────────────────────────────────────────────────────────────

export const XP_EVENTS = {
  LOG_OUTFIT: 10,
  RATE_OUTFIT: 5,
  STREAK_3: 15, // bonus on top of LOG_OUTFIT at 3-day streak
  STREAK_7: 25, // bonus on top of LOG_OUTFIT at 7-day streak
  STREAK_14: 40, // bonus on top of LOG_OUTFIT at 14-day streak
  STREAK_30: 60, // bonus on top of LOG_OUTFIT at 30-day streak
  EARN_BADGE: 30,
  COMPLETE_CHALLENGE: 50,
  OUTFIT_5_ITEMS: 5, // bonus when logging 5+ items
} as const;

// ─── Level thresholds ─────────────────────────────────────────────────────────

const LEVEL_THRESHOLDS: number[] = [
  0, // Level 1
  100, // Level 2
  250, // Level 3
  500, // Level 4
  900, // Level 5
  1400, // Level 6
  2000, // Level 7
  2700, // Level 8
  3500, // Level 9
  4400, // Level 10
];

export function xpToLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function xpForNextLevel(currentXp: number): {
  threshold: number;
  nextThreshold: number;
  level: number;
} {
  const level = xpToLevel(currentXp);
  const idx = level - 1; // current level index
  const threshold = LEVEL_THRESHOLDS[idx] ?? 0;
  const nextThreshold =
    LEVEL_THRESHOLDS[idx + 1] ??
    threshold + 600 + (level - LEVEL_THRESHOLDS.length) * 300;
  return { threshold, nextThreshold, level };
}

// ─── Badge Definitions ────────────────────────────────────────────────────────

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // MaterialIcons name
  xpReward: number;
  category: "streak" | "variety" | "engagement" | "achievement";
}

export const BADGES: BadgeDefinition[] = [
  // ── Streak badges ──
  {
    id: "streak_1",
    name: "First Step",
    description: "Log your first outfit",
    icon: "checkroom",
    xpReward: 30,
    category: "streak",
  },
  {
    id: "streak_3",
    name: "Three's a Charm",
    description: "Maintain a 3-day outfit streak",
    icon: "local-fire-department",
    xpReward: 30,
    category: "streak",
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Log outfits 7 days in a row",
    icon: "military-tech",
    xpReward: 30,
    category: "streak",
  },
  {
    id: "streak_14",
    name: "Fortnight Fashion",
    description: "Keep a 14-day streak going",
    icon: "workspace-premium",
    xpReward: 30,
    category: "streak",
  },
  {
    id: "streak_30",
    name: "Month Maven",
    description: "Log outfits every day for 30 days",
    icon: "emoji-events",
    xpReward: 30,
    category: "streak",
  },
  // ── Variety badges ──
  {
    id: "variety_occasions_4",
    name: "Occasion Pro",
    description: "Log outfits for 4 different occasions",
    icon: "diversity-3",
    xpReward: 30,
    category: "variety",
  },
  {
    id: "variety_formality_all",
    name: "Style Chameleon",
    description: "Wear all formality levels in one week",
    icon: "auto-awesome",
    xpReward: 30,
    category: "variety",
  },
  {
    id: "variety_colors_5",
    name: "Color Mixer",
    description: "Log outfits with 5 distinct color palettes",
    icon: "palette",
    xpReward: 30,
    category: "variety",
  },
  // ── Engagement badges ──
  {
    id: "engage_rate_10",
    name: "Critic's Eye",
    description: "Rate 10 outfits",
    icon: "star",
    xpReward: 30,
    category: "engagement",
  },
  {
    id: "engage_log_25",
    name: "Outfit Historian",
    description: "Log 25 outfit entries",
    icon: "history",
    xpReward: 30,
    category: "engagement",
  },
  {
    id: "engage_log_100",
    name: "Wardrobe Legend",
    description: "Log 100 outfit entries",
    icon: "diamond",
    xpReward: 30,
    category: "engagement",
  },
  // ── Achievement badges ──
  {
    id: "achieve_challenge_1",
    name: "Challenger",
    description: "Complete your first weekly challenge",
    icon: "flag",
    xpReward: 30,
    category: "achievement",
  },
  {
    id: "achieve_challenge_3",
    name: "Challenge Champion",
    description: "Complete 3 weekly challenges",
    icon: "shield",
    xpReward: 30,
    category: "achievement",
  },
  {
    id: "achieve_level_5",
    name: "Stylist Pro",
    description: "Reach Level 5",
    icon: "verified",
    xpReward: 30,
    category: "achievement",
  },
];

export const BADGE_MAP = new Map(BADGES.map((b) => [b.id, b]));

// ─── Weekly Challenge Templates ───────────────────────────────────────────────

export interface ChallengeTemplate {
  key: string;
  title: string;
  description: string;
  xpReward: number;
  target: number;
  /** Called with a fresh outfit log to check if it counts toward the challenge. */
  matches: (log: OutfitLog) => boolean;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    key: "log_7_days",
    title: "Daily Dresser",
    description: "Log an outfit every day this week",
    xpReward: 75,
    target: 7,
    matches: () => true,
  },
  {
    key: "log_5_days",
    title: "Five-Day Fashionista",
    description: "Log outfits on 5 different days this week",
    xpReward: 60,
    target: 5,
    matches: () => true,
  },
  {
    key: "formal_outfits_2",
    title: "Power Dressing",
    description: "Log 2 formal or smart outfits this week",
    xpReward: 50,
    target: 2,
    matches: (log) => log.formality === "formal" || log.formality === "smart",
  },
  {
    key: "casual_outfits_3",
    title: "Weekend Vibes",
    description: "Log 3 casual outfits this week",
    xpReward: 50,
    target: 3,
    matches: (log) =>
      log.formality === "casual" || log.formality === "athleisure",
  },
  {
    key: "rated_outfits_3",
    title: "Rate Your Look",
    description: "Rate 3 outfits this week",
    xpReward: 40,
    target: 3,
    matches: (log) => log.rating != null,
  },
  {
    key: "five_star_outfit",
    title: "Perfect 10",
    description: "Log and rate an outfit 5 stars",
    xpReward: 60,
    target: 1,
    matches: (log) => log.rating === 5,
  },
  {
    key: "big_outfit_3",
    title: "Full Look",
    description: "Log 3 outfits with 4+ items each",
    xpReward: 55,
    target: 3,
    matches: (log) => log.itemIds.length >= 4,
  },
  {
    key: "multi_occasion_3",
    title: "Occasion Master",
    description: "Log outfits for 3 different occasions",
    xpReward: 65,
    target: 3,
    matches: () => true, // evaluated with distinct-occasions logic in updateChallengesForLog
  },
];

// ─── Streak helpers ───────────────────────────────────────────────────────────

/** Returns ISO date string "YYYY-MM-DD" for today in local time. */
export function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Returns the ISO date string for the most recent Monday (week start). */
export function currentWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateDiffDays(a: string, b: string): number {
  return Math.round(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/** Streak bonus XP for the given streak length (on top of LOG_OUTFIT). */
function streakBonus(streak: number): number {
  if (streak >= 30) return XP_EVENTS.STREAK_30;
  if (streak >= 14) return XP_EVENTS.STREAK_14;
  if (streak >= 7) return XP_EVENTS.STREAK_7;
  if (streak >= 3) return XP_EVENTS.STREAK_3;
  return 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GamificationUpdate {
  state: GamificationState;
  xpGained: number;
  newBadges: BadgeDefinition[];
  completedChallenges: WeeklyChallengeRow[];
  streakBroken: boolean;
}

/**
 * Called every time an outfit is logged.
 * Updates streak, awards XP, checks badge eligibility, and updates weekly challenges.
 * Returns a full diff so the UI can animate rewards.
 */
export async function onOutfitLogged(
  log: OutfitLog,
  /** All logs for the current user to evaluate badge counts. */
  allLogs: OutfitLog[],
): Promise<GamificationUpdate> {
  const state = await getGamificationState();
  const earnedIds = new Set(await getEarnedBadgeIds());
  const today = todayDate();

  let xpGained = 0;
  const newBadges: BadgeDefinition[] = [];
  let streakBroken = false;

  // ── 1. Update streak ──────────────────────────────────────────────────────
  let { currentStreak, longestStreak, lastLogDate } = state;

  if (lastLogDate === today) {
    // Already logged today — streak unchanged, no XP bonus
  } else if (lastLogDate && dateDiffDays(today, lastLogDate) === 1) {
    // Consecutive day
    currentStreak += 1;
    longestStreak = Math.max(longestStreak, currentStreak);
  } else if (lastLogDate && dateDiffDays(today, lastLogDate) > 1) {
    // Gap — streak broken
    streakBroken = currentStreak > 0;
    currentStreak = 1;
  } else {
    // First ever log
    currentStreak = 1;
    longestStreak = Math.max(longestStreak, 1);
  }

  // ── 2. Award XP ───────────────────────────────────────────────────────────
  xpGained += XP_EVENTS.LOG_OUTFIT;
  xpGained += streakBonus(currentStreak);
  if (log.itemIds.length >= 5) xpGained += XP_EVENTS.OUTFIT_5_ITEMS;

  // ── 3. Check streak badges ────────────────────────────────────────────────
  const streakBadgeMap: Array<[number, string]> = [
    [1, "streak_1"],
    [3, "streak_3"],
    [7, "streak_7"],
    [14, "streak_14"],
    [30, "streak_30"],
  ];
  for (const [threshold, badgeId] of streakBadgeMap) {
    if (currentStreak >= threshold && !earnedIds.has(badgeId)) {
      const badge = BADGE_MAP.get(badgeId);
      if (badge) {
        await insertEarnedBadge(badgeId);
        earnedIds.add(badgeId);
        xpGained += XP_EVENTS.EARN_BADGE;
        newBadges.push(badge);
      }
    }
  }

  // ── 4. Check engagement / variety badges ─────────────────────────────────
  const totalLogs = allLogs.length + 1; // +1 for the current log

  if (totalLogs >= 1 && !earnedIds.has("streak_1")) {
    const b = BADGE_MAP.get("streak_1")!;
    await insertEarnedBadge("streak_1");
    xpGained += XP_EVENTS.EARN_BADGE;
    newBadges.push(b);
  }

  if (totalLogs >= 25 && !earnedIds.has("engage_log_25")) {
    const b = BADGE_MAP.get("engage_log_25")!;
    await insertEarnedBadge("engage_log_25");
    xpGained += XP_EVENTS.EARN_BADGE;
    newBadges.push(b);
  }

  if (totalLogs >= 100 && !earnedIds.has("engage_log_100")) {
    const b = BADGE_MAP.get("engage_log_100")!;
    await insertEarnedBadge("engage_log_100");
    xpGained += XP_EVENTS.EARN_BADGE;
    newBadges.push(b);
  }

  // Distinct occasions across all logs
  const allLogs_ = [...allLogs, log];
  const distinctOccasions = new Set(
    allLogs_.map((l) => l.occasion).filter(Boolean),
  );
  if (distinctOccasions.size >= 4 && !earnedIds.has("variety_occasions_4")) {
    const b = BADGE_MAP.get("variety_occasions_4")!;
    await insertEarnedBadge("variety_occasions_4");
    xpGained += XP_EVENTS.EARN_BADGE;
    newBadges.push(b);
  }

  // Distinct color palettes (unique first-colors across logs)
  const distinctFirstColors = new Set(
    allLogs_.flatMap((l) => l.colorPalette.slice(0, 1)),
  );
  if (distinctFirstColors.size >= 5 && !earnedIds.has("variety_colors_5")) {
    const b = BADGE_MAP.get("variety_colors_5")!;
    await insertEarnedBadge("variety_colors_5");
    xpGained += XP_EVENTS.EARN_BADGE;
    newBadges.push(b);
  }

  // ── 5. Update weekly challenges ───────────────────────────────────────────
  const completedChallenges = await updateChallengesForLog(log, allLogs_);
  for (const c of completedChallenges) {
    xpGained += c.xpReward;
  }

  // ── 6. Level up check ────────────────────────────────────────────────────
  const newXp = state.xp + xpGained;
  const newLevel = xpToLevel(newXp);

  if (newLevel >= 5 && !earnedIds.has("achieve_level_5")) {
    const b = BADGE_MAP.get("achieve_level_5")!;
    await insertEarnedBadge("achieve_level_5");
    xpGained += XP_EVENTS.EARN_BADGE;
    newBadges.push(b);
  }

  // ── 7. Persist state ──────────────────────────────────────────────────────
  const updatedState: GamificationState = {
    xp: newXp,
    level: newLevel,
    currentStreak,
    longestStreak,
    lastLogDate: today,
  };
  await saveGamificationState(updatedState);

  return {
    state: updatedState,
    xpGained,
    newBadges,
    completedChallenges,
    streakBroken,
  };
}

/**
 * Called after an outfit is rated.
 * Awards rating XP and checks rating-related badges.
 */
export async function onOutfitRated(
  ratedLog: OutfitLog,
  allLogs: OutfitLog[],
): Promise<GamificationUpdate> {
  const state = await getGamificationState();
  const earnedIds = new Set(await getEarnedBadgeIds());
  const newBadges: BadgeDefinition[] = [];
  let xpGained = XP_EVENTS.RATE_OUTFIT;

  // Count rated logs
  const ratedCount = allLogs.filter((l) => l.rating != null).length;

  if (ratedCount >= 10 && !earnedIds.has("engage_rate_10")) {
    const b = BADGE_MAP.get("engage_rate_10")!;
    await insertEarnedBadge("engage_rate_10");
    xpGained += XP_EVENTS.EARN_BADGE;
    newBadges.push(b);
  }

  // Update challenges for rating-based challenges
  const completedChallenges = await updateChallengesForLog(ratedLog, allLogs);
  for (const c of completedChallenges) {
    xpGained += c.xpReward;
  }

  const newXp = state.xp + xpGained;
  const newLevel = xpToLevel(newXp);
  const updatedState: GamificationState = {
    ...state,
    xp: newXp,
    level: newLevel,
  };
  await saveGamificationState(updatedState);

  return {
    state: updatedState,
    xpGained,
    newBadges,
    completedChallenges,
    streakBroken: false,
  };
}

// ─── Weekly challenge management ──────────────────────────────────────────────

/** Returns (creating if needed) the challenges for the current week. */
export async function getOrCreateWeeklyChallenges(): Promise<
  WeeklyChallengeRow[]
> {
  const weekStart = currentWeekStart();
  const existing = await getWeeklyChallengesForWeek(weekStart);
  if (existing.length > 0) return existing;

  // Pick 3 non-overlapping challenges for this week using week-based seed
  const seed = new Date(weekStart).getTime();
  const selected = pickChallengesForWeek(seed, 3);

  const challenges: WeeklyChallengeRow[] = selected.map((template, idx) => ({
    id: Crypto.randomUUID(),
    weekStart,
    challengeKey: template.key,
    title: template.title,
    description: template.description,
    xpReward: template.xpReward,
    target: template.target,
    progress: 0,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  }));

  for (const c of challenges) {
    await upsertWeeklyChallenge(c);
  }
  return challenges;
}

/** Deterministic pseudo-random selection of challenge templates for a given week seed. */
function pickChallengesForWeek(
  seed: number,
  count: number,
): ChallengeTemplate[] {
  const pool = [...CHALLENGE_TEMPLATES];
  const result: ChallengeTemplate[] = [];
  let s = seed;
  while (result.length < count && pool.length > 0) {
    // LCG step for simple determinism
    s = (s * 1664525 + 1013904223) >>> 0;
    const idx = s % pool.length;
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

/**
 * Evaluate this week's challenges against the given log.
 * Returns challenges that became complete for the first time.
 */
async function updateChallengesForLog(
  log: OutfitLog,
  allLogs: OutfitLog[],
): Promise<WeeklyChallengeRow[]> {
  const weekStart = currentWeekStart();
  const challenges = await getOrCreateWeeklyChallenges();
  const earnedIds = new Set(await getEarnedBadgeIds());
  const newlyCompleted: WeeklyChallengeRow[] = [];

  // Pre-compute distinct occasions in this week's logs (for multi-occasion challenge)
  const weekLogs = allLogs.filter((l) => l.wornDate >= weekStart);
  const weekOccasions = new Set(
    weekLogs.map((l) => l.occasion).filter(Boolean),
  );

  for (const challenge of challenges) {
    if (challenge.completed) continue;

    const template = CHALLENGE_TEMPLATES.find(
      (t) => t.key === challenge.challengeKey,
    );
    if (!template) continue;

    let newProgress = challenge.progress;

    if (challenge.challengeKey === "multi_occasion_3") {
      // Progress = distinct occasions logged this week
      newProgress = weekOccasions.size;
    } else if (
      challenge.challengeKey === "log_7_days" ||
      challenge.challengeKey === "log_5_days"
    ) {
      // Progress = distinct days logged this week
      const distinctDays = new Set(weekLogs.map((l) => l.wornDate));
      newProgress = distinctDays.size;
    } else if (challenge.challengeKey === "rated_outfits_3") {
      // Progress = count of rated outfits this week
      newProgress = weekLogs.filter((l) => l.rating != null).length;
    } else if (template.matches(log)) {
      newProgress = challenge.progress + 1;
    }

    const nowComplete = newProgress >= challenge.target;
    const updated: WeeklyChallengeRow = {
      ...challenge,
      progress: Math.min(newProgress, challenge.target),
      completed: nowComplete,
      completedAt:
        nowComplete && !challenge.completed
          ? new Date().toISOString()
          : challenge.completedAt,
    };
    await upsertWeeklyChallenge(updated);

    if (nowComplete && !challenge.completed) {
      newlyCompleted.push(updated);

      // Check challenge completion badges
      const allCompleted = (await getWeeklyChallengesForWeek(weekStart)).filter(
        (c) => c.completed,
      );
      const completedCountEver = allCompleted.length;

      if (completedCountEver >= 1 && !earnedIds.has("achieve_challenge_1")) {
        await insertEarnedBadge("achieve_challenge_1");
        earnedIds.add("achieve_challenge_1");
      }
      if (completedCountEver >= 3 && !earnedIds.has("achieve_challenge_3")) {
        await insertEarnedBadge("achieve_challenge_3");
        earnedIds.add("achieve_challenge_3");
      }
    }
  }

  return newlyCompleted;
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

export { getGamificationState } from "@/lib/local-db";
export type { GamificationState } from "@/lib/local-db";

export async function getEarnedBadges(): Promise<BadgeDefinition[]> {
  const ids = await getEarnedBadgeIds();
  return ids.flatMap((id) => {
    const b = BADGE_MAP.get(id);
    return b ? [b] : [];
  });
}
