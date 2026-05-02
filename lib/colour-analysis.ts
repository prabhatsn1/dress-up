/**
 * colour-analysis.ts
 *
 * Maps a user's skin tone string (as stored in UserProfile.skinTone) to one
 * of the four classic seasonal colour palettes (Spring / Summer / Autumn /
 * Winter), then scores each wardrobe item and outfit combination against that
 * palette.
 *
 * ─── Seasonal palette theory summary ──────────────────────────────────────────
 *
 * Spring   warm undertone, light–medium depth  → warm, clear, bright colours
 * Summer   cool undertone, light–medium depth  → cool, soft, muted colours
 * Autumn   warm undertone, medium–deep depth   → warm, rich, earthy colours
 * Winter   cool undertone, medium–deep depth   → cool, clear, high-contrast colours
 *
 * ─── Palette membership ────────────────────────────────────────────────────────
 *
 * Each season has:
 *   bestColours   – excellent; score +BEST_BONUS
 *   goodColours   – work well; score +GOOD_BONUS
 *   avoidColours  – draining; score AVOID_PENALTY
 *
 * All other colours (neutrals etc.) are neutral: no adjustment.
 *
 * ─── Item-level compatibility tag ─────────────────────────────────────────────
 *
 * computeItemPaletteTag(item, season) → "best" | "good" | "neutral" | "avoid"
 *
 * The tag is the worst rating across the item's colours array.
 *
 * ─── Outfit-level colour score ─────────────────────────────────────────────────
 *
 * computeOutfitColourScore(outfitItems, season) → number
 *
 * Sum of per-item adjustments for items that are "visible" (Tops, Outerwear).
 * Bottoms and Shoes contribute half-weight (less face-proximity).
 */

import type { WardrobeItem } from "@/lib/wardrobe";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SeasonalPalette = "Spring" | "Summer" | "Autumn" | "Winter";

/** Per-item palette compatibility tag */
export type PaletteTag = "best" | "good" | "neutral" | "avoid";

export interface ColourAnalysis {
  palette: SeasonalPalette;
  /** Colours that work exceptionally well */
  bestColours: string[];
  /** Colours that look good */
  goodColours: string[];
  /** Colours to minimise near the face */
  avoidColours: string[];
  /** Short rationale string for UI display */
  description: string;
}

// ─── Score weights ────────────────────────────────────────────────────────────

/** Added to outfit score for a "best" item in palette */
const BEST_BONUS = 6;
/** Added for a "good" item */
const GOOD_BONUS = 3;
/** Subtracted for an "avoid" item (near face — top/outerwear only) */
const AVOID_PENALTY = -5;
/** Half-weight multiplier for bottoms/shoes (lower proximity to face) */
const LOWER_BODY_WEIGHT = 0.5;

// ─── Seasonal palette definitions ─────────────────────────────────────────────

