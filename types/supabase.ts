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
  is_dirty: boolean;
  image_url: string | null;
  image_storage_path: string | null;
  ai_status: string;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_tags: Record<string, unknown> | null;
  purchase_price: number | null;
  purchase_date: string | null;
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
  is_dirty?: boolean | null;
  image_url?: string | null;
  image_storage_path?: string | null;
  ai_status?: string;
  ai_confidence?: number | null;
  ai_summary?: string | null;
  ai_tags?: Record<string, unknown> | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
}

export interface OutfitItemSnapshot {
  id: string;
  name: string;
  category: string;
  colours: string[];
  formality: string;
  imageUrl?: string;
}

export interface OutfitLogRow {
  id: string;
  user_id: string;
  worn_date: string;
  item_ids: string[];
  outfit_key: string;
  occasion: string | null;
  temperature_c: number | null;
  weather_condition: string | null;
  location_name: string | null;
  item_snapshot: OutfitItemSnapshot[];
  color_palette: string[];
  formality: string | null;
  notes: string | null;
  rating: number | null;
  rating_note: string | null;
  created_at: string;
}

export interface OutfitLogInsert {
  id?: string;
  user_id: string;
  worn_date: string;
  item_ids: string[];
  occasion?: string | null;
  temperature_c?: number | null;
  weather_condition?: string | null;
  location_name?: string | null;
  item_snapshot?: OutfitItemSnapshot[];
  color_palette?: string[];
  formality?: string | null;
  notes?: string | null;
  rating?: number | null;
  rating_note?: string | null;
}
