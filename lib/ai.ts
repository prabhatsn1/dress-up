import { supabase } from "@/lib/supabase";
import {
  type OccasionType,
  type UserProfile,
  type WardrobeItem,
  type WeatherSnapshot,
} from "@/lib/wardrobe";

export interface WardrobeAiAnalysis {
  name: string;
  category: WardrobeItem["category"];
  subcategory: string;
  fit: WardrobeItem["fit"];
  sleeve?: WardrobeItem["sleeve"];
  colours: string[];
  pattern: WardrobeItem["pattern"];
  seasons: WardrobeItem["seasons"];
  occasions: WardrobeItem["occasions"];
  formality: WardrobeItem["formality"];
  material: string;
  confidence: number;
  summary: string;
  styleNotes: string[];
  segmentationLabels: string[];
  backgroundRemovalSuggested: boolean;
}

export interface AiStylistRecommendation {
  headline: string;
  confidence: number;
  summary: string;
  reasons: string[];
  primaryItemIds: string[];
  backupOptions: Array<{
    itemIds: string[];
    reason: string;
  }>;
  accessorySuggestion?: string;
  stylistNote: string;
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured, so the AI function cannot be invoked.",
    );
  }

  return supabase;
}

export async function analyzeWardrobeItemWithAi(item: WardrobeItem) {
  const client = ensureSupabase();

  if (!item.imageUrl) {
    throw new Error("This item needs an image before AI analysis can run.");
  }

  const { data, error } = await client.functions.invoke("wardrobe-ai", {
    body: {
      action: "analyze-item",
      itemId: item.id,
      imageUrl: item.imageUrl,
      itemName: item.name,
    },
  });

  if (error) {
    throw error;
  }

  return data as WardrobeAiAnalysis;
}

export async function generateAiStylistRecommendation(input: {
  items: WardrobeItem[];
  occasion: OccasionType;
  weather: WeatherSnapshot;
  profile: UserProfile;
}) {
  const client = ensureSupabase();
  const { data, error } = await client.functions.invoke("wardrobe-ai", {
    body: {
      action: "generate-outfit",
      profile: input.profile,
      items: input.items,
      occasion: input.occasion,
      weather: input.weather,
    },
  });

  if (error) {
    throw error;
  }

  return data as AiStylistRecommendation;
}

export function mergeAiAnalysisIntoWardrobeItem(
  item: WardrobeItem,
  analysis: WardrobeAiAnalysis,
): WardrobeItem {
  return {
    ...item,
    name: analysis.name || item.name,
    category: analysis.category,
    subcategory: analysis.subcategory,
    fit: analysis.fit,
    sleeve: analysis.sleeve,
    colours: analysis.colours.length > 0 ? analysis.colours : item.colours,
    pattern: analysis.pattern,
    seasons: analysis.seasons.length > 0 ? analysis.seasons : item.seasons,
    occasions:
      analysis.occasions.length > 0 ? analysis.occasions : item.occasions,
    formality: analysis.formality,
    material: analysis.material,
    aiStatus: "completed",
    aiConfidence: analysis.confidence,
    aiSummary: analysis.summary,
    aiTags: {
      styleNotes: analysis.styleNotes,
      segmentationLabels: analysis.segmentationLabels,
      backgroundRemovalSuggested: analysis.backgroundRemovalSuggested,
    },
  };
}
