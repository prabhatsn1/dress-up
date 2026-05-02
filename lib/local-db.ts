import * as SQLite from "expo-sqlite";

import type { WardrobeItem } from "@/lib/wardrobe";

// --- Private serialisation helpers ---

function serialise(value: unknown): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function deserialise<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

// --- DB singleton ---

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function initDb(): Promise<void> {
  if (dbInstance) return;
  dbInstance = await SQLite.openDatabaseAsync("wardrobe.db");
  await dbInstance.execAsync(`
    CREATE TABLE IF NOT EXISTS wardrobe_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      subcategory TEXT,
      fit TEXT,
      sleeve TEXT,
      colours TEXT,
      pattern TEXT,
      seasons TEXT,
      occasions TEXT,
      formality TEXT,
      material TEXT,
      image_url TEXT,
      image_storage_path TEXT,
      ai_status TEXT DEFAULT 'idle',
      ai_confidence INTEGER,
      ai_summary TEXT,
      ai_tags TEXT,
      last_worn_days_ago INTEGER DEFAULT 99,
      wear_count INTEGER DEFAULT 0,
      favorite INTEGER DEFAULT 0,
      is_dirty INTEGER DEFAULT 0,
      purchase_price REAL,
      purchase_date TEXT,
      synced_to_cloud INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS outfit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worn_date TEXT NOT NULL,
      item_ids TEXT NOT NULL,
      outfit_key TEXT NOT NULL,
      occasion TEXT,
      temperature_c INTEGER,
      weather_condition TEXT,
      location_name TEXT,
      item_snapshot TEXT NOT NULL DEFAULT '[]',
      color_palette TEXT NOT NULL DEFAULT '[]',
      formality TEXT,
      notes TEXT,
      rating INTEGER,
      rating_note TEXT,
      synced_to_cloud INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS outfit_logs_user_date_idx
      ON outfit_logs (user_id, worn_date DESC);

    CREATE INDEX IF NOT EXISTS outfit_logs_user_key_idx
      ON outfit_logs (user_id, outfit_key, worn_date DESC);

    CREATE TABLE IF NOT EXISTS capsules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'custom',
      description TEXT,
      item_ids TEXT NOT NULL DEFAULT '[]',
      is_challenge INTEGER NOT NULL DEFAULT 0,
      challenge_end_date TEXT,
      challenge_logged_outfit_keys TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gamification_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_log_date TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO gamification_state (id, xp, level, current_streak, longest_streak)
      VALUES (1, 0, 1, 0, 0);

    CREATE TABLE IF NOT EXISTS earned_badges (
      badge_id TEXT PRIMARY KEY,
      earned_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_challenges (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL,
      challenge_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      xp_reward INTEGER NOT NULL DEFAULT 50,
      target INTEGER NOT NULL DEFAULT 1,
      progress INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS weekly_challenges_week_idx
      ON weekly_challenges (week_start DESC);
  `);

  // Schema migration: add new columns to existing databases
  for (const sql of [
    "ALTER TABLE outfit_logs ADD COLUMN rating INTEGER",
    "ALTER TABLE outfit_logs ADD COLUMN rating_note TEXT",
    "ALTER TABLE outfit_logs ADD COLUMN weather_condition TEXT",
    "ALTER TABLE outfit_logs ADD COLUMN location_name TEXT",
    "ALTER TABLE outfit_logs ADD COLUMN item_snapshot TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE outfit_logs ADD COLUMN color_palette TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE outfit_logs ADD COLUMN formality TEXT",
    "ALTER TABLE wardrobe_items ADD COLUMN is_dirty INTEGER DEFAULT 0",
    "ALTER TABLE wardrobe_items ADD COLUMN purchase_price REAL",
    "ALTER TABLE wardrobe_items ADD COLUMN purchase_date TEXT",
  ]) {
    try {
      await dbInstance.execAsync(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }
}

function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    throw new Error("Database not initialised. Call initDb() first.");
  }
  return dbInstance;
}

// --- Internal row type ---

