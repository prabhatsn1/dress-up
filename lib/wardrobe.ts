export type GenderIdentity = "Woman" | "Man" | "Non-binary";
export type BodyShape =
  | "slim"
  | "athletic"
  | "pear"
  | "apple"
  | "hourglass"
  | "rectangle";
export type StylePreference =
  | "casual"
  | "formal"
  | "street"
  | "ethnic"
  | "minimal";
export type OccasionType =
  | "Office"
  | "Party"
  | "Date"
  | "Wedding"
  | "Casual"
  | "Gym"
  | "Travel";
export type Category = "Top" | "Bottom" | "Outerwear" | "Shoes" | "Accessory";
export type Season = "summer" | "winter" | "monsoon" | "all-season";
export type Formality =
  | "casual"
  | "smart"
  | "formal"
  | "festive"
  | "athleisure";
export type AiStatus = "idle" | "pending" | "completed" | "failed";

export interface WardrobeAiTags {
  styleNotes: string[];
  segmentationLabels: string[];
  backgroundRemovalSuggested: boolean;
}

export interface UserProfile {
  name: string;
  gender: GenderIdentity;
  height?: string;
  weight?: string;
  bodyShape?: BodyShape;
  skinTone?: string;
  stylePreferences: StylePreference[];
  occasionPreference: "office-heavy" | "social-heavy" | "travel-heavy";
}

export interface WardrobeItem {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  fit: "slim" | "regular" | "oversized";
  sleeve?: "sleeveless" | "short" | "long";
  colours: string[];
  pattern: "solid" | "stripes" | "checks" | "textured";
  seasons: Season[];
  occasions: OccasionType[];
  formality: Formality;
  material: string;
  lastWornDaysAgo: number;
  wearCount: number;
  favorite: boolean;
  imageUrl?: string;
  imageStoragePath?: string;
  source?: "seed" | "camera" | "library" | "supabase";
  aiStatus?: AiStatus;
  aiConfidence?: number;
  aiSummary?: string;
  aiTags?: WardrobeAiTags;
}

export interface WeatherSnapshot {
  location: string;
  temperatureC: number;
  condition: "Sunny" | "Cloudy" | "Rain";
  rainChance: number;
  dayPart: "Morning" | "Afternoon" | "Evening";
  feelsLikeC?: number;
  humidity?: number;
  windKph?: number;
  source?: "WeatherAPI" | "Open-Meteo" | "Sample";
  lastUpdated?: string;
}

export interface RecommendationContext {
  occasion: OccasionType;
  weather: WeatherSnapshot;
}

export interface OutfitSuggestion {
  id: string;
  name: string;
  confidence: number;
  score: number;
  items: WardrobeItem[];
  accessorySuggestion?: WardrobeItem;
  reasons: string[];
  note: string;
}

export interface WeeklyPlanEntry {
  day: string;
  context: RecommendationContext;
  outfit: OutfitSuggestion;
}

export interface GapInsight {
  title: string;
  detail: string;
}

const formalityTargets: Record<OccasionType, Formality[]> = {
  Office: ["smart", "formal"],
  Party: ["smart", "festive"],
  Date: ["smart", "casual"],
  Wedding: ["festive", "formal"],
  Casual: ["casual", "smart"],
  Gym: ["athleisure", "casual"],
  Travel: ["casual", "smart"],
};

const styleMappings: Record<StylePreference, Formality[]> = {
  casual: ["casual", "smart"],
  formal: ["formal", "smart"],
  street: ["casual", "athleisure"],
  ethnic: ["festive", "formal"],
  minimal: ["smart", "casual"],
};

const neutralColours = new Set([
  "black",
  "white",
  "charcoal",
  "grey",
  "navy",
  "beige",
  "brown",
  "tan",
  "olive",
  "cream",
]);

const colourPartners: Record<string, string[]> = {
  blue: ["white", "charcoal", "beige", "brown", "navy"],
  white: ["blue", "charcoal", "black", "beige", "olive"],
  beige: ["blue", "white", "brown", "olive", "black"],
  black: ["white", "grey", "beige", "emerald", "blue"],
  olive: ["white", "cream", "black", "brown", "beige"],
  emerald: ["black", "cream", "beige", "brown"],
  grey: ["white", "black", "blue", "olive"],
};

export const userProfile: UserProfile = {
  name: "Avery Kapoor",
  gender: "Woman",
  height: "5 ft 7 in",
  skinTone: "Warm medium",
  stylePreferences: ["minimal", "formal", "ethnic"],
  occasionPreference: "office-heavy",
};

