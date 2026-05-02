/**
 * outfit-log.ts
 *
 * Persists outfit-worn events, drives repeat-outfit detection, and builds
 * the enriched context object fed to future AI recommendations.
 *
 * Storage strategy:
 *   1. SQLite (local-db) is always written first — works offline.
 *   2. Supabase is written opportunistically; failures are non-fatal.
 *   3. All reads for the calendar / repeat-detection come from SQLite so
 *      the app remains fast on poor connections.
 */

import * as Crypto from "expo-crypto";

import {
  buildOutfitKey,
  deleteOutfitLog,
  getOutfitKeyRatings,
  getOutfitLogsByKey,
  getOutfitLogsByMonth,
  getRecentOutfitLogs,
  getTopRatedOutfitLogs,
  insertOutfitLog,
  markOutfitLogSynced,
  updateOutfitLogRating,
  type OutfitItemSnapshot,
  type OutfitLog,
} from "@/lib/local-db";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { OutfitLogInsert, OutfitLogRow } from "@/types/supabase";

export type { OutfitItemSnapshot };

// ─── Re-exports so callers only need one import ───────────────────────────────
export type { OutfitLog };

// ─── Formality ranking helper ────────────────────────────────────────────────

const FORMALITY_RANK: Record<string, number> = {
  festive: 5,
  formal: 4,
  smart: 3,
  athleisure: 2,
  casual: 1,
};

/**
 * Returns the highest-ranked formality present among the supplied items.
 * Falls back to "casual" when the array is empty or all values are unknown.
 */
export function dominantFormality(formalities: string[]): string {
  let best = "casual";
  let bestRank = 0;
  for (const f of formalities) {
    const rank = FORMALITY_RANK[f] ?? 0;
    if (rank > bestRank) {
      best = f;
      bestRank = rank;
    }
  }
  return best;
}

// ─── Repeat-detection configuration ─────────────────────────────────────────

/** Warn if the same item combination was worn within this many days. */
export const REPEAT_WARNING_DAYS = 14;

/** Only raise a warning if the outfit has at least this many items. */
const MIN_ITEMS_FOR_REPEAT_CHECK = 2;

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function mapSupabaseRow(row: OutfitLogRow): OutfitLog {
  return {
    id: row.id,
    userId: row.user_id,
    wornDate: row.worn_date,
    itemIds: row.item_ids,
    outfitKey: row.outfit_key,
    occasion: row.occasion ?? undefined,
    temperatureC: row.temperature_c ?? undefined,
    weatherCondition: row.weather_condition ?? undefined,
    locationName: row.location_name ?? undefined,
    itemSnapshot: row.item_snapshot ?? [],
    colorPalette: row.color_palette ?? [],
    formality: row.formality ?? undefined,
    notes: row.notes ?? undefined,
    rating: row.rating ?? undefined,
    ratingNote: row.rating_note ?? undefined,
    syncedToCloud: true,
    createdAt: row.created_at,
  };
}

async function pushLogToSupabase(log: OutfitLog): Promise<void> {
  const client = supabase;
  if (!isSupabaseConfigured || !client) return;

  const insert: OutfitLogInsert = {
    id: log.id,
    user_id: log.userId,
    worn_date: log.wornDate,
    item_ids: log.itemIds,
    occasion: log.occasion ?? null,
    temperature_c: log.temperatureC ?? null,
    weather_condition: log.weatherCondition ?? null,
    location_name: log.locationName ?? null,
    item_snapshot: log.itemSnapshot,
    color_palette: log.colorPalette,
    formality: log.formality ?? null,
    notes: log.notes ?? null,
  };

  const { error } = await client.from("outfit_logs").upsert(insert);
  if (!error) {
    await markOutfitLogSynced(log.id);
  }
}

async function deleteLogFromSupabase(id: string): Promise<void> {
  const client = supabase;
  if (!isSupabaseConfigured || !client) return;
  await client.from("outfit_logs").delete().eq("id", id);
}

// ─── Core write API ───────────────────────────────────────────────────────────

export interface SaveOutfitLogOptions {
  userId: string;
  /** Wardrobe items that make up the outfit. */
  itemIds: string[];
  wornDate?: string; // ISO date "YYYY-MM-DD"; defaults to today
  occasion?: string;
  temperatureC?: number;
  /** Text label from WeatherSnapshot.condition ("Sunny" | "Cloudy" | "Rain"). */
  weatherCondition?: string;
  /** City name from WeatherSnapshot.location. */
  locationName?: string;
  /** Slim snapshots of each item's key attributes — build this from the live
   *  WardrobeItem list in the caller before passing here. */
  itemSnapshot?: OutfitItemSnapshot[];
  /** Deduped colour list across all worn items. */
  colorPalette?: string[];
  /** Dominant formality of the outfit. */
  formality?: string;
  notes?: string;
}

/**
 * Save an outfit-worn event.  Returns the persisted log record.
 */