interface WardrobeRow {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  fit: string | null;
  sleeve: string | null;
  colours: string | null;
  pattern: string | null;
  seasons: string | null;
  occasions: string | null;
  formality: string | null;
  material: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_tags: string | null;
  last_worn_days_ago: number | null;
  wear_count: number | null;
  favorite: number | null;
  is_dirty: number | null;
  purchase_price: number | null;
  purchase_date: string | null;
  synced_to_cloud: number | null;
  created_at: string | null;
}

function rowToItem(row: WardrobeRow): WardrobeItem {
  return {
    id: row.id,
    name: row.name,
    category: (row.category ?? "Top") as WardrobeItem["category"],
    subcategory: row.subcategory ?? "",
    fit: (row.fit ?? "regular") as WardrobeItem["fit"],
    sleeve: (row.sleeve ?? undefined) as WardrobeItem["sleeve"],
    colours: deserialise<string[]>(row.colours) ?? [],
    pattern: (row.pattern ?? "solid") as WardrobeItem["pattern"],
    seasons: deserialise<WardrobeItem["seasons"]>(row.seasons) ?? [],
    occasions: deserialise<WardrobeItem["occasions"]>(row.occasions) ?? [],
    formality: (row.formality ?? "casual") as WardrobeItem["formality"],
    material: row.material ?? "",
    imageUrl: row.image_url ?? undefined,
    imageStoragePath: row.image_storage_path ?? undefined,
    aiStatus: (row.ai_status ?? "idle") as WardrobeItem["aiStatus"],
    aiConfidence: row.ai_confidence ?? undefined,
    aiSummary: row.ai_summary ?? undefined,
    aiTags: deserialise<WardrobeItem["aiTags"]>(row.ai_tags),
    lastWornDaysAgo: row.last_worn_days_ago ?? 99,
    wearCount: row.wear_count ?? 0,
    favorite: row.favorite === 1,
    isDirty: row.is_dirty === 1,
    purchasePrice: row.purchase_price ?? undefined,
    purchaseDate: row.purchase_date ?? undefined,
    source: row.synced_to_cloud === 1 ? "supabase" : undefined,
  };
}

// --- Public API ---

export async function getAllItems(): Promise<WardrobeItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<WardrobeRow>(
    "SELECT * FROM wardrobe_items ORDER BY created_at DESC",
  );
  return rows.map(rowToItem);
}

export async function upsertItem(item: WardrobeItem): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO wardrobe_items
      (id, name, category, subcategory, fit, sleeve, colours, pattern, seasons, occasions,
       formality, material, image_url, image_storage_path, ai_status, ai_confidence,
       ai_summary, ai_tags, last_worn_days_ago, wear_count, favorite, is_dirty,
       purchase_price, purchase_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.category,
      item.subcategory,
      item.fit,
      item.sleeve ?? null,
      serialise(item.colours),
      item.pattern,
      serialise(item.seasons),
      serialise(item.occasions),
      item.formality,
      item.material,
      item.imageUrl ?? null,
      item.imageStoragePath ?? null,
      item.aiStatus ?? "idle",
      item.aiConfidence ?? null,
      item.aiSummary ?? null,
      serialise(item.aiTags ?? null),
      item.lastWornDaysAgo,
      item.wearCount,
      item.favorite ? 1 : 0,
      item.isDirty ? 1 : 0,
      item.purchasePrice ?? null,
      item.purchaseDate ?? null,
    ],
  );
}