export const wardrobeItems: WardrobeItem[] = [
  {
    id: "top-1",
    name: "Blue Oxford Shirt",
    category: "Top",
    subcategory: "Shirt",
    fit: "regular",
    sleeve: "long",
    colours: ["blue"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Office", "Date", "Travel"],
    formality: "formal",
    material: "cotton",
    lastWornDaysAgo: 8,
    wearCount: 11,
    favorite: true,
  },
  {
    id: "top-2",
    name: "White Rib Tee",
    category: "Top",
    subcategory: "T-Shirt",
    fit: "regular",
    sleeve: "short",
    colours: ["white"],
    pattern: "solid",
    seasons: ["summer", "all-season"],
    occasions: ["Casual", "Travel", "Gym"],
    formality: "casual",
    material: "cotton",
    lastWornDaysAgo: 2,
    wearCount: 20,
    favorite: false,
  },
  {
    id: "top-3",
    name: "Beige Linen Shirt",
    category: "Top",
    subcategory: "Shirt",
    fit: "regular",
    sleeve: "long",
    colours: ["beige"],
    pattern: "textured",
    seasons: ["summer"],
    occasions: ["Office", "Casual", "Travel"],
    formality: "smart",
    material: "linen",
    lastWornDaysAgo: 14,
    wearCount: 7,
    favorite: true,
  },
  {
    id: "top-4",
    name: "Black Knit Polo",
    category: "Top",
    subcategory: "Polo",
    fit: "slim",
    sleeve: "short",
    colours: ["black"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Office", "Date", "Party"],
    formality: "smart",
    material: "knit",
    lastWornDaysAgo: 6,
    wearCount: 10,
    favorite: true,
  },
  {
    id: "top-5",
    name: "Emerald Festive Kurta",
    category: "Top",
    subcategory: "Kurta",
    fit: "regular",
    sleeve: "long",
    colours: ["emerald"],
    pattern: "textured",
    seasons: ["all-season"],
    occasions: ["Wedding", "Party"],
    formality: "festive",
    material: "silk blend",
    lastWornDaysAgo: 35,
    wearCount: 3,
    favorite: false,
  },
  {
    id: "top-6",
    name: "Grey Performance Tank",
    category: "Top",
    subcategory: "Tank",
    fit: "regular",
    sleeve: "sleeveless",
    colours: ["grey"],
    pattern: "solid",
    seasons: ["summer", "all-season"],
    occasions: ["Gym"],
    formality: "athleisure",
    material: "performance mesh",
    lastWornDaysAgo: 4,
    wearCount: 16,
    favorite: false,
  },
  {
    id: "bottom-1",
    name: "Charcoal Tailored Trousers",
    category: "Bottom",
    subcategory: "Trousers",
    fit: "slim",
    colours: ["charcoal"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Office", "Date", "Party"],
    formality: "formal",
    material: "wool blend",
    lastWornDaysAgo: 9,
    wearCount: 12,
    favorite: true,
  },
  {
    id: "bottom-2",
    name: "Dark Indigo Jeans",
    category: "Bottom",
    subcategory: "Jeans",
    fit: "regular",
    colours: ["blue"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Casual", "Travel", "Date"],
    formality: "casual",
    material: "denim",
    lastWornDaysAgo: 3,
    wearCount: 19,
    favorite: true,
  },
  {
    id: "bottom-3",
    name: "Beige Chinos",
    category: "Bottom",
    subcategory: "Chinos",
    fit: "regular",
    colours: ["beige"],
    pattern: "solid",
    seasons: ["summer", "all-season"],
    occasions: ["Office", "Casual", "Travel"],
    formality: "smart",
    material: "cotton twill",
    lastWornDaysAgo: 11,
    wearCount: 8,
    favorite: false,
  },
  {
    id: "bottom-4",
    name: "Black Training Joggers",
    category: "Bottom",
    subcategory: "Joggers",
    fit: "regular",
    colours: ["black"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Gym", "Travel", "Casual"],
    formality: "athleisure",
    material: "performance knit",
    lastWornDaysAgo: 1,
    wearCount: 14,
    favorite: false,
  },
  {
    id: "bottom-5",
    name: "Cream Wide-Leg Trousers",
    category: "Bottom",
    subcategory: "Trousers",
    fit: "regular",
    colours: ["cream"],
    pattern: "solid",
    seasons: ["summer", "all-season"],
    occasions: ["Office", "Date", "Party"],
    formality: "smart",
    material: "crepe",
    lastWornDaysAgo: 18,
    wearCount: 6,
    favorite: true,
  },
  {
    id: "outer-1",
    name: "Camel Lightweight Blazer",
    category: "Outerwear",
    subcategory: "Blazer",
    fit: "regular",
    sleeve: "long",
    colours: ["brown"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Office", "Date", "Party"],
    formality: "formal",
    material: "cotton blend",
    lastWornDaysAgo: 13,
    wearCount: 5,
    favorite: false,
  },
  {
    id: "outer-2",
    name: "Olive Utility Jacket",
    category: "Outerwear",
    subcategory: "Jacket",
    fit: "oversized",
    sleeve: "long",
    colours: ["olive"],
    pattern: "solid",
    seasons: ["winter", "monsoon"],
    occasions: ["Travel", "Casual"],
    formality: "casual",
    material: "canvas",
    lastWornDaysAgo: 21,
    wearCount: 4,
    favorite: false,
  },
  {
    id: "shoe-1",
    name: "Brown Leather Loafers",
    category: "Shoes",
    subcategory: "Loafers",
    fit: "regular",
    colours: ["brown"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Office", "Date", "Party"],
    formality: "formal",
    material: "leather",
    lastWornDaysAgo: 7,
    wearCount: 10,
    favorite: true,
  },
  {
    id: "shoe-2",
    name: "White Leather Sneakers",
    category: "Shoes",
    subcategory: "Sneakers",
    fit: "regular",
    colours: ["white"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Casual", "Travel", "Date"],
    formality: "casual",
    material: "leather",
    lastWornDaysAgo: 5,
    wearCount: 17,
    favorite: true,
  },
  {
    id: "shoe-3",
    name: "Black Running Shoes",
    category: "Shoes",
    subcategory: "Runners",
    fit: "regular",
    colours: ["black"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Gym", "Travel"],
    formality: "athleisure",
    material: "mesh",
    lastWornDaysAgo: 2,
    wearCount: 15,
    favorite: false,
  },
  {
    id: "acc-1",
    name: "Gold Hoop Earrings",
    category: "Accessory",
    subcategory: "Jewellery",
    fit: "regular",
    colours: ["gold"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Office", "Date", "Wedding", "Party"],
    formality: "smart",
    material: "metal",
    lastWornDaysAgo: 10,
    wearCount: 12,
    favorite: true,
  },
  {
    id: "acc-2",
    name: "Tan Structured Tote",
    category: "Accessory",
    subcategory: "Bag",
    fit: "regular",
    colours: ["tan"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: ["Office", "Travel"],
    formality: "smart",
    material: "vegan leather",
    lastWornDaysAgo: 3,
    wearCount: 11,
    favorite: false,
  },
];

export const todayWeather: WeatherSnapshot = {
  location: "Bengaluru",
  temperatureC: 30,
  condition: "Sunny",
  rainChance: 18,
  dayPart: "Morning",
  feelsLikeC: 32,
  humidity: 46,
  windKph: 11,
  source: "Sample",
  lastUpdated: "Fallback sample weather",
};

function getItemsByCategory(items: WardrobeItem[], category: Category) {
  return items.filter((item) => item.category === category);
}

function getTemperatureScore(item: WardrobeItem, weather: WeatherSnapshot) {
  if (weather.temperatureC >= 29) {
    if (item.material.includes("linen") || item.material.includes("cotton")) {
      return 10;
    }

    if (item.category === "Outerwear") {
      return -8;
    }
  }

  if (weather.temperatureC <= 20 && item.category === "Outerwear") {
    return 9;
  }

  if (
    weather.condition === "Rain" &&
    item.category === "Shoes" &&
    item.colours.includes("white")
  ) {
    return -10;
  }

  return 2;
}

function getOccasionScore(item: WardrobeItem, occasion: OccasionType) {
  let score = item.occasions.includes(occasion) ? 14 : -10;

  if (formalityTargets[occasion].includes(item.formality)) {
    score += 8;
  }

  return score;
}

function getProfileScore(item: WardrobeItem, profile: UserProfile) {
  const preferenceMatch = profile.stylePreferences.some((style) =>
    styleMappings[style].includes(item.formality),
  );

  let score = preferenceMatch ? 6 : 0;

  if (
    profile.occasionPreference === "office-heavy" &&
    item.occasions.includes("Office")
  ) {
    score += 4;
  }

  if (item.favorite) {
    score += 3;
  }

  return score;
}

function getRotationScore(item: WardrobeItem) {
  if (item.lastWornDaysAgo >= 10) {
    return 7;
  }

  if (item.lastWornDaysAgo <= 2) {
    return -4;
  }

  return 2;
}

function getColourHarmonyScore(items: WardrobeItem[]) {
  const colours = items.flatMap((item) => item.colours);
  let score = 0;

  for (let index = 0; index < colours.length - 1; index += 1) {
    const current = colours[index];
    const next = colours[index + 1];

    if (current === next) {
      score += 3;
      continue;
    }

    if (neutralColours.has(current) || neutralColours.has(next)) {
      score += 4;
      continue;
    }

    if (
      colourPartners[current]?.includes(next) ||
      colourPartners[next]?.includes(current)
    ) {
      score += 6;
      continue;
    }

    score -= 2;
  }

  return score;
}

function getAccessory(
  items: WardrobeItem[],
  occasion: OccasionType,
  outfit: WardrobeItem[],
): WardrobeItem | undefined {
  const accessory = getItemsByCategory(items, "Accessory").find(
    (item) =>
      item.occasions.includes(occasion) &&
      (neutralColours.has(item.colours[0]) ||
        outfit.some((outfitItem) =>
          colourPartners[outfitItem.colours[0]]?.includes(item.colours[0]),
        )),
  );

  return accessory;
}

function buildReasons(
  outfit: WardrobeItem[],
  accessory: WardrobeItem | undefined,
  context: RecommendationContext,
) {
  const reasons: string[] = [];
  const { weather, occasion } = context;

  if (weather.temperatureC >= 29) {
    reasons.push(
      "Lightweight fabrics keep the look breathable for a warm day.",
    );
  }

  if (weather.condition === "Rain") {
    reasons.push("Shoe choice avoids delicate light pairs in possible rain.");
  }

  if (occasion === "Office") {
    reasons.push(
      "The outfit balances polished pieces with relaxed structure for work.",
    );
  }

  if (occasion === "Travel") {
    reasons.push(
      "Comfort-first pieces make the outfit easy to repeat across transit and city time.",
    );
  }

  if (outfit.some((item) => item.lastWornDaysAgo >= 10)) {
    reasons.push(
      "It rotates in an underused piece so your closet gets more mileage.",
    );
  }

  if (accessory) {
    reasons.push(
      `${accessory.name} completes the outfit without adding styling friction.`,
    );
  }

  return reasons.slice(0, 4);
}

function buildOutfitName(items: WardrobeItem[]) {
  const top = items.find((item) => item.category === "Top");
  const bottom = items.find((item) => item.category === "Bottom");

  if (!top || !bottom) {
    return "Smart outfit";
  }

  return `${top.colours[0]} ${top.subcategory.toLowerCase()} with ${bottom.subcategory.toLowerCase()}`;
}

export function buildRecommendations(
  items: WardrobeItem[],
  profile: UserProfile,
  context: RecommendationContext,
) {
  const tops = getItemsByCategory(items, "Top").filter((item) =>
    item.occasions.includes(context.occasion),
  );
  const bottoms = getItemsByCategory(items, "Bottom").filter((item) =>
    item.occasions.includes(context.occasion),
  );
  const shoes = getItemsByCategory(items, "Shoes").filter((item) =>
    item.occasions.includes(context.occasion),
  );
  const outerwear = getItemsByCategory(items, "Outerwear").filter((item) =>
    item.occasions.includes(context.occasion),
  );

  const suggestions: OutfitSuggestion[] = [];

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        const outfitItems = [top, bottom, shoe];

        if (
          context.weather.temperatureC <= 22 ||
          context.weather.condition === "Rain"
        ) {
          const bestLayer = outerwear[0];

          if (bestLayer) {
            outfitItems.push(bestLayer);
          }
        }

        const accessory = getAccessory(items, context.occasion, outfitItems);
        const itemScore = outfitItems.reduce(
          (total, item) =>
            total +
            getOccasionScore(item, context.occasion) +
            getTemperatureScore(item, context.weather) +
            getProfileScore(item, profile) +
            getRotationScore(item),
          0,
        );
        const harmonyScore = getColourHarmonyScore(outfitItems);
        const totalScore = itemScore + harmonyScore;
        const confidence = Math.max(
          68,
          Math.min(97, 68 + Math.round(totalScore / 6)),
        );

        suggestions.push({
          id: `${top.id}-${bottom.id}-${shoe.id}`,
          name: buildOutfitName(outfitItems),
          confidence,
          score: totalScore,
          items: outfitItems,
          accessorySuggestion: accessory,
          reasons: buildReasons(outfitItems, accessory, context),
          note:
            confidence >= 90
              ? "Best match today"
              : "Strong backup if you want a slightly different vibe",
        });
      }
    }
  }

  return suggestions
    .sort((first, second) => second.score - first.score)
    .slice(0, 5);
}

export function buildGapInsights(items: WardrobeItem[]) {
  const tops = items.filter((item) => item.category === "Top");
  const bottoms = items.filter((item) => item.category === "Bottom");
  const formalShoes = items.filter(
    (item) => item.category === "Shoes" && item.formality === "formal",
  );
  const blueTops = tops.filter((item) => item.colours.includes("blue")).length;
  const beigeBottoms = bottoms.filter((item) =>
    item.colours.includes("beige"),
  ).length;
  const underused = items.filter((item) => item.lastWornDaysAgo >= 14);

  const insights: GapInsight[] = [];

  if (blueTops >= 1 && beigeBottoms === 0) {
    insights.push({
      title: "Gap in warm neutrals",
      detail:
        "You have blue tops in rotation, but no beige bottom that broadens summer office pairings.",
    });
  }

  if (formalShoes.length < 2) {
    insights.push({
      title: "Formal shoe depth is thin",
      detail:
        "A second polished shoe option would reduce repetition for office and event looks.",
    });
  }

  if (underused.length > 0) {
    insights.push({
      title: "Hidden value in the closet",
      detail: `${underused[0].name} has been untouched for ${underused[0].lastWornDaysAgo} days and is worth reintroducing.`,
    });
  }

  const longUnworn = items.filter((item) => (item.lastWornDaysAgo ?? 99) > 60);
  if (longUnworn.length > 0) {
    insights.push({
      title: "Underused pieces piling up",
      detail: `${longUnworn.length} items haven't been worn in 60+ days`,
    });
  }

  return insights;
}

export function buildWeeklyPlan(
  items: WardrobeItem[],
  profile: UserProfile,
  baseWeather: WeatherSnapshot = todayWeather,
) {
  const contexts: WeeklyPlanEntry["context"][] = [
    {
      occasion: "Office",
      weather: {
        ...baseWeather,
        dayPart: "Morning",
        temperatureC: 29,
        condition: "Sunny",
      },
    },
    {
      occasion: "Office",
      weather: {
        ...baseWeather,
        dayPart: "Morning",
        temperatureC: 31,
        condition: "Sunny",
      },
    },
    {
      occasion: "Casual",
      weather: {
        ...baseWeather,
        dayPart: "Afternoon",
        temperatureC: 30,
        condition: "Cloudy",
      },
    },
    {
      occasion: "Office",
      weather: {
        ...baseWeather,
        dayPart: "Morning",
        temperatureC: 28,
        condition: "Rain",
      },
    },
    {
      occasion: "Party",
      weather: {
        ...baseWeather,
        dayPart: "Evening",
        temperatureC: 26,
        condition: "Cloudy",
      },
    },
    {
      occasion: "Date",
      weather: {
        ...baseWeather,
        dayPart: "Evening",
        temperatureC: 27,
        condition: "Sunny",
      },
    },
    {
      occasion: "Travel",
      weather: {
        ...baseWeather,
        dayPart: "Morning",
        temperatureC: 29,
        condition: "Cloudy",
      },
    },
  ];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return days.map((day, index) => ({
    day,
    context: contexts[index],
    outfit: buildRecommendations(items, profile, contexts[index])[0],
  }));
}

export function buildPackingList(plan: WeeklyPlanEntry[]) {
  const selectedDays = plan.filter(
    (entry, index) =>
      entry.context.occasion === "Travel" || index >= plan.length - 3,
  );
  const uniqueItems = new Map<string, WardrobeItem>();

  for (const entry of selectedDays) {
    for (const item of entry.outfit.items) {
      uniqueItems.set(item.id, item);
    }
  }

  return Array.from(uniqueItems.values());
}

export function filterWardrobe(
  items: WardrobeItem[],
  category: Category | "All",
  query: string,
) {
  return items.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const text = [
      item.name,
      item.subcategory,
      item.fit,
      item.pattern,
      item.material,
      ...item.colours,
      ...item.occasions,
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery =
      query.trim().length === 0 || text.includes(query.trim().toLowerCase());

    return matchesCategory && matchesQuery;
  });
}

export function getWardrobeStats(items: WardrobeItem[]) {
  const favorites = items.filter((item) => item.favorite).length;
  const underused = items.filter((item) => item.lastWornDaysAgo >= 14).length;
  const officeReady = items.filter((item) =>
    item.occasions.includes("Office"),
  ).length;

  return {
    total: items.length,
    favorites,
    underused,
    officeReady,
  };
}
