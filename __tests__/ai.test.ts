/**
 * Tests for lib/ai.ts.
 * - mergeAiAnalysisIntoWardrobeItem: pure function, no mocks needed
 * - WardrobeAiAnalysis / AiStylistRecommendation shape validation
 * - analyzeWardrobeItemWithAi / generateAiStylistRecommendation error paths
 */

import {
  mergeAiAnalysisIntoWardrobeItem,
  type WardrobeAiAnalysis,
  type AiStylistRecommendation,
} from "@/lib/ai";
import type { WardrobeItem } from "@/lib/wardrobe";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseItem: WardrobeItem = {
  id: "top-1",
  name: "Plain Tee",
  category: "Top",
  subcategory: "T-Shirt",
  fit: "regular",
  sleeve: "short",
  colours: ["white"],
  pattern: "solid",
  seasons: ["summer"],
  occasions: ["Casual"],
  formality: "casual",
  material: "cotton",
  lastWornDaysAgo: 3,
  wearCount: 7,
  favorite: false,
  aiStatus: "idle",
};

const fullAnalysis: WardrobeAiAnalysis = {
  name: "White Cotton Tee",
  category: "Top",
  subcategory: "T-Shirt",
  fit: "regular",
  sleeve: "short",
  colours: ["white"],
  pattern: "solid",
  seasons: ["summer", "all-season"],
  occasions: ["Casual", "Travel"],
  formality: "casual",
  material: "cotton",
  confidence: 0.92,
  summary: "A classic plain white tee suitable for casual outings.",
  styleNotes: ["versatile", "minimalist"],
  segmentationLabels: ["shirt", "clothing"],
  backgroundRemovalSuggested: false,
};

// ── mergeAiAnalysisIntoWardrobeItem ───────────────────────────────────────────

describe("mergeAiAnalysisIntoWardrobeItem", () => {
  test("returns a new object and does not mutate input", () => {
    const merged = mergeAiAnalysisIntoWardrobeItem(baseItem, fullAnalysis);
    expect(merged).not.toBe(baseItem);
    expect(baseItem.aiStatus).toBe("idle");
  });

  test("updates name from analysis", () => {
    expect(mergeAiAnalysisIntoWardrobeItem(baseItem, fullAnalysis).name).toBe(
      "White Cotton Tee",
    );
  });

  test("keeps original name when analysis name is empty", () => {
    const merged = mergeAiAnalysisIntoWardrobeItem(baseItem, {
      ...fullAnalysis,
      name: "",
    });
    expect(merged.name).toBe(baseItem.name);
  });

  test("sets aiStatus to 'completed'", () => {
    expect(
      mergeAiAnalysisIntoWardrobeItem(baseItem, fullAnalysis).aiStatus,
    ).toBe("completed");
  });

  test("sets aiConfidence from analysis confidence", () => {
    expect(
      mergeAiAnalysisIntoWardrobeItem(baseItem, fullAnalysis).aiConfidence,
    ).toBe(0.92);
  });

  test("sets aiSummary", () => {
    expect(
      mergeAiAnalysisIntoWardrobeItem(baseItem, fullAnalysis).aiSummary,
    ).toBe(fullAnalysis.summary);
  });

  test("populates aiTags correctly", () => {
    const merged = mergeAiAnalysisIntoWardrobeItem(baseItem, fullAnalysis);
    expect(merged.aiTags?.styleNotes).toEqual(["versatile", "minimalist"]);
    expect(merged.aiTags?.segmentationLabels).toEqual(["shirt", "clothing"]);
    expect(merged.aiTags?.backgroundRemovalSuggested).toBe(false);
  });

  test("uses analysis occasions when non-empty", () => {
    expect(
      mergeAiAnalysisIntoWardrobeItem(baseItem, fullAnalysis).occasions,
    ).toEqual(["Casual", "Travel"]);
  });

  test("falls back to original occasions when analysis occasions are empty", () => {
    const merged = mergeAiAnalysisIntoWardrobeItem(baseItem, {
      ...fullAnalysis,
      occasions: [] as WardrobeItem["occasions"],
    });
    expect(merged.occasions).toEqual(baseItem.occasions);
  });

  test("uses analysis colours when non-empty", () => {
    const merged = mergeAiAnalysisIntoWardrobeItem(baseItem, {
      ...fullAnalysis,
      colours: ["black", "white"],
    });
    expect(merged.colours).toEqual(["black", "white"]);
  });

  test("falls back to original colours when analysis colours are empty", () => {
    const merged = mergeAiAnalysisIntoWardrobeItem(baseItem, {
      ...fullAnalysis,
      colours: [],
    });
    expect(merged.colours).toEqual(baseItem.colours);
  });

  test("uses analysis seasons when non-empty", () => {
    expect(
      mergeAiAnalysisIntoWardrobeItem(baseItem, fullAnalysis).seasons,
    ).toEqual(["summer", "all-season"]);
  });

  test("preserves non-AI fields (wearCount, favorite, id, lastWornDaysAgo)", () => {
    const merged = mergeAiAnalysisIntoWardrobeItem(
      { ...baseItem, wearCount: 42, favorite: true },
      fullAnalysis,
    );
    expect(merged.wearCount).toBe(42);
    expect(merged.favorite).toBe(true);
    expect(merged.id).toBe(baseItem.id);
    expect(merged.lastWornDaysAgo).toBe(baseItem.lastWornDaysAgo);
  });

  test("handles undefined sleeve", () => {
    const merged = mergeAiAnalysisIntoWardrobeItem(baseItem, {
      ...fullAnalysis,
      sleeve: undefined,
    });
    expect(merged.sleeve).toBeUndefined();
  });
});

