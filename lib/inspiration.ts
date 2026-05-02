/**
 * inspiration.ts
 *
 * Domain types, matching logic, and SQLite persistence for the
 * Outfit Inspiration Board feature.
 *
 * ─── Overview ─────────────────────────────────────────────────────────────────
 *
 * InspirationPin
 *   A saved image (from the device library or a screenshot).
 *   Each pin carries:
 *     • imageUri       – local file URI
 *     • vibe           – auto-classified or manually set style vibe
 *     • extractedColours – dominant colour names guessed from the vibe/tags
 *     • matchedItemIds – IDs of the closest owned wardrobe items
 *     • tags           – free-text descriptors the user or the matcher added
 *
 * InspirationVibe
 *   One of a fixed set of style aesthetics used to classify a pin and power
 *   the matching algorithm.
 *
 * ─── Matching algorithm ───────────────────────────────────────────────────────
 *
 *  matchInspirationToWardrobe(pin, items) → RankedMatch[]
 *
 *  Scores every wardrobe item against a pin on four dimensions and returns
 *  the top-N results sorted by score descending.
 *
 *  Dimension                     Weight   Description
 *  ─────────────────────────────────────────────────────────────────────────
 *  Vibe → formality alignment     40 pts  Does the item's formality map to
 *                                         the pin's vibe?
 *  Colour overlap                 30 pts  How many of the item's colours
 *                                         appear in the pin's colour palette?
 *  Category fill                  20 pts  Reward items whose category fills a
 *                                         gap in the current matched set.
 *  Tag overlap                    10 pts  How many item tags / subcategory
 *                                         words appear in the pin's tags?
 *  ─────────────────────────────────────────────────────────────────────────
 *  Max possible                  100 pts
 *
 * ─── Vibe classification ──────────────────────────────────────────────────────
 *
 *  classifyVibe(tags) → InspirationVibe
 *
 *  Given a list of string tags derived from the image filename or free text
 *  entered by the user, picks the closest matching vibe via keyword scoring.
 */

import * as SQLite from "expo-sqlite";
import type { WardrobeItem, Formality } from "@/lib/wardrobe";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InspirationVibe =
  | "minimal"
  | "boho"
  | "street"
  | "classic"
  | "maximalist"
  | "sporty"
  | "romantic"
  | "ethnic"
  | "edgy";

export interface InspirationPin {
  id: string;
  imageUri: string;
  title: string;
  vibe: InspirationVibe;
  /** Dominant colour names guessed for this pin */
  extractedColours: string[];
  /** Free-text descriptors for matching and search */
  tags: string[];
  /** Ordered list of best-matching wardrobe item IDs */
  matchedItemIds: string[];
  /** Notes the user added */
  notes?: string;
  createdAt: string;
}

export interface RankedMatch {
  item: WardrobeItem;
  score: number;
  /** How each dimension contributed to the score */
  breakdown: {
    vibeScore: number;
    colourScore: number;
    categoryScore: number;
    tagScore: number;
  };
}

// ─── Vibe metadata (used for classification and UI) ───────────────────────────

export interface VibeMeta {
  label: string;
  emoji: string;
  description: string;
  /** Formality levels most associated with this vibe */
  formalities: Formality[];
  /** Representative colour names */
  colours: string[];
  /** Keyword hints for classification */
  keywords: string[];
}

