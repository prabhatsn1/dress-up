/**
 * Tests for pure functions in lib/wardrobe.ts.
 * No mocking needed — these are deterministic data-in / data-out functions.
 */

import {
  buildGapInsights,
  buildRecommendations,
  buildWeeklyPlan,
  filterWardrobe,
  getWardrobeStats,
  userProfile,
  wardrobeItems,
  todayWeather,
  type OccasionType,
  type UserProfile,
  type WardrobeItem,
  type WeatherSnapshot,
} from "@/lib/wardrobe";

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const baseWeather: WeatherSnapshot = {
  location: "Test City",
  temperatureC: 25,
  condition: "Sunny",
  rainChance: 10,
  dayPart: "Morning",
  feelsLikeC: 26,
  humidity: 50,
  windKph: 10,
  source: "Sample",
};

const minimalProfile: UserProfile = {
  name: "Test User",
  gender: "Woman",
  stylePreferences: ["casual"],
  occasionPreference: "office-heavy",
};

// A minimal wardrobe that guarantees at least one top + bottom + shoe for "Office"
const officeTop: WardrobeItem = {
  id: "t-1",
  name: "White Office Shirt",
  category: "Top",
  subcategory: "Shirt",
  fit: "regular",
  sleeve: "long",
  colours: ["white"],
  pattern: "solid",
  seasons: ["all-season"],
  occasions: ["Office"],
  formality: "formal",
  material: "cotton",
  lastWornDaysAgo: 15,
  wearCount: 5,
  favorite: false,
};

const officeBottom: WardrobeItem = {
  id: "b-1",
  name: "Navy Trousers",
  category: "Bottom",
  subcategory: "Trousers",
  fit: "regular",
  colours: ["navy"],
  pattern: "solid",
  seasons: ["all-season"],
  occasions: ["Office"],
  formality: "formal",
  material: "polyester",
  lastWornDaysAgo: 8,
  wearCount: 3,
  favorite: false,
};

const officeShoe: WardrobeItem = {
  id: "s-1",
  name: "Black Oxford Shoes",
  category: "Shoes",
  subcategory: "Oxford",
  fit: "regular",
  colours: ["black"],
  pattern: "solid",
  seasons: ["all-season"],
  occasions: ["Office"],
  formality: "formal",
  material: "leather",
  lastWornDaysAgo: 12,
  wearCount: 8,
  favorite: true,
};

const minimalOfficeWardrobe: WardrobeItem[] = [
  officeTop,
  officeBottom,
  officeShoe,
];

// ─── buildRecommendations ────────────────────────────────────────────────────