const PALETTES: Record<SeasonalPalette, Omit<ColourAnalysis, "palette">> = {
  Spring: {
    bestColours: [
      "cream",
      "peach",
      "coral",
      "gold",
      "tan",
      "olive",
      "warm red",
    ],
    goodColours: [
      "beige",
      "brown",
      "camel",
      "terracotta",
      "warm orange",
      "warm pink",
      "warm green",
    ],
    avoidColours: [
      "black",
      "charcoal",
      "navy",
      "cool grey",
      "cool purple",
      "cool pink",
    ],
    description:
      "Warm, light, and clear — your best colours are creamy neutrals, warm peaches, and earthy golds. Avoid stark black and cool-toned shades near the face.",
  },

  Summer: {
    bestColours: [
      "lavender",
      "soft pink",
      "powder blue",
      "rose",
      "cool grey",
      "mauve",
      "soft white",
    ],
    goodColours: [
      "white",
      "grey",
      "navy",
      "cool blue",
      "cool green",
      "cool purple",
      "dusty rose",
    ],
    avoidColours: [
      "orange",
      "warm red",
      "gold",
      "olive",
      "tan",
      "terracotta",
      "bright yellow",
    ],
    description:
      "Cool, soft, and muted — your best colours are dusky pastels, soft blues, and cool pinks. Avoid warm earthy tones and bright oranges.",
  },

  Autumn: {
    bestColours: [
      "terracotta",
      "rust",
      "warm orange",
      "olive",
      "brown",
      "camel",
      "gold",
      "emerald",
    ],
    goodColours: [
      "tan",
      "beige",
      "cream",
      "warm red",
      "mustard",
      "forest green",
      "warm brown",
    ],
    avoidColours: [
      "black",
      "cool grey",
      "silver",
      "lavender",
      "cool pink",
      "cool blue",
      "bright white",
    ],
    description:
      "Warm, rich, and muted — your best colours are earthy terracottas, deep olives, and burnished golds. Avoid cool greys and icy shades.",
  },

  Winter: {
    bestColours: [
      "black",
      "white",
      "navy",
      "charcoal",
      "cool red",
      "cobalt blue",
      "emerald",
      "cool purple",
    ],
    goodColours: [
      "grey",
      "blue",
      "silver",
      "cool pink",
      "teal",
      "magenta",
      "burgundy",
    ],
    avoidColours: [
      "tan",
      "beige",
      "camel",
      "warm orange",
      "gold",
      "terracotta",
      "warm brown",
    ],
    description:
      "Cool, clear, and high-contrast — your best colours are bold primaries, true black and white, and jewel tones. Avoid warm beiges and earthy browns.",
  },
};

// ─── Skin-tone → palette mapping ──────────────────────────────────────────────
//
// The mapping is intentionally broad and keyword-based so it works with
// free-text entries like "Warm medium", "deep cool", "fair neutral", etc.
//
// Keywords checked in priority order:
//   1. Explicit season keyword in the string
//   2. Undertone + depth heuristics

const SEASON_KEYWORDS: Record<SeasonalPalette, string[]> = {
  Spring: ["spring", "warm light", "warm fair", "light warm", "fair warm"],
  Summer: [
    "summer",
    "cool light",
    "cool fair",
    "light cool",
    "fair cool",
    "cool pale",
    "pale cool",
  ],
  Autumn: [
    "autumn",
    "fall",
    "warm medium",
    "warm deep",
    "medium warm",
    "deep warm",
    "olive warm",
    "olive medium",
    "warm olive",
  ],
  Winter: [
    "winter",
    "cool medium",
    "cool deep",
    "medium cool",
    "deep cool",
    "cool dark",
    "dark cool",
    "clear cool",
    "cool clear",
  ],
};

// Undertone-only fallbacks when no depth keyword is present
const WARM_UNDERTONE_KEYWORDS = [
  "warm",
  "golden",
  "peachy",
  "yellow",
  "olive",
  "bronze",
  "caramel",
];
const COOL_UNDERTONE_KEYWORDS = [
  "cool",
  "pink",
  "rosy",
  "blue",
  "silver",
  "ashy",
  "neutral",
];
const DEEP_KEYWORDS = [
  "deep",
  "dark",
  "rich",
  "ebony",
  "espresso",
  "chocolate",
];

/**
 * Derive a SeasonalPalette from a free-text skin-tone string.
 * Returns null when the string is empty / unrecognisable.
 */
export function skinToneToPalette(
  skinTone: string | undefined,
): SeasonalPalette | null {
  if (!skinTone?.trim()) return null;
  const lower = skinTone.toLowerCase();

  // 1. Direct season keyword match
  for (const [season, keywords] of Object.entries(SEASON_KEYWORDS) as [
    SeasonalPalette,
    string[],
  ][]) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return season;
    }
  }

  // 2. Heuristic: undertone + depth
  const isWarm = WARM_UNDERTONE_KEYWORDS.some((kw) => lower.includes(kw));
  const isCool = COOL_UNDERTONE_KEYWORDS.some((kw) => lower.includes(kw));
  const isDeep = DEEP_KEYWORDS.some((kw) => lower.includes(kw));

  if (isWarm && isDeep) return "Autumn";
  if (isWarm) return "Spring";
  if (isCool && isDeep) return "Winter";
  if (isCool) return "Summer";

  // 3. Still no match — default to Autumn (warm neutral is common)
  return "Autumn";
}