export const VIBE_META: Record<InspirationVibe, VibeMeta> = {
  minimal: {
    label: "Minimal",
    emoji: "◻️",
    description: "Clean lines, neutral palette, no-fuss silhouettes",
    formalities: ["smart", "casual"],
    colours: ["white", "black", "beige", "grey", "cream", "charcoal"],
    keywords: [
      "minimal",
      "clean",
      "neutral",
      "simple",
      "monochrome",
      "understated",
      "sleek",
    ],
  },
  boho: {
    label: "Boho",
    emoji: "🌿",
    description: "Earthy tones, flowing fabrics, layered accessories",
    formalities: ["casual", "smart"],
    colours: ["tan", "brown", "olive", "cream", "terracotta", "mustard"],
    keywords: [
      "boho",
      "bohemian",
      "earthy",
      "flowy",
      "layered",
      "natural",
      "free",
      "linen",
    ],
  },
  street: {
    label: "Street",
    emoji: "🏙️",
    description: "Bold logos, relaxed cuts, sneaker-forward styling",
    formalities: ["casual", "athleisure"],
    colours: ["black", "white", "grey", "olive", "navy", "bold"],
    keywords: [
      "street",
      "urban",
      "hype",
      "sneaker",
      "oversized",
      "hoodie",
      "graphic",
      "sporty",
    ],
  },
  classic: {
    label: "Classic",
    emoji: "🎩",
    description: "Timeless pieces, tailored fits, quality fabrics",
    formalities: ["formal", "smart"],
    colours: ["navy", "white", "black", "charcoal", "beige", "camel"],
    keywords: [
      "classic",
      "timeless",
      "tailored",
      "blazer",
      "trench",
      "oxford",
      "polished",
    ],
  },
  maximalist: {
    label: "Maximalist",
    emoji: "✨",
    description: "Bold colours, mixed prints, statement accessories",
    formalities: ["festive", "smart"],
    colours: ["emerald", "gold", "bold", "mixed", "bright"],
    keywords: [
      "maximalist",
      "bold",
      "pattern",
      "print",
      "colourful",
      "statement",
      "mixed",
      "eclectic",
    ],
  },
  sporty: {
    label: "Sporty",
    emoji: "⚡",
    description: "Performance fabrics, activewear silhouettes, clean energy",
    formalities: ["athleisure", "casual"],
    colours: ["black", "white", "grey", "navy", "bright"],
    keywords: [
      "sport",
      "active",
      "athletic",
      "gym",
      "performance",
      "jogger",
      "legging",
      "sneaker",
    ],
  },
  romantic: {
    label: "Romantic",
    emoji: "🌸",
    description: "Soft fabrics, floral motifs, feminine silhouettes",
    formalities: ["smart", "casual", "festive"],
    colours: ["pink", "white", "lavender", "rose", "blush", "cream"],
    keywords: [
      "romantic",
      "floral",
      "feminine",
      "soft",
      "delicate",
      "lace",
      "pastel",
      "blush",
    ],
  },
  ethnic: {
    label: "Ethnic",
    emoji: "🪡",
    description:
      "Heritage textiles, traditional silhouettes, rich embellishment",
    formalities: ["festive", "formal"],
    colours: ["gold", "emerald", "red", "maroon", "navy", "saffron"],
    keywords: [
      "ethnic",
      "traditional",
      "kurta",
      "saree",
      "embroidery",
      "handloom",
      "heritage",
      "festive",
    ],
  },
  edgy: {
    label: "Edgy",
    emoji: "🖤",
    description: "Dark palette, structured leather, unconventional details",
    formalities: ["casual", "smart"],
    colours: ["black", "charcoal", "dark", "grey", "burgundy"],
    keywords: [
      "edgy",
      "dark",
      "leather",
      "moto",
      "punk",
      "grunge",
      "structured",
      "harness",
    ],
  },
};

// ─── Vibe classification ───────────────────────────────────────────────────────

/**
 * Score a list of text tags against every vibe's keyword list.
 * Returns the vibe with the highest keyword hit count, defaulting to "minimal".
 */
