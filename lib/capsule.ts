/**
 * capsule.ts
 *
 * Capsule-wardrobe domain logic: types, coverage algorithm, versatility
 * scoring, add/remove suggestions, and the 10×10 challenge.
 *
 * A "capsule" is a named, purposeful collection of 10–40 wardrobe items
 * chosen to maximise outfit variety with a minimum number of pieces.
 *
 * ─── Coverage algorithm ────────────────────────────────────────────────────
 *
 * We count the number of DISTINCT valid two-item top+bottom combinations
 * (the classic capsule metric) plus three-item combinations (top+bottom+layer).
 *
 *   valid pair    = top ∈ capsule  AND bottom ∈ capsule
 *                   AND formalities are compatible (see FORMALITY_COMPAT)
 *   valid triple  = valid pair  AND outerwear/layer ∈ capsule
 *                   AND formality compatible with the pair
 *
 *   coverage score (0–100) = min(combos / TARGET_COMBOS, 1) × 100
 *   where TARGET_COMBOS = 30 for a 15-item capsule.
 *
 * ─── Versatility score ─────────────────────────────────────────────────────
 *
 *   item versatility = (distinctTops it pairs with  +  distinctBottoms) / total
 *   capsule versatility = average item versatility × 100
 *
 * ─── 10×10 challenge ───────────────────────────────────────────────────────
 *
 * Pick exactly 10 items and create at least 10 distinct outfits in 10 days.
 * The algorithm validates the selection can produce ≥10 combos before saving.
 */

import * as Crypto from "expo-crypto";
import type { WardrobeItem, OccasionType } from "@/lib/wardrobe";

// ─── Constants ────────────────────────────────────────────────────────────────

export const CAPSULE_MIN_ITEMS = 10;
export const CAPSULE_MAX_ITEMS = 40;
export const CHALLENGE_ITEM_COUNT = 10;
export const CHALLENGE_MIN_OUTFITS = 10;
const TARGET_COMBOS = 30; // benchmark for 100% coverage score