// ── WardrobeAiAnalysis shape validation ───────────────────────────────────────

describe("WardrobeAiAnalysis schema shape", () => {
  function isValidAnalysis(obj: unknown): boolean {
    if (!obj || typeof obj !== "object") return false;
    const a = obj as Record<string, unknown>;
    return (
      typeof a.name === "string" &&
      typeof a.category === "string" &&
      typeof a.subcategory === "string" &&
      typeof a.fit === "string" &&
      Array.isArray(a.colours) &&
      typeof a.pattern === "string" &&
      Array.isArray(a.seasons) &&
      Array.isArray(a.occasions) &&
      typeof a.formality === "string" &&
      typeof a.material === "string" &&
      typeof a.confidence === "number" &&
      typeof a.summary === "string" &&
      Array.isArray(a.styleNotes)
    );
  }

  test("fullAnalysis fixture passes shape validation", () => {
    expect(isValidAnalysis(fullAnalysis)).toBe(true);
  });

  test("missing required field fails validation", () => {
    const { name: _removed, ...withoutName } = fullAnalysis;
    expect(isValidAnalysis(withoutName)).toBe(false);
  });

  test("confidence must be a number", () => {
    expect(isValidAnalysis({ ...fullAnalysis, confidence: "high" })).toBe(
      false,
    );
  });
});

// ── AiStylistRecommendation shape validation ──────────────────────────────────

describe("AiStylistRecommendation schema shape", () => {
  const validRec: AiStylistRecommendation = {
    headline: "Sharp office look",
    confidence: 88,
    summary: "A polished combination.",
    reasons: ["Breathable linen top"],
    primaryItemIds: ["top-1", "bot-1", "shoe-1"],
    backupOptions: [
      { itemIds: ["top-2", "bot-1", "shoe-1"], reason: "More relaxed" },
    ],
    accessorySuggestion: "Gold hoop earrings",
    stylistNote: "Keep the shirt tucked.",
  };

  function isValidRec(obj: unknown): boolean {
    if (!obj || typeof obj !== "object") return false;
    const r = obj as Record<string, unknown>;
    return (
      typeof r.headline === "string" &&
      typeof r.confidence === "number" &&
      typeof r.summary === "string" &&
      Array.isArray(r.reasons) &&
      Array.isArray(r.primaryItemIds) &&
      Array.isArray(r.backupOptions) &&
      typeof r.stylistNote === "string"
    );
  }

  test("valid recommendation passes shape check", () => {
    expect(isValidRec(validRec)).toBe(true);
  });

  test("accessorySuggestion may be undefined", () => {
    expect(isValidRec({ ...validRec, accessorySuggestion: undefined })).toBe(
      true,
    );
  });

  test("missing primaryItemIds fails validation", () => {
    const { primaryItemIds: _removed, ...bad } = validRec;
    expect(isValidRec(bad)).toBe(false);
  });

  test("confidence must be a number", () => {
    expect(isValidRec({ ...validRec, confidence: "88%" })).toBe(false);
  });

  test("backupOptions items have itemIds and reason", () => {
    for (const backup of validRec.backupOptions) {
      expect(Array.isArray(backup.itemIds)).toBe(true);
      expect(typeof backup.reason).toBe("string");
    }
  });
});

// ── Error paths: Supabase not configured ─────────────────────────────────────

describe("AI functions — Supabase not configured", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock("@/lib/supabase", () => ({
      supabase: null,
      isSupabaseConfigured: false,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("analyzeWardrobeItemWithAi throws 'Supabase is not configured'", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { analyzeWardrobeItemWithAi } =
      require("@/lib/ai") as typeof import("@/lib/ai");
    await expect(
      analyzeWardrobeItemWithAi({
        ...baseItem,
        imageUrl: "https://example.com/img.jpg",
      }),
    ).rejects.toThrow("Supabase is not configured");
  });

  test("generateAiStylistRecommendation throws 'Supabase is not configured'", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateAiStylistRecommendation } =
      require("@/lib/ai") as typeof import("@/lib/ai");
    await expect(
      generateAiStylistRecommendation({
        items: [baseItem],
        occasion: "Office",
        weather: {
          location: "Test",
          temperatureC: 25,
          condition: "Sunny",
          rainChance: 10,
          dayPart: "Morning",
        },
        profile: {
          name: "Test",
          gender: "Woman",
          stylePreferences: ["casual"],
          occasionPreference: "office-heavy",
        },
      }),
    ).rejects.toThrow("Supabase is not configured");
  });
});

// ── Error path: item has no imageUrl ─────────────────────────────────────────

describe("analyzeWardrobeItemWithAi — missing imageUrl", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock("@/lib/supabase", () => ({
      supabase: { functions: { invoke: jest.fn() } },
      isSupabaseConfigured: true,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("throws 'needs an image' when item has no imageUrl", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { analyzeWardrobeItemWithAi } =
      require("@/lib/ai") as typeof import("@/lib/ai");
    await expect(
      analyzeWardrobeItemWithAi({ ...baseItem, imageUrl: undefined }),
    ).rejects.toThrow("needs an image");
  });
});