export async function updateItem(
  id: string,
  fields: Partial<WardrobeItem>,
): Promise<void> {
  const db = getDb();
  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (fields.name !== undefined) {
    updates.push("name = ?");
    params.push(fields.name);
  }
  if (fields.category !== undefined) {
    updates.push("category = ?");
    params.push(fields.category);
  }
  if (fields.subcategory !== undefined) {
    updates.push("subcategory = ?");
    params.push(fields.subcategory);
  }
  if (fields.fit !== undefined) {
    updates.push("fit = ?");
    params.push(fields.fit);
  }
  if ("sleeve" in fields) {
    updates.push("sleeve = ?");
    params.push(fields.sleeve ?? null);
  }
  if (fields.colours !== undefined) {
    updates.push("colours = ?");
    params.push(serialise(fields.colours));
  }
  if (fields.pattern !== undefined) {
    updates.push("pattern = ?");
    params.push(fields.pattern);
  }
  if (fields.seasons !== undefined) {
    updates.push("seasons = ?");
    params.push(serialise(fields.seasons));
  }
  if (fields.occasions !== undefined) {
    updates.push("occasions = ?");
    params.push(serialise(fields.occasions));
  }
  if (fields.formality !== undefined) {
    updates.push("formality = ?");
    params.push(fields.formality);
  }
  if (fields.material !== undefined) {
    updates.push("material = ?");
    params.push(fields.material);
  }
  if ("imageUrl" in fields) {
    updates.push("image_url = ?");
    params.push(fields.imageUrl ?? null);
  }
  if ("imageStoragePath" in fields) {
    updates.push("image_storage_path = ?");
    params.push(fields.imageStoragePath ?? null);
  }
  if ("aiStatus" in fields) {
    updates.push("ai_status = ?");
    params.push(fields.aiStatus ?? null);
  }
  if ("aiConfidence" in fields) {
    updates.push("ai_confidence = ?");
    params.push(fields.aiConfidence ?? null);
  }
  if ("aiSummary" in fields) {
    updates.push("ai_summary = ?");
    params.push(fields.aiSummary ?? null);
  }
  if ("aiTags" in fields) {
    updates.push("ai_tags = ?");
    params.push(serialise(fields.aiTags ?? null));
  }
  if (fields.lastWornDaysAgo !== undefined) {
    updates.push("last_worn_days_ago = ?");
    params.push(fields.lastWornDaysAgo);
  }
  if (fields.wearCount !== undefined) {
    updates.push("wear_count = ?");
    params.push(fields.wearCount);
  }
  if (fields.favorite !== undefined) {
    updates.push("favorite = ?");
    params.push(fields.favorite ? 1 : 0);
  }
  if (fields.isDirty !== undefined) {
    updates.push("is_dirty = ?");
    params.push(fields.isDirty ? 1 : 0);
  }
  if ("purchasePrice" in fields) {
    updates.push("purchase_price = ?");
    params.push(fields.purchasePrice ?? null);
  }
  if ("purchaseDate" in fields) {
    updates.push("purchase_date = ?");
    params.push(fields.purchaseDate ?? null);
  }

  if (updates.length === 0) return;

  params.push(id);
  await db.runAsync(
    `UPDATE wardrobe_items SET ${updates.join(", ")} WHERE id = ?`,
    params,
  );
}

export async function deleteItem(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("DELETE FROM wardrobe_items WHERE id = ?", [id]);
}

export async function markSynced(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "UPDATE wardrobe_items SET synced_to_cloud = 1 WHERE id = ?",
    [id],
  );
}

export async function getUnsyncedItems(): Promise<WardrobeItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<WardrobeRow>(
    "SELECT * FROM wardrobe_items WHERE synced_to_cloud = 0",
  );
  return rows.map(rowToItem);
}

// ─── outfit_logs ──────────────────────────────────────────────────────────────

export interface OutfitItemSnapshot {
  id: string;
  name: string;
  category: string;
  colours: string[];
  formality: string;
  imageUrl?: string;
}

export interface OutfitLog {
  id: string;
  userId: string;
  wornDate: string; // ISO date "YYYY-MM-DD"
  itemIds: string[];
  outfitKey: string; // sorted item_ids joined with '|'
  occasion?: string;
  temperatureC?: number;
  /** Text label from WeatherSnapshot.condition at log time. */
  weatherCondition?: string;
  /** City name from WeatherSnapshot.location at log time. */
  locationName?: string;
  /** Slim copy of each item's key attributes captured at wear-time.
   *  Preserves outfit context even after items are deleted.
   *  Also feeds AI prompts without needing wardrobe_items joins. */
  itemSnapshot: OutfitItemSnapshot[];
  /** Deduped union of all colours across worn items. Drives palette analytics. */
  colorPalette: string[];
  /** Dominant formality of the outfit: casual|smart|formal|festive|athleisure */
  formality?: string;
  notes?: string;
  /** 1 (hate) … 3 (neutral) … 5 (love). undefined = not yet rated. */
  rating?: number;
  ratingNote?: string;
  syncedToCloud: boolean;
  createdAt: string;
}

