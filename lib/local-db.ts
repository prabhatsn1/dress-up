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
      synced_to_cloud INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
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
       ai_summary, ai_tags, last_worn_days_ago, wear_count, favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
