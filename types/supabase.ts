export interface WardrobeItemRow {
  id: string;
  user_id: string | null;
  name: string;
  category: string;
  subcategory: string;
  fit: string;
  sleeve: string | null;
  colours: string[];
  pattern: string;
  seasons: string[];
  occasions: string[];
  formality: string;
  material: string;
  last_worn_days_ago: number;
  wear_count: number;
  favorite: boolean;
  image_url: string | null;
  image_storage_path: string | null;
  ai_status: string;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_tags: Record<string, unknown> | null;
  created_at: string;
}

export interface WardrobeItemInsert {
  name: string;
  category: string;
  subcategory: string;
  fit: string;
  sleeve?: string | null;
  colours: string[];
  pattern: string;
  seasons: string[];
  occasions: string[];
  formality: string;
  material: string;
  last_worn_days_ago: number;
  wear_count: number;
  favorite: boolean;
  image_url?: string | null;
  image_storage_path?: string | null;
  ai_status?: string;
  ai_confidence?: number | null;
  ai_summary?: string | null;
  ai_tags?: Record<string, unknown> | null;
}