interface OutfitLogRow {
  id: string;
  user_id: string;
  worn_date: string;
  item_ids: string;
  outfit_key: string;
  occasion: string | null;
  temperature_c: number | null;
  weather_condition: string | null;
  location_name: string | null;
  item_snapshot: string | null;
  color_palette: string | null;
  formality: string | null;
  notes: string | null;
  rating: number | null;
  rating_note: string | null;
  synced_to_cloud: number | null;
  created_at: string | null;
}

function rowToLog(row: OutfitLogRow): OutfitLog {
  return {
    id: row.id,
    userId: row.user_id,
    wornDate: row.worn_date,
    itemIds: deserialise<string[]>(row.item_ids) ?? [],
    outfitKey: row.outfit_key,
    occasion: row.occasion ?? undefined,
    temperatureC: row.temperature_c ?? undefined,
    weatherCondition: row.weather_condition ?? undefined,
    locationName: row.location_name ?? undefined,
    itemSnapshot: deserialise<OutfitItemSnapshot[]>(row.item_snapshot) ?? [],
    colorPalette: deserialise<string[]>(row.color_palette) ?? [],
    formality: row.formality ?? undefined,
    notes: row.notes ?? undefined,
    rating: row.rating ?? undefined,
    ratingNote: row.rating_note ?? undefined,
    syncedToCloud: row.synced_to_cloud === 1,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export function buildOutfitKey(itemIds: string[]): string {
  return [...itemIds].sort().join("|");
}

export async function insertOutfitLog(log: OutfitLog): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO outfit_logs
       (id, user_id, worn_date, item_ids, outfit_key, occasion, temperature_c,
        weather_condition, location_name, item_snapshot, color_palette, formality,
        notes, synced_to_cloud)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.userId,
      log.wornDate,
      serialise(log.itemIds),
      log.outfitKey,
      log.occasion ?? null,
      log.temperatureC ?? null,
      log.weatherCondition ?? null,
      log.locationName ?? null,
      serialise(log.itemSnapshot),
      serialise(log.colorPalette),
      log.formality ?? null,
      log.notes ?? null,
      log.syncedToCloud ? 1 : 0,
    ],
  );
}

export async function getOutfitLogsByMonth(
  userId: string,
  year: number,
  month: number, // 1-based
): Promise<OutfitLog[]> {
  const db = getDb();
  const monthStr = String(month).padStart(2, "0");
  const rows = await db.getAllAsync<OutfitLogRow>(
    `SELECT * FROM outfit_logs
     WHERE user_id = ? AND worn_date LIKE ?
     ORDER BY worn_date DESC`,
    [userId, `${year}-${monthStr}-%`],
  );
  return rows.map(rowToLog);
}

export async function getRecentOutfitLogs(
  userId: string,
  withinDays: number,
): Promise<OutfitLog[]> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const rows = await db.getAllAsync<OutfitLogRow>(
    `SELECT * FROM outfit_logs
     WHERE user_id = ? AND worn_date >= ?
     ORDER BY worn_date DESC`,
    [userId, cutoffStr],
  );
  return rows.map(rowToLog);
}

export async function getOutfitLogsByKey(
  userId: string,
  outfitKey: string,
  withinDays: number,
): Promise<OutfitLog[]> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const rows = await db.getAllAsync<OutfitLogRow>(
    `SELECT * FROM outfit_logs
     WHERE user_id = ? AND outfit_key = ? AND worn_date >= ?
     ORDER BY worn_date DESC`,
    [userId, outfitKey, cutoffStr],
  );
  return rows.map(rowToLog);
}

export async function deleteOutfitLog(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("DELETE FROM outfit_logs WHERE id = ?", [id]);
}

export async function markOutfitLogSynced(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("UPDATE outfit_logs SET synced_to_cloud = 1 WHERE id = ?", [
    id,
  ]);
}