const FORMALITY_COMPAT: Record<string, string[]> = {
  casual: ["casual", "smart"],
  smart: ["casual", "smart", "formal"],
  formal: ["smart", "formal", "festive"],
  festive: ["formal", "festive", "smart"],
  athleisure: ["casual", "athleisure"],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type CapsulePurpose =
  | "work"
  | "travel"
  | "weekend"
  | "evening"
  | "seasonal"
  | "custom";

export interface CapsuleItem {
  itemId: string;
  addedAt: string; // ISO timestamp
}

export interface Capsule {
  id: string;
  name: string;
  purpose: CapsulePurpose;
  description?: string;
  itemIds: string[];
  /** ISO timestamp */
  createdAt: string;
  updatedAt: string;
  /** True when this capsule is a 10×10 challenge capsule */
  isChallenge: boolean;
  /** For challenge capsules: target date to complete (ISO date YYYY-MM-DD) */
  challengeEndDate?: string;
  /** Outfit IDs logged against this challenge */
  challengeLoggedOutfitKeys?: string[];
}

export interface CapsuleCoverage {
  /** Number of unique valid top+bottom pairs */
  pairCount: number;
  /** Number of unique valid top+bottom+layer triples */
  tripleCount: number;
  /** Total distinct outfits (pairs + triples) */
  totalCombos: number;
  /** 0–100 score */
  coverageScore: number;
  /** 0–100 score */
  versatilityScore: number;
  /** Occasions covered by at least one combo */
  occasionsCovered: OccasionType[];
  /** Occasions with zero coverage */
  occasionGaps: OccasionType[];
}

export interface CapsuleSuggestion {
  action: "add" | "remove";
  item: WardrobeItem;
  reason: string;
  coverageDelta: number; // how much coverage score changes if applied
}

// ─── Coverage engine ──────────────────────────────────────────────────────────

function formalityCompatible(a: string, b: string): boolean {
  return FORMALITY_COMPAT[a]?.includes(b) ?? false;
}

function occasionsOverlap(a: OccasionType[], b: OccasionType[]): boolean {
  return a.some((o) => b.includes(o));
}

/**
 * Build the set of distinct (top, bottom) pairs from a pool of items.
 * A pair is valid when formalities are compatible and occasion sets overlap.
 */
function buildPairs(items: WardrobeItem[]): [WardrobeItem, WardrobeItem][] {
  const tops = items.filter((i) => i.category === "Top");
  const bottoms = items.filter((i) => i.category === "Bottom");
  const pairs: [WardrobeItem, WardrobeItem][] = [];
  for (const top of tops) {
    for (const bot of bottoms) {
      if (
        formalityCompatible(top.formality, bot.formality) &&
        occasionsOverlap(top.occasions, bot.occasions)
      ) {
        pairs.push([top, bot]);
      }
    }
  }
  return pairs;
}

/**
 * For each pair add any compatible outerwear / layer to form triples.
 */
function buildTriples(
  pairs: [WardrobeItem, WardrobeItem][],
  items: WardrobeItem[],
): [WardrobeItem, WardrobeItem, WardrobeItem][] {
  const layers = items.filter((i) => i.category === "Outerwear");
  const triples: [WardrobeItem, WardrobeItem, WardrobeItem][] = [];
  for (const [top, bot] of pairs) {
    for (const layer of layers) {
      if (
        formalityCompatible(top.formality, layer.formality) &&
        formalityCompatible(bot.formality, layer.formality)
      ) {
        triples.push([top, bot, layer]);
      }
    }
  }
  return triples;
}

const ALL_OCCASIONS: OccasionType[] = [
  "Office",
  "Party",
  "Date",
  "Wedding",
  "Casual",
  "Gym",
  "Travel",
];

export function computeCapsuleCoverage(items: WardrobeItem[]): CapsuleCoverage {
  const pairs = buildPairs(items);
  const triples = buildTriples(pairs, items);
  const totalCombos = pairs.length + triples.length;
  const coverageScore = Math.round(
    Math.min(totalCombos / TARGET_COMBOS, 1) * 100,
  );

  // Versatility: avg fraction of opposite-category items each item pairs with
  const tops = items.filter((i) => i.category === "Top");
  const bottoms = items.filter((i) => i.category === "Bottom");
  const versatilityScores: number[] = [];

  for (const top of tops) {
    const compat = bottoms.filter(
      (b) =>
        formalityCompatible(top.formality, b.formality) &&
        occasionsOverlap(top.occasions, b.occasions),
    ).length;
    if (bottoms.length > 0) {
      versatilityScores.push(compat / bottoms.length);
    }
  }
  for (const bot of bottoms) {
    const compat = tops.filter(
      (t) =>
        formalityCompatible(t.formality, bot.formality) &&
        occasionsOverlap(t.occasions, bot.occasions),
    ).length;
    if (tops.length > 0) {
      versatilityScores.push(compat / tops.length);
    }
  }

  const versatilityScore =
    versatilityScores.length > 0
      ? Math.round(
          (versatilityScores.reduce((s, v) => s + v, 0) /
            versatilityScores.length) *
            100,
        )
      : 0;

  // Occasions covered by at least one pair
  const coveredSet = new Set<OccasionType>();
  for (const [top, bot] of pairs) {
    for (const o of top.occasions) {
      if (bot.occasions.includes(o as OccasionType)) {
        coveredSet.add(o as OccasionType);
      }
    }
  }
  const occasionsCovered = ALL_OCCASIONS.filter((o) => coveredSet.has(o));
  const occasionGaps = ALL_OCCASIONS.filter((o) => !coveredSet.has(o));

  return {
    pairCount: pairs.length,
    tripleCount: triples.length,
    totalCombos,
    coverageScore,
    versatilityScore,
    occasionsCovered,
    occasionGaps,
  };
}

// ─── Suggestions engine ───────────────────────────────────────────────────────

/**
 * Given a capsule's current items and the full wardrobe, return add/remove
 * suggestions ranked by coverage delta.
 *
 * Add:    try adding each non-capsule item; keep top-N that improve score
 * Remove: try removing each capsule item; flag those whose removal hurts < 2pts
 */
export function buildCapsuleSuggestions(
  capsuleItems: WardrobeItem[],
  allItems: WardrobeItem[],
  maxSuggestions = 5,
): CapsuleSuggestion[] {
  const capsuleIds = new Set(capsuleItems.map((i) => i.id));
  const baseCoverage = computeCapsuleCoverage(capsuleItems);
  const suggestions: CapsuleSuggestion[] = [];

  // ADD suggestions — items not yet in the capsule
  if (capsuleItems.length < CAPSULE_MAX_ITEMS) {
    const candidates = allItems.filter((i) => !capsuleIds.has(i.id));
    const addDeltas = candidates.map((candidate) => {
      const trial = [...capsuleItems, candidate];
      const trialCov = computeCapsuleCoverage(trial);
      return {
        item: candidate,
        delta: trialCov.coverageScore - baseCoverage.coverageScore,
        coverage: trialCov,
      };
    });

    addDeltas
      .filter((d) => d.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, maxSuggestions)
      .forEach(({ item, delta, coverage }) => {
        const gap = baseCoverage.occasionGaps[0];
        const reason = gap
          ? `Adds ${delta} coverage point${delta !== 1 ? "s" : ""} and helps cover ${gap} occasions.`
          : `Adds ${delta} coverage point${delta !== 1 ? "s" : ""}.`;
        suggestions.push({ action: "add", item, reason, coverageDelta: delta });
      });
  }

  // REMOVE suggestions — items whose removal costs < 2 coverage points
  if (capsuleItems.length > CAPSULE_MIN_ITEMS) {
    capsuleItems
      .map((item) => {
        const trial = capsuleItems.filter((i) => i.id !== item.id);
        const trialCov = computeCapsuleCoverage(trial);
        return {
          item,
          delta: trialCov.coverageScore - baseCoverage.coverageScore,
        };
      })
      .filter((d) => d.delta >= -2 && d.item.wearCount === 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, Math.max(1, maxSuggestions - suggestions.length))
      .forEach(({ item, delta }) => {
        suggestions.push({
          action: "remove",
          item,
          reason: `Never worn — removing it costs only ${Math.abs(delta)} coverage point${Math.abs(delta) !== 1 ? "s" : ""}.`,
          coverageDelta: delta,
        });
      });
  }

  return suggestions;
}

// ─── 10×10 challenge ──────────────────────────────────────────────────────────

/**
 * Validate that exactly 10 items can form at least 10 distinct outfits.
 * Returns null on success, or an error string.
 */
export function validateChallenge(items: WardrobeItem[]): string | null {
  if (items.length !== CHALLENGE_ITEM_COUNT) {
    return `Pick exactly ${CHALLENGE_ITEM_COUNT} items (you have ${items.length}).`;
  }
  const { totalCombos } = computeCapsuleCoverage(items);
  if (totalCombos < CHALLENGE_MIN_OUTFITS) {
    return `These ${CHALLENGE_ITEM_COUNT} items only form ${totalCombos} valid outfit${totalCombos !== 1 ? "s" : ""}. Add more tops/bottoms so you can reach ${CHALLENGE_MIN_OUTFITS}.`;
  }
  return null;
}

/**
 * Progress for a 10×10 challenge: how many distinct outfit keys have been
 * logged against this capsule's items within the challenge window.
 */
export function challengeProgress(capsule: Capsule): {
  outfitsLogged: number;
  outfitsNeeded: number;
  complete: boolean;
  daysLeft: number | null;
} {
  const logged = capsule.challengeLoggedOutfitKeys?.length ?? 0;
  const complete = logged >= CHALLENGE_MIN_OUTFITS;
  let daysLeft: number | null = null;
  if (capsule.challengeEndDate) {
    const end = new Date(capsule.challengeEndDate);
    const now = new Date();
    daysLeft = Math.max(
      0,
      Math.ceil((end.getTime() - now.getTime()) / 86_400_000),
    );
  }
  return {
    outfitsLogged: logged,
    outfitsNeeded: CHALLENGE_MIN_OUTFITS - logged,
    complete,
    daysLeft,
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export async function createCapsule(
  name: string,
  purpose: CapsulePurpose,
  itemIds: string[],
  options: {
    description?: string;
    isChallenge?: boolean;
    challengeDays?: number;
  } = {},
): Promise<Capsule> {
  const id = await Crypto.randomUUID();
  const now = new Date().toISOString();
  const challengeEndDate =
    options.isChallenge && options.challengeDays
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() + options.challengeDays);
          return d.toISOString().slice(0, 10);
        })()
      : undefined;
  return {
    id,
    name,
    purpose,
    description: options.description,
    itemIds,
    createdAt: now,
    updatedAt: now,
    isChallenge: options.isChallenge ?? false,
    challengeEndDate,
    challengeLoggedOutfitKeys: options.isChallenge ? [] : undefined,
  };
}
