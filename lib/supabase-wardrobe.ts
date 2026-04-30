import type { ImagePickerAsset } from "expo-image-picker";

import { supabase, wardrobeBucketName } from "@/lib/supabase";
import type { WardrobeItem } from "@/lib/wardrobe";
import type { WardrobeItemInsert, WardrobeItemRow } from "@/types/supabase";

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
}

export function mapWardrobeRow(row: WardrobeItemRow): WardrobeItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category as WardrobeItem["category"],
    subcategory: row.subcategory,
    fit: row.fit as WardrobeItem["fit"],
    sleeve: (row.sleeve ?? undefined) as WardrobeItem["sleeve"],
    colours: row.colours,
    pattern: row.pattern as WardrobeItem["pattern"],
    seasons: row.seasons as WardrobeItem["seasons"],
    occasions: row.occasions as WardrobeItem["occasions"],
    formality: row.formality as WardrobeItem["formality"],
    material: row.material,
    lastWornDaysAgo: row.last_worn_days_ago,
    wearCount: row.wear_count,
    favorite: row.favorite,
    imageUrl: row.image_url ?? undefined,
    imageStoragePath: row.image_storage_path ?? undefined,
    source: "supabase",
    aiStatus: row.ai_status as WardrobeItem["aiStatus"],
    aiConfidence: row.ai_confidence ?? undefined,
    aiSummary: row.ai_summary ?? undefined,
    aiTags: (row.ai_tags as unknown as WardrobeItem["aiTags"]) ?? undefined,
  };
}

function mapWardrobeInsert(
  item: WardrobeItem,
  imageUrl?: string,
  imageStoragePath?: string,
): WardrobeItemInsert {
  return {
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    fit: item.fit,
    sleeve: item.sleeve ?? null,
    colours: item.colours,
    pattern: item.pattern,
    seasons: item.seasons,
    occasions: item.occasions,
    formality: item.formality,
    material: item.material,
    last_worn_days_ago: item.lastWornDaysAgo,
    wear_count: item.wearCount,
    favorite: item.favorite,
    image_url: imageUrl ?? null,
    image_storage_path: imageStoragePath ?? null,
    ai_status: item.aiStatus ?? "idle",
    ai_confidence: item.aiConfidence ?? null,
    ai_summary: item.aiSummary ?? null,
    ai_tags: item.aiTags
      ? (item.aiTags as unknown as Record<string, unknown>)
      : null,
  };
}

export async function listWardrobeItemsFromSupabase(userId: string) {
  const client = supabase;

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as WardrobeItemRow[]).map(mapWardrobeRow);

  const hydratedRows = await Promise.all(
    rows.map(async (item) => {
      if (!item.imageStoragePath) {
        return item;
      }

      /** Signed URL valid for 7 days (604800 seconds) to avoid broken image links. */
      const signedUrlResult = await client.storage
        .from(wardrobeBucketName)
        .createSignedUrl(item.imageStoragePath, 604800);

      return {
        ...item,
        imageUrl: signedUrlResult.data?.signedUrl ?? item.imageUrl,
      };
    }),
  );

  return hydratedRows;
}

export async function uploadWardrobeItemToSupabase(
  item: WardrobeItem,
  asset: ImagePickerAsset,
  userId: string,
) {
  const client = supabase;

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  let imageUrl: string | undefined;
  let imageStoragePath: string | undefined;

  if (asset.uri) {
    const response = await fetch(asset.uri);
    const arrayBuffer = await response.arrayBuffer();
    const extension = asset.fileName?.split(".").pop() ?? "jpg";
    imageStoragePath = `wardrobe/${userId}/${Date.now()}-${sanitizeFilename(asset.fileName ?? `upload.${extension}`)}`;

    const { error: uploadError } = await client.storage
      .from(wardrobeBucketName)
      .upload(imageStoragePath, arrayBuffer, {
        contentType: asset.mimeType ?? "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    /** Signed URL valid for 7 days (604800 seconds) to avoid broken image links. */
    const signedUrlResult = await client.storage
      .from(wardrobeBucketName)
      .createSignedUrl(imageStoragePath, 604800);
    imageUrl = signedUrlResult.data?.signedUrl;
  }

  const payload = {
    ...mapWardrobeInsert(item, undefined, imageStoragePath),
    user_id: userId,
  };
  const { data, error } = await client
    .from("wardrobe_items")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    ...mapWardrobeRow(data as WardrobeItemRow),
    imageUrl,
  };
}

export async function updateWardrobeItemInSupabase(item: WardrobeItem) {
  const client = supabase;

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const payload = mapWardrobeInsert(item, undefined, item.imageStoragePath);
  const { data, error } = await client
    .from("wardrobe_items")
    .update(payload)
    .eq("id", item.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const mapped = mapWardrobeRow(data as WardrobeItemRow);

  if (!mapped.imageStoragePath) {
    return mapped;
  }

  /** Signed URL valid for 7 days (604800 seconds) to avoid broken image links. */
  const signedUrlResult = await client.storage
    .from(wardrobeBucketName)
    .createSignedUrl(mapped.imageStoragePath, 604800);

  return {
    ...mapped,
    imageUrl: signedUrlResult.data?.signedUrl ?? mapped.imageUrl,
  };
}