export async function getUnsyncedOutfitLogs(): Promise<OutfitLog[]> {
  const db = getDb();
  const rows = await db.getAllAsync<OutfitLogRow>(
    "SELECT * FROM outfit_logs WHERE synced_to_cloud = 0",
  );
  return rows.map(rowToLog);
}

export async function updateOutfitLogRating(
  id: string,
  rating: number,
  ratingNote?: string,
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "UPDATE outfit_logs SET rating = ?, rating_note = ?, synced_to_cloud = 0 WHERE id = ?",
    [rating, ratingNote ?? null, id],
  );
}

/**
 * Returns top-rated logs (rating >= minRating), ordered by rating desc then
 * recency.  Used by the "Top Rated Outfits" profile section.
 */
export async function getTopRatedOutfitLogs(
  userId: string,
  minRating = 4,
  limit = 20,
): Promise<OutfitLog[]> {
  const db = getDb();
  const rows = await db.getAllAsync<OutfitLogRow>(
    `SELECT * FROM outfit_logs
     WHERE user_id = ? AND rating >= ?
     ORDER BY rating DESC, worn_date DESC
     LIMIT ?`,
    [userId, minRating, limit],
  );
  return rows.map(rowToLog);
}

/**
 * Returns a map of outfitKey → average rating across all rated logs.
 * Used to boost recommendation scores for well-loved outfit combos.
 *
 * SQL equivalent:
 *   SELECT outfit_key, AVG(rating) as avg_rating
 *   FROM outfit_logs
 *   WHERE user_id = ? AND rating IS NOT NULL
 *   GROUP BY outfit_key
 */
export async function getOutfitKeyRatings(
  userId: string,
): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    outfit_key: string;
    avg_rating: number;
  }>(
    `SELECT outfit_key, AVG(rating) AS avg_rating
     FROM outfit_logs
     WHERE user_id = ? AND rating IS NOT NULL
     GROUP BY outfit_key`,
    [userId],
  );
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.outfit_key] = row.avg_rating;
  }
  return map;
}

// ─── capsules ─────────────────────────────────────────────────────────────────

import type { Capsule, CapsulePurpose } from "@/lib/capsule";

interface CapsuleRow {
  id: string;
  name: string;
  purpose: string;
  description: string | null;
  item_ids: string;
  is_challenge: number;
  challenge_end_date: string | null;
  challenge_logged_outfit_keys: string | null;
  created_at: string;
  updated_at: string;
}

function rowToCapsule(row: CapsuleRow): Capsule {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose as CapsulePurpose,
    description: row.description ?? undefined,
    itemIds: deserialise<string[]>(row.item_ids) ?? [],
    isChallenge: row.is_challenge === 1,
    challengeEndDate: row.challenge_end_date ?? undefined,
    challengeLoggedOutfitKeys:
      deserialise<string[]>(row.challenge_logged_outfit_keys) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllCapsules(): Promise<Capsule[]> {
  const db = getDb();
  const rows = await db.getAllAsync<CapsuleRow>(
    "SELECT * FROM capsules ORDER BY updated_at DESC",
  );
  return rows.map(rowToCapsule);
}

export async function getCapsuleById(id: string): Promise<Capsule | null> {
  const db = getDb();
  const row = await db.getFirstAsync<CapsuleRow>(
    "SELECT * FROM capsules WHERE id = ?",
    [id],
  );
  return row ? rowToCapsule(row) : null;
}

export async function upsertCapsule(capsule: Capsule): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO capsules
       (id, name, purpose, description, item_ids, is_challenge,
        challenge_end_date, challenge_logged_outfit_keys, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      capsule.id,
      capsule.name,
      capsule.purpose,
      capsule.description ?? null,
      serialise(capsule.itemIds),
      capsule.isChallenge ? 1 : 0,
      capsule.challengeEndDate ?? null,
      capsule.challengeLoggedOutfitKeys != null
        ? serialise(capsule.challengeLoggedOutfitKeys)
        : null,
      capsule.createdAt,
      capsule.updatedAt,
    ],
  );
}