/**
 * Return the full ColourAnalysis for a skin-tone string, or null if unknown.
 */
export function getColourAnalysis(
  skinTone: string | undefined,
): ColourAnalysis | null {
  const palette = skinToneToPalette(skinTone);
  if (!palette) return null;
  return { palette, ...PALETTES[palette] };
}

// ─── Item & outfit scoring ─────────────────────────────────────────────────────

/**
 * Tag a single item's colour compatibility with a palette.
 *
 * Rule: return the *worst* tag across all of the item's colours so we never
 * claim "best" for an item that also has an avoid-colour.
 */
export function computeItemPaletteTag(
  item: WardrobeItem,
  analysis: ColourAnalysis,
): PaletteTag {
  let worstTag: PaletteTag = "neutral";

  for (const colour of item.colours) {
    const c = colour.toLowerCase();
    if (analysis.avoidColours.some((a) => c.includes(a) || a.includes(c))) {
      return "avoid"; // short-circuit — can't get worse
    }
    if (analysis.bestColours.some((b) => c.includes(b) || b.includes(c))) {
      // "best" is better than "good" or "neutral"
      if (worstTag === "neutral" || worstTag === "good") worstTag = "best";
      continue;
    }
    if (analysis.goodColours.some((g) => c.includes(g) || g.includes(c))) {
      if (worstTag === "neutral") worstTag = "good";
    }
  }

  return worstTag;
}

/**
 * Score an outfit against a seasonal palette.
 *
 * Tops and Outerwear have full weight (face proximity).
 * Bottoms and Shoes have half weight.
 *
 * Returns 0 when analysis is null (profile has no skin tone set).
 */
export function computeOutfitColourScore(
  outfitItems: WardrobeItem[],
  analysis: ColourAnalysis | null,
): number {
  if (!analysis) return 0;

  let score = 0;
  for (const item of outfitItems) {
    const tag = computeItemPaletteTag(item, analysis);
    const weight =
      item.category === "Bottom" || item.category === "Shoes"
        ? LOWER_BODY_WEIGHT
        : 1;

    switch (tag) {
      case "best":
        score += BEST_BONUS * weight;
        break;
      case "good":
        score += GOOD_BONUS * weight;
        break;
      case "avoid":
        score += AVOID_PENALTY * weight;
        break;
      default:
        break;
    }
  }

  return Math.round(score);
}

// ─── Palette display helpers ───────────────────────────────────────────────────

/** Visual hex swatches for each season's best colours — used in the UI. */
export const SEASON_SWATCHES: Record<SeasonalPalette, string[]> = {
  Spring: [
    "#f2e0c8", // cream
    "#f5c5a3", // peach
    "#e8a87c", // coral
    "#d4a843", // gold
    "#c0956d", // tan
    "#7d8c4f", // olive
  ],
  Summer: [
    "#d8cfe8", // lavender
    "#f0c8d4", // soft pink
    "#a8c8e8", // powder blue
    "#e8b4c0", // rose
    "#b0b8c4", // cool grey
    "#d4b8c0", // mauve
  ],
  Autumn: [
    "#d4674a", // terracotta
    "#c0522e", // rust
    "#d47840", // warm orange
    "#7d8c4f", // olive
    "#8c6040", // brown
    "#c09845", // gold
  ],
  Winter: [
    "#1a1a1a", // black
    "#f5f5f0", // white
    "#1c2f5e", // navy
    "#404058", // charcoal
    "#c02830", // cool red
    "#1a5c8c", // cobalt
  ],
};

/** Emoji and label for each season */
export const SEASON_META: Record<
  SeasonalPalette,
  { emoji: string; adjective: string }
> = {
  Spring: { emoji: "🌸", adjective: "Warm & Clear" },
  Summer: { emoji: "🌊", adjective: "Cool & Muted" },
  Autumn: { emoji: "🍂", adjective: "Warm & Rich" },
  Winter: { emoji: "❄️", adjective: "Cool & Bold" },
};