describe("buildRecommendations", () => {
  test("returns at most 5 suggestions", () => {
    const results = buildRecommendations(wardrobeItems, userProfile, {
      occasion: "Office",
      weather: todayWeather,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  test("returns an empty array when no items match the occasion", () => {
    const gymOnlyItem: WardrobeItem = {
      ...officeTop,
      id: "gym-top",
      occasions: ["Gym"],
    };
    const results = buildRecommendations([gymOnlyItem], minimalProfile, {
      occasion: "Office",
      weather: baseWeather,
    });
    expect(results).toHaveLength(0);
  });

  test("results are sorted highest confidence first", () => {
    const results = buildRecommendations(wardrobeItems, userProfile, {
      occasion: "Office",
      weather: todayWeather,
    });
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  test("each outfit contains at least a Top, Bottom, and Shoes", () => {
    const results = buildRecommendations(
      minimalOfficeWardrobe,
      minimalProfile,
      {
        occasion: "Office",
        weather: baseWeather,
      },
    );
    expect(results.length).toBeGreaterThan(0);
    for (const outfit of results) {
      const categories = outfit.items.map((i) => i.category);
      expect(categories).toContain("Top");
      expect(categories).toContain("Bottom");
      expect(categories).toContain("Shoes");
    }
  });

  test("adds outerwear when temperature is cold (<=22°C)", () => {
    const coat: WardrobeItem = {
      id: "coat-1",
      name: "Grey Coat",
      category: "Outerwear",
      subcategory: "Coat",
      fit: "regular",
      sleeve: "long",
      colours: ["grey"],
      pattern: "solid",
      seasons: ["winter"],
      occasions: ["Office"],
      formality: "formal",
      material: "wool",
      lastWornDaysAgo: 20,
      wearCount: 2,
      favorite: false,
    };
    const coldWeather: WeatherSnapshot = {
      ...baseWeather,
      temperatureC: 18,
      condition: "Cloudy",
    };
    const results = buildRecommendations(
      [...minimalOfficeWardrobe, coat],
      minimalProfile,
      { occasion: "Office", weather: coldWeather },
    );
    expect(results.length).toBeGreaterThan(0);
    const hasOuterwear = results[0].items.some(
      (i) => i.category === "Outerwear",
    );
    expect(hasOuterwear).toBe(true);
  });

  test("confidence is clamped between 68 and 97", () => {
    const results = buildRecommendations(wardrobeItems, userProfile, {
      occasion: "Casual",
      weather: todayWeather,
    });
    for (const outfit of results) {
      expect(outfit.confidence).toBeGreaterThanOrEqual(68);
      expect(outfit.confidence).toBeLessThanOrEqual(97);
    }
  });

  test("outfit id encodes the item ids used", () => {
    const results = buildRecommendations(
      minimalOfficeWardrobe,
      minimalProfile,
      {
        occasion: "Office",
        weather: baseWeather,
      },
    );
    expect(results[0].id).toBe("t-1-b-1-s-1");
  });

  test("favorite items boost score vs non-favorite equivalent", () => {
    const favTop: WardrobeItem = { ...officeTop, id: "t-fav", favorite: true };
    const nonFavTop: WardrobeItem = {
      ...officeTop,
      id: "t-nonfav",
      favorite: false,
    };

    const withFav = buildRecommendations(
      [favTop, officeBottom, officeShoe],
      minimalProfile,
      { occasion: "Office", weather: baseWeather },
    );
    const withoutFav = buildRecommendations(
      [nonFavTop, officeBottom, officeShoe],
      minimalProfile,
      { occasion: "Office", weather: baseWeather },
    );

    expect(withFav[0].score).toBeGreaterThan(withoutFav[0].score);
  });

  test("recently worn items (<=2 days) score lower than items worn 10+ days ago", () => {
    const freshTop: WardrobeItem = {
      ...officeTop,
      id: "t-fresh",
      lastWornDaysAgo: 1,
    };
    const stalTop: WardrobeItem = {
      ...officeTop,
      id: "t-stale",
      lastWornDaysAgo: 14,
    };

    const withFresh = buildRecommendations(
      [freshTop, officeBottom, officeShoe],
      minimalProfile,
      { occasion: "Office", weather: baseWeather },
    )[0].score;

    const withStale = buildRecommendations(
      [stalTop, officeBottom, officeShoe],
      minimalProfile,
      { occasion: "Office", weather: baseWeather },
    )[0].score;

    expect(withStale).toBeGreaterThan(withFresh);
  });

  test("occasion mismatch penalises score", () => {
    const wrongOccasionTop: WardrobeItem = {
      ...officeTop,
      id: "t-gym",
      occasions: ["Gym"],
    };
    // wardrobe has no "Office" top — should return empty
    const results = buildRecommendations(
      [wrongOccasionTop, officeBottom, officeShoe],
      minimalProfile,
      { occasion: "Office", weather: baseWeather },
    );
    expect(results).toHaveLength(0);
  });
});

// ─── filterWardrobe ──────────────────────────────────────────────────────────

describe("filterWardrobe", () => {
  test("returns all items when category is All and query is empty", () => {
    expect(filterWardrobe(wardrobeItems, "All", "")).toHaveLength(
      wardrobeItems.length,
    );
  });

  test("filters by category", () => {
    const tops = filterWardrobe(wardrobeItems, "Top", "");
    expect(tops.every((i) => i.category === "Top")).toBe(true);
    expect(tops.length).toBeGreaterThan(0);
  });

  test("filters by text query (case-insensitive)", () => {
    const results = filterWardrobe(wardrobeItems, "All", "oxford");
    expect(results.length).toBeGreaterThan(0);
    results.forEach((item) => {
      const text = [item.name, item.subcategory, item.material]
        .join(" ")
        .toLowerCase();
      expect(text).toContain("oxford");
    });
  });

  test("returns empty array when query matches nothing", () => {
    expect(filterWardrobe(wardrobeItems, "All", "zzznomatch")).toHaveLength(0);
  });

  test("category and query filters combine with AND logic", () => {
    const results = filterWardrobe(wardrobeItems, "Top", "linen");
    expect(results.every((i) => i.category === "Top")).toBe(true);
    results.forEach((item) => {
      const text = [item.name, item.subcategory, item.material]
        .join(" ")
        .toLowerCase();
      expect(text).toContain("linen");
    });
  });
});

// ─── getWardrobeStats ────────────────────────────────────────────────────────

describe("getWardrobeStats", () => {
  test("total matches item count", () => {
    const stats = getWardrobeStats(wardrobeItems);
    expect(stats.total).toBe(wardrobeItems.length);
  });

  test("favorites count matches items marked favorite", () => {
    const expected = wardrobeItems.filter((i) => i.favorite).length;
    expect(getWardrobeStats(wardrobeItems).favorites).toBe(expected);
  });

  test("underused count matches items not worn for 14+ days", () => {
    const expected = wardrobeItems.filter(
      (i) => i.lastWornDaysAgo >= 14,
    ).length;
    expect(getWardrobeStats(wardrobeItems).underused).toBe(expected);
  });

  test("officeReady count matches items with Office in occasions", () => {
    const expected = wardrobeItems.filter((i) =>
      i.occasions.includes("Office"),
    ).length;
    expect(getWardrobeStats(wardrobeItems).officeReady).toBe(expected);
  });

  test("returns zeros for empty wardrobe", () => {
    const stats = getWardrobeStats([]);
    expect(stats).toEqual({
      total: 0,
      favorites: 0,
      underused: 0,
      officeReady: 0,
    });
  });
});

// ─── buildGapInsights ────────────────────────────────────────────────────────

describe("buildGapInsights", () => {
  test("returns an array", () => {
    expect(Array.isArray(buildGapInsights(wardrobeItems))).toBe(true);
  });

  test("flags underused items when present", () => {
    const staleItem: WardrobeItem = {
      ...officeTop,
      id: "t-stale",
      lastWornDaysAgo: 20,
    };
    const insights = buildGapInsights([staleItem]);
    const hasUnused = insights.some(
      (i) =>
        i.title === "Hidden value in the closet" ||
        i.title === "Underused pieces piling up",
    );
    expect(hasUnused).toBe(true);
  });

  test("returns only structural insights for empty wardrobe (no items to flag)", () => {
    // With 0 items, only the "formalShoes.length < 2" rule fires (structural gap).
    // No underused/unworn items → no item-specific insights.
    const insights = buildGapInsights([]);
    expect(insights.some((i) => i.title === "Hidden value in the closet")).toBe(
      false,
    );
    expect(insights.some((i) => i.title === "Underused pieces piling up")).toBe(
      false,
    );
  });

  test("each insight has a title and detail string", () => {
    const insights = buildGapInsights(wardrobeItems);
    for (const insight of insights) {
      expect(typeof insight.title).toBe("string");
      expect(typeof insight.detail).toBe("string");
      expect(insight.title.length).toBeGreaterThan(0);
      expect(insight.detail.length).toBeGreaterThan(0);
    }
  });
});

// ─── buildWeeklyPlan ─────────────────────────────────────────────────────────

describe("buildWeeklyPlan", () => {
  test("always returns exactly 7 entries", () => {
    const plan = buildWeeklyPlan(wardrobeItems, userProfile, baseWeather);
    expect(plan).toHaveLength(7);
  });

  test("days are Mon through Sun", () => {
    const plan = buildWeeklyPlan(wardrobeItems, userProfile, baseWeather);
    expect(plan.map((e) => e.day)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
  });

  test("each entry has a valid outfit with items", () => {
    const plan = buildWeeklyPlan(wardrobeItems, userProfile, baseWeather);
    for (const entry of plan) {
      expect(entry.outfit).toBeDefined();
      expect(entry.outfit.items.length).toBeGreaterThan(0);
    }
  });

  test("uses the provided base weather for temperature", () => {
    const coldBase: WeatherSnapshot = {
      ...baseWeather,
      temperatureC: 10,
      condition: "Rain",
    };
    const plan = buildWeeklyPlan(wardrobeItems, userProfile, coldBase);
    // The contexts inside buildWeeklyPlan spread over baseWeather, so each entry's
    // weather should include the cold temperature
    for (const entry of plan) {
      expect(entry.context.weather.location).toBe(coldBase.location);
    }
  });
});