export async function saveOutfitLog(
  options: SaveOutfitLogOptions,
): Promise<OutfitLog> {
  const wornDate = options.wornDate ?? new Date().toISOString().slice(0, 10);

  const log: OutfitLog = {
    id: Crypto.randomUUID(),
    userId: options.userId,
    wornDate,
    itemIds: options.itemIds,
    outfitKey: buildOutfitKey(options.itemIds),
    occasion: options.occasion,
    temperatureC: options.temperatureC,
    weatherCondition: options.weatherCondition,
    locationName: options.locationName,
    itemSnapshot: options.itemSnapshot ?? [],
    colorPalette: options.colorPalette ?? [],
    formality: options.formality,
    notes: options.notes,
    syncedToCloud: false,
    createdAt: new Date().toISOString(),
  };

  await insertOutfitLog(log);

  // Fire-and-forget cloud sync
  pushLogToSupabase(log).catch(() => undefined);

  return log;
}

/**
 * Remove a logged outfit (e.g. if user taps "undo").
 */
export async function removeOutfitLog(id: string): Promise<void> {
  await deleteOutfitLog(id);
  deleteLogFromSupabase(id).catch(() => undefined);
}

// ─── Rating API ───────────────────────────────────────────────────────────────

/**
 * Save a 1–5 star rating for a previously logged outfit.
 * Updates SQLite immediately; syncs to Supabase in the background.
 */
export async function rateOutfitLog(
  logId: string,
  rating: number,
  ratingNote?: string,
): Promise<void> {
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }
  await updateOutfitLogRating(logId, rating, ratingNote);
  pushRatingToSupabase(logId, rating, ratingNote).catch(() => undefined);
}

async function pushRatingToSupabase(
  logId: string,
  rating: number,
  ratingNote?: string,
): Promise<void> {
  const client = supabase;
  if (!isSupabaseConfigured || !client) return;
  const { error } = await client
    .from("outfit_logs")
    .update({ rating, rating_note: ratingNote ?? null })
    .eq("id", logId);
  if (!error) {
    await markOutfitLogSynced(logId);
  }
}

/**
 * Returns the top-rated outfit logs for a user.
 * Suitable for the "Top Rated Outfits" profile section.
 *
 * Equivalent Supabase query:
 *   select * from outfit_logs
 *   where user_id = $1 and rating >= $2
 *   order by rating desc, worn_date desc
 *   limit $3;
 */
export async function getTopRatedOutfits(
  userId: string,
  minRating = 4,
  limit = 20,
): Promise<OutfitLog[]> {
  return getTopRatedOutfitLogs(userId, minRating, limit);
}

/**
 * Returns a map of outfitKey → average rating for use in recommendation
 * scoring.  Outfit combos the user has loved get a score boost; disliked
 * combos are penalised.
 */
export async function getOutfitRatingBoosts(
  userId: string,
): Promise<Record<string, number>> {
  return getOutfitKeyRatings(userId);
}

// ─── Read API ─────────────────────────────────────────────────────────────────

/**
 * Returns all logs for a calendar month, keyed by ISO date string for O(1)
 * day look-up in the calendar component.
 *
 *   { "2025-04-03": [OutfitLog, ...], "2025-04-17": [...] }
 */
export async function getLogsForMonth(
  userId: string,
  year: number,
  month: number, // 1-based
): Promise<Record<string, OutfitLog[]>> {
  const logs = await getOutfitLogsByMonth(userId, year, month);
  const map: Record<string, OutfitLog[]> = {};
  for (const log of logs) {
    if (!map[log.wornDate]) map[log.wornDate] = [];
    map[log.wornDate].push(log);
  }
  return map;
}

/**
 * Returns the most-recent N days of logs for use in AI prompts and the
 * repeat-detection guard.
 */
export async function getRecentLogs(
  userId: string,
  days = REPEAT_WARNING_DAYS,
): Promise<OutfitLog[]> {
  return getRecentOutfitLogs(userId, days);
}

// ─── Repeat-outfit detection ──────────────────────────────────────────────────

export interface RepeatWarning {
  /** Human-readable message to surface in the UI */
  message: string;
  /** ISO date when this exact combo was last worn */
  lastWornDate: string;
  /** Days since the duplicate was worn */
  daysAgo: number;
}

/**
 * Checks whether the given set of item IDs has been worn within
 * `withinDays` days.  Returns a warning object, or `null` if no repeat
 * is found.
 *
 * Algorithm:
 *   1. Compute a canonical outfit key by sorting item IDs and joining with '|'.
 *      This makes the check order-independent (same outfit, different tap order).
 *   2. Query the local SQLite index for matching (user, outfit_key, date >= cutoff).
 *   3. If any match exists, return a structured warning.
 *
 * Complexity: O(k log n) where k = number of items, n = rows in the index range.
 */