export async function deleteCapsule(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("DELETE FROM capsules WHERE id = ?", [id]);
}

/**
 * Append an outfit key to a challenge capsule's logged-outfit-keys list.
 * No-ops if the key is already recorded (idempotent).
 */
export async function recordChallengeOutfit(
  capsuleId: string,
  outfitKey: string,
): Promise<void> {
  const capsule = await getCapsuleById(capsuleId);
  if (!capsule?.isChallenge) return;
  const existing = capsule.challengeLoggedOutfitKeys ?? [];
  if (existing.includes(outfitKey)) return;
  const updated: Capsule = {
    ...capsule,
    challengeLoggedOutfitKeys: [...existing, outfitKey],
    updatedAt: new Date().toISOString(),
  };
  await upsertCapsule(updated);
}

// ─── gamification_state ───────────────────────────────────────────────────────

export interface GamificationState {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastLogDate: string | null;
}

interface GamificationRow {
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_log_date: string | null;
}

export async function getGamificationState(): Promise<GamificationState> {
  const db = getDb();
  const row = await db.getFirstAsync<GamificationRow>(
    "SELECT xp, level, current_streak, longest_streak, last_log_date FROM gamification_state WHERE id = 1",
  );
  if (!row) {
    return {
      xp: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastLogDate: null,
    };
  }
  return {
    xp: row.xp,
    level: row.level,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastLogDate: row.last_log_date,
  };
}

export async function saveGamificationState(
  state: GamificationState,
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE gamification_state
     SET xp = ?, level = ?, current_streak = ?, longest_streak = ?, last_log_date = ?,
         updated_at = datetime('now')
     WHERE id = 1`,
    [
      state.xp,
      state.level,
      state.currentStreak,
      state.longestStreak,
      state.lastLogDate,
    ],
  );
}

// ─── earned_badges ────────────────────────────────────────────────────────────

export async function getEarnedBadgeIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ badge_id: string }>(
    "SELECT badge_id FROM earned_badges ORDER BY earned_at ASC",
  );
  return rows.map((r) => r.badge_id);
}

export async function insertEarnedBadge(badgeId: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "INSERT OR IGNORE INTO earned_badges (badge_id, earned_at) VALUES (?, datetime('now'))",
    [badgeId],
  );
}

// ─── weekly_challenges ────────────────────────────────────────────────────────

export interface WeeklyChallengeRow {
  id: string;
  weekStart: string;
  challengeKey: string;
  title: string;
  description: string;
  xpReward: number;
  target: number;
  progress: number;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

interface RawWeeklyChallengeRow {
  id: string;
  week_start: string;
  challenge_key: string;
  title: string;
  description: string;
  xp_reward: number;
  target: number;
  progress: number;
  completed: number;
  completed_at: string | null;
  created_at: string;
}

function rowToChallenge(r: RawWeeklyChallengeRow): WeeklyChallengeRow {
  return {
    id: r.id,
    weekStart: r.week_start,
    challengeKey: r.challenge_key,
    title: r.title,
    description: r.description,
    xpReward: r.xp_reward,
    target: r.target,
    progress: r.progress,
    completed: r.completed === 1,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

export async function getWeeklyChallengesForWeek(
  weekStart: string,
): Promise<WeeklyChallengeRow[]> {
  const db = getDb();
  const rows = await db.getAllAsync<RawWeeklyChallengeRow>(
    "SELECT * FROM weekly_challenges WHERE week_start = ? ORDER BY created_at ASC",
    [weekStart],
  );
  return rows.map(rowToChallenge);
}

export async function upsertWeeklyChallenge(
  challenge: WeeklyChallengeRow,
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO weekly_challenges
       (id, week_start, challenge_key, title, description, xp_reward, target,
        progress, completed, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      challenge.id,
      challenge.weekStart,
      challenge.challengeKey,
      challenge.title,
      challenge.description,
      challenge.xpReward,
      challenge.target,
      challenge.progress,
      challenge.completed ? 1 : 0,
      challenge.completedAt,
      challenge.createdAt,
    ],
  );
}