export function classifyVibe(tags: string[]): InspirationVibe {
  const lower = tags.map((t) => t.toLowerCase());
  let best: InspirationVibe = "minimal";
  let bestScore = 0;

  for (const [vibe, meta] of Object.entries(VIBE_META) as [
    InspirationVibe,
    VibeMeta,
  ][]) {
    const score = meta.keywords.reduce(
      (acc, kw) => acc + (lower.some((t) => t.includes(kw)) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = vibe;
    }
  }

  return best;
}

/**
 * Guess dominant colour names from a pin's vibe + user tags.
 * Returns the first 4 signature colours for that vibe that aren't already
 * excluded, supplemented by any colour words found in the tags.
 */
export function extractColoursFromContext(
  vibe: InspirationVibe,
  tags: string[],
): string[] {
  const vibeColours = VIBE_META[vibe].colours.slice(0, 4);
  const knownColours = new Set([
    "black",
    "white",
    "grey",
    "charcoal",
    "navy",
    "blue",
    "beige",
    "cream",
    "tan",
    "brown",
    "olive",
    "green",
    "red",
    "pink",
    "lavender",
    "gold",
    "emerald",
    "maroon",
    "rust",
    "terracotta",
    "mustard",
  ]);
  const tagColours = tags
    .map((t) => t.toLowerCase())
    .filter((t) => knownColours.has(t));

  const combined = [...new Set([...vibeColours, ...tagColours])];
  return combined.slice(0, 6);
}

// ─── Matching algorithm ───────────────────────────────────────────────────────

const VIBE_FORMALITY_MAP: Record<InspirationVibe, Formality[]> =
  Object.fromEntries(
    Object.entries(VIBE_META).map(([v, m]) => [v, m.formalities]),
  ) as Record<InspirationVibe, Formality[]>;

function vibeScore(item: WardrobeItem, vibe: InspirationVibe): number {
  return VIBE_FORMALITY_MAP[vibe].includes(item.formality) ? 40 : 0;
}

function colourScore(item: WardrobeItem, palette: string[]): number {
  if (palette.length === 0) return 0;
  const hits = item.colours.filter((c) =>
    palette.some(
      (p) => c.toLowerCase().includes(p) || p.includes(c.toLowerCase()),
    ),
  ).length;
  return Math.min(30, Math.round((hits / item.colours.length) * 30));
}

function categoryScore(
  item: WardrobeItem,
  alreadyMatched: WardrobeItem[],
): number {
  const categories = new Set(alreadyMatched.map((i) => i.category));
  // Reward filling a missing category slot
  if (!categories.has(item.category)) return 20;
  // Only penalise if there are already 2+ of the same category
  const sameCount = alreadyMatched.filter(
    (i) => i.category === item.category,
  ).length;
  return sameCount >= 2 ? 0 : 10;
}

function tagScore(item: WardrobeItem, pinTags: string[]): number {
  if (pinTags.length === 0) return 0;
  const itemWords = [
    item.subcategory,
    item.material,
    item.pattern,
    ...item.colours,
  ]
    .join(" ")
    .toLowerCase()
    .split(/\s+/);

  const hits = pinTags.filter((t) =>
    itemWords.some(
      (w) => w.includes(t.toLowerCase()) || t.toLowerCase().includes(w),
    ),
  ).length;
  return Math.min(10, Math.round((hits / Math.max(pinTags.length, 1)) * 10));
}

/**
 * Match a saved inspiration pin to the user's wardrobe.
 *
 * @param pin        The inspiration pin to match against
 * @param items      Full wardrobe item list
 * @param topN       Maximum number of results (default 6)
 * @returns          Items ranked by match score, descending
 */
export function matchInspirationToWardrobe(
  pin: InspirationPin,
  items: WardrobeItem[],
  topN = 6,
): RankedMatch[] {
  const matched: WardrobeItem[] = [];
  const results: RankedMatch[] = [];

  for (const item of items) {
    if (item.isDirty) continue;

    const vs = vibeScore(item, pin.vibe);
    const cs = colourScore(item, pin.extractedColours);
    const cats = categoryScore(item, matched);
    const ts = tagScore(item, pin.tags);
    const total = vs + cs + cats + ts;

    results.push({
      item,
      score: total,
      breakdown: {
        vibeScore: vs,
        colourScore: cs,
        categoryScore: cats,
        tagScore: ts,
      },
    });
  }

  const sorted = results.sort((a, b) => b.score - a.score).slice(0, topN);

  // Rebuild matched list in score order for categoryScore de-dup (informational)
  sorted.forEach((r) => matched.push(r.item));

  return sorted;
}

// ─── SQLite persistence ────────────────────────────────────────────────────────

interface InspirationRow {
  id: string;
  image_uri: string;
  title: string;
  vibe: string;
  extracted_colours: string;
  tags: string;
  matched_item_ids: string;
  notes: string | null;
  created_at: string;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync("wardrobe.db");
  await dbInstance.execAsync(`
    CREATE TABLE IF NOT EXISTS inspiration_pins (
      id TEXT PRIMARY KEY,
      image_uri TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      vibe TEXT NOT NULL DEFAULT 'minimal',
      extracted_colours TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      matched_item_ids TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Migration: add columns if upgrading from an older schema
  for (const sql of [
    "ALTER TABLE inspiration_pins ADD COLUMN title TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE inspiration_pins ADD COLUMN notes TEXT",
  ]) {
    try {
      await dbInstance.execAsync(sql);
    } catch {
      // Already exists — safe to ignore
    }
  }
  return dbInstance;
}

function rowToPin(row: InspirationRow): InspirationPin {
  return {
    id: row.id,
    imageUri: row.image_uri,
    title: row.title ?? "",
    vibe: (row.vibe as InspirationVibe) ?? "minimal",
    extractedColours: JSON.parse(row.extracted_colours || "[]") as string[],
    tags: JSON.parse(row.tags || "[]") as string[],
    matchedItemIds: JSON.parse(row.matched_item_ids || "[]") as string[],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getAllPins(): Promise<InspirationPin[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<InspirationRow>(
    "SELECT * FROM inspiration_pins ORDER BY created_at DESC",
  );
  return rows.map(rowToPin);
}

export async function upsertPin(pin: InspirationPin): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO inspiration_pins
      (id, image_uri, title, vibe, extracted_colours, tags, matched_item_ids, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pin.id,
      pin.imageUri,
      pin.title,
      pin.vibe,
      JSON.stringify(pin.extractedColours),
      JSON.stringify(pin.tags),
      JSON.stringify(pin.matchedItemIds),
      pin.notes ?? null,
      pin.createdAt,
    ],
  );
}

export async function deletePin(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM inspiration_pins WHERE id = ?", [id]);
}