export async function detectRepeatOutfit(
  userId: string,
  itemIds: string[],
  withinDays = REPEAT_WARNING_DAYS,
): Promise<RepeatWarning | null> {
  if (itemIds.length < MIN_ITEMS_FOR_REPEAT_CHECK) return null;

  const key = buildOutfitKey(itemIds);
  const matches = await getOutfitLogsByKey(userId, key, withinDays);

  if (matches.length === 0) return null;

  const lastLog = matches[0]; // already sorted DESC by worn_date
  const lastDate = new Date(lastLog.wornDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);
  const daysAgo = Math.round(
    (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysAgo === 0) {
    return {
      message: "You already logged this exact outfit today.",
      lastWornDate: lastLog.wornDate,
      daysAgo: 0,
    };
  }

  return {
    message: `You wore this same combination ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago (${formatDate(lastLog.wornDate)}).`,
    lastWornDate: lastLog.wornDate,
    daysAgo,
  };
}

// ─── AI context builder ───────────────────────────────────────────────────────

/**
 * Builds an enriched history context object to include in AI recommendation
 * prompts.  Attach this to the system message alongside the wardrobe manifest
 * so the model knows which items were recently worn and which combos to avoid.
 *
 * Example usage in ai.ts:
 *   const history = await buildAiHistoryContext(userId);
 *   // Inject history.prompt into your ChatGPT / Gemini system prompt.
 */
export interface AiHistoryContext {
  /** Flat list of (date, itemIds, weather, formality) for the last REPEAT_WARNING_DAYS days */
  recentWears: Array<{
    date: string;
    itemIds: string[];
    occasion?: string;
    weatherCondition?: string;
    formality?: string;
    itemSnapshot: OutfitItemSnapshot[];
  }>;
  /** item IDs worn in the past 3 days — tell AI to deprioritise these */
  recentlyWornItemIds: string[];
  /** Outfit keys worn in the past 14 days — tell AI not to repeat these combos */
  recentOutfitKeys: string[];
  /** outfitKey → average rating (1–5). Positive = reinforce, negative = avoid. */
  ratingBoosts: Record<string, number>;
  /** Ready-to-use plain-English paragraph for AI system prompts */
  prompt: string;
}

export async function buildAiHistoryContext(
  userId: string,
): Promise<AiHistoryContext> {
  const [recent, ratingBoosts] = await Promise.all([
    getRecentLogs(userId, REPEAT_WARNING_DAYS),
    getOutfitRatingBoosts(userId),
  ]);

  const recentWears = recent.map((l) => ({
    date: l.wornDate,
    itemIds: l.itemIds,
    occasion: l.occasion,
    weatherCondition: l.weatherCondition,
    formality: l.formality,
    itemSnapshot: l.itemSnapshot,
  }));

  const last3Days = new Date();
  last3Days.setDate(last3Days.getDate() - 3);
  const cutoff3 = last3Days.toISOString().slice(0, 10);

  const recentlyWornItemIds = [
    ...new Set(
      recent.filter((l) => l.wornDate >= cutoff3).flatMap((l) => l.itemIds),
    ),
  ];

  const recentOutfitKeys = [...new Set(recent.map((l) => l.outfitKey))];

  const wearLines = recentWears
    .slice(0, 7)
    .map((w) => {
      const meta = [w.occasion, w.weatherCondition, w.formality]
        .filter(Boolean)
        .join(", ");
      const items =
        w.itemSnapshot.length > 0
          ? w.itemSnapshot.map((s) => s.name).join(", ")
          : w.itemIds.join(", ");
      return `  • ${w.date}${meta ? ` (${meta})` : ""}: ${items}`;
    })
    .join("\n");

  const lovedKeys = Object.entries(ratingBoosts)
    .filter(([, r]) => r >= 4)
    .map(([k]) => k);
  const dislikedKeys = Object.entries(ratingBoosts)
    .filter(([, r]) => r <= 2)
    .map(([k]) => k);

  const ratingLines = [
    lovedKeys.length > 0
      ? `  Loved combos (avg ≥4★): ${lovedKeys.slice(0, 3).join("; ")}`
      : "",
    dislikedKeys.length > 0
      ? `  Disliked combos (avg ≤2★): ${dislikedKeys.slice(0, 3).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt =
    recent.length === 0
      ? "The user has no outfit history yet. Feel free to suggest any combination."
      : [
          `The user's recent outfit history (last ${REPEAT_WARNING_DAYS} days):`,
          wearLines,
          "Avoid repeating outfit combinations worn in this period. Deprioritise items worn in the past 3 days unless specifically requested.",
          ratingLines ? `\nUser rating signals:\n${ratingLines}` : "",
          lovedKeys.length > 0
            ? "Reinforce loved combinations when contextually appropriate."
            : "",
          dislikedKeys.length > 0
            ? "Do not suggest disliked combinations."
            : "",
        ]
          .filter(Boolean)
          .join("\n");

  return {
    recentWears,
    recentlyWornItemIds,
    recentOutfitKeys,
    ratingBoosts,
    prompt,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
