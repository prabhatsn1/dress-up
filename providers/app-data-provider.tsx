import * as ImagePicker from "expo-image-picker";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  analyzeWardrobeItemWithAi,
  mergeAiAnalysisIntoWardrobeItem,
} from "@/lib/ai";
import { getSession } from "@/lib/auth";
import {
  getAllItems,
  initDb,
  markSynced,
  updateItem,
  upsertItem,
  deleteItem,
} from "@/lib/local-db";
import { loadProfile, saveProfile } from "@/lib/profile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  listWardrobeItemsFromSupabase,
  mapWardrobeRow,
  updateWardrobeItemInSupabase,
  uploadWardrobeItemToSupabase,
} from "@/lib/supabase-wardrobe";
import { getCurrentWeather } from "@/lib/weather";
import {
  buildRecommendations,
  todayWeather,
  userProfile,
  wardrobeItems,
  type Category,
  type UserProfile,
  type WardrobeItem,
  type WeatherSnapshot,
} from "@/lib/wardrobe";

import type { WardrobeItemRow } from "@/types/supabase";

type UploadSource = "camera" | "library";
type WardrobeSource = "seed" | "supabase" | "local";

interface AppDataContextValue {
  items: WardrobeItem[];
  weather: WeatherSnapshot;
  isWeatherLoading: boolean;
  weatherError: string | null;
  isWardrobeLoading: boolean;
  isUploading: boolean;
  analyzingItemId: string | null;
  wardrobeSource: WardrobeSource;
  supabaseConfigured: boolean;
  lastSyncMessage: string | null;
  notificationsEnabled: boolean;
  profile: UserProfile;
  setNotificationTime: (hour: number, minute: number) => Promise<void>;
  refreshWeather: () => Promise<void>;
  refreshWardrobe: () => Promise<void>;
  addItemFromCamera: () => Promise<void>;
  addItemFromLibrary: () => Promise<void>;
  analyzeItemWithAi: (itemId: string) => Promise<void>;
  markOutfitWorn: (itemIds: string[]) => Promise<void>;
  updateProfile: (p: UserProfile) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function inferCategoryFromName(filename: string): {
  category: Category;
  subcategory: string;
  occasions: WardrobeItem["occasions"];
  formality: WardrobeItem["formality"];
} {
  const normalized = filename.toLowerCase();

  if (normalized.includes("shoe") || normalized.includes("sneaker")) {
    return {
      category: "Shoes",
      subcategory: "Shoes",
      occasions: ["Casual", "Travel"],
      formality: "casual",
    };
  }

  if (normalized.includes("jacket") || normalized.includes("blazer")) {
    return {
      category: "Outerwear",
      subcategory: "Jacket",
      occasions: ["Office", "Travel"],
      formality: "smart",
    };
  }

  if (
    normalized.includes("pant") ||
    normalized.includes("jean") ||
    normalized.includes("trouser")
  ) {
    return {
      category: "Bottom",
      subcategory: "Trousers",
      occasions: ["Office", "Casual", "Travel"],
      formality: "smart",
    };
  }

  return {
    category: "Top",
    subcategory: normalized.includes("kurta") ? "Kurta" : "Shirt",
    occasions: ["Office", "Casual", "Travel"],
    formality: "smart",
  };
}

function createDraftWardrobeItem(
  asset: ImagePicker.ImagePickerAsset,
  source: UploadSource,
): WardrobeItem {
  const filename =
    asset.fileName ?? asset.uri.split("/").pop() ?? `upload-${Date.now()}.jpg`;
  const inferred = inferCategoryFromName(filename);
  const fallbackLabel = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  const title = fallbackLabel
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    id: `local-${Date.now()}`,
    name: title || "New wardrobe upload",
    category: inferred.category,
    subcategory: inferred.subcategory,
    fit: "regular",
    sleeve:
      inferred.category === "Top" || inferred.category === "Outerwear"
        ? "long"
        : undefined,
    colours: ["beige"],
    pattern: "solid",
    seasons: ["all-season"],
    occasions: inferred.occasions,
    formality: inferred.formality,
    material: inferred.category === "Outerwear" ? "cotton blend" : "cotton",
    lastWornDaysAgo: 99,
    wearCount: 0,
    favorite: false,
    imageUrl: asset.uri,
    source,
    aiStatus: "idle",
  };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [weather, setWeather] = useState<WeatherSnapshot>(todayWeather);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isWardrobeLoading, setIsWardrobeLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null);
  const [wardrobeSource, setWardrobeSource] = useState<WardrobeSource>("seed");
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(userProfile);
  const refreshWeather = async () => {
    setIsWeatherLoading(true);
    setWeatherError(null);

    try {
      const liveWeather = await getCurrentWeather();
      setWeather(liveWeather);
    } catch (error) {
      setWeather({
        ...todayWeather,
        source: "Sample",
        lastUpdated: "Fallback sample weather",
      });
      setWeatherError(
        error instanceof Error
          ? error.message
          : "Unable to fetch live weather.",
      );
    } finally {
      setIsWeatherLoading(false);
    }
  };

  const refreshWardrobe = async () => {
    setIsWardrobeLoading(true);

    try {
      await initDb();

      // Seed on first run
      let localItems = await getAllItems();
      if (localItems.length === 0) {
        for (const item of wardrobeItems) {
          await upsertItem(item);
        }
        localItems = await getAllItems();
        setItems(localItems);
        setWardrobeSource("seed");
        setLastSyncMessage("First run — loaded sample wardrobe.");
      } else {
        setItems(localItems);
        setWardrobeSource("local");
      }

      if (!isSupabaseConfigured) {
        setLastSyncMessage("Supabase keys not set, using local wardrobe.");
        return;
      }

      const session = await getSession();
      const userId = session?.user.id;

      if (!userId) {
        setLastSyncMessage("Not signed in — using local wardrobe.");
        return;
      }

      const remoteItems = await listWardrobeItemsFromSupabase(userId);
      for (const remoteItem of remoteItems) {
        await upsertItem(remoteItem);
        await markSynced(remoteItem.id);
      }

      const syncedItems = await getAllItems();
      setItems(syncedItems);
      setWardrobeSource(remoteItems.length > 0 ? "supabase" : "local");
      setLastSyncMessage(
        remoteItems.length > 0
          ? "Wardrobe synced from Supabase."
          : "Supabase is connected, but no saved wardrobe items were found yet.",
      );
    } catch (error) {
      // On any failure, attempt to surface whatever is already in SQLite
      try {
        const fallbackItems = await getAllItems();
        if (fallbackItems.length > 0) {
          setItems(fallbackItems);
          setWardrobeSource("local");
        }
      } catch {
        // SQLite also unavailable — leave state as-is
      }
      setLastSyncMessage(
        error instanceof Error
          ? `Sync failed, using local wardrobe. ${error.message}`
          : "Sync failed, using local wardrobe.",
      );
    } finally {
      setIsWardrobeLoading(false);
    }
  };

  async function pickAndAddItem(source: UploadSource) {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setLastSyncMessage(
        source === "camera"
          ? "Camera permission denied. Please allow camera access to upload items."
          : "Photo library permission denied. Please allow photo access to upload items.",
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            selectionLimit: 1,
          });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const draft = createDraftWardrobeItem(asset, source);

    // Persist immediately so the item survives a restart even if upload fails
    await upsertItem(draft);
    setItems((current) => [draft, ...current]);
    setWardrobeSource("local");

    setIsUploading(true);

    try {
      if (!isSupabaseConfigured) {
        setLastSyncMessage(
          "Saved locally. Add Supabase env keys to enable cloud sync.",
        );
        return;
      }

      const session = await getSession();
      const userId = session?.user.id;

      if (!userId) {
        throw new Error("You must be signed in to upload wardrobe items.");
      }

      const savedItem = await uploadWardrobeItemToSupabase(
        draft,
        asset,
        userId,
      );
      await upsertItem(savedItem);
      await markSynced(savedItem.id);
      setItems((current) =>
        current.map((entry) => (entry.id === savedItem.id ? savedItem : entry)),
      );
      setWardrobeSource("supabase");
      setLastSyncMessage(
        source === "camera"
          ? "Camera upload saved to Supabase."
          : "Gallery upload saved to Supabase.",
      );
    } catch (error) {
      setWardrobeSource("local");
      setLastSyncMessage(
        error instanceof Error
          ? `Upload saved locally. ${error.message}`
          : "Upload saved locally. Cloud sync unavailable.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function analyzeItemWithAi(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);

    if (!item) {
      setLastSyncMessage("Unable to find the selected item for AI analysis.");
      return;
    }

    if (!isSupabaseConfigured) {
      setLastSyncMessage(
        "Supabase must be configured before OpenAI and Hugging Face analysis can run.",
      );
      return;
    }

    if (!item.imageUrl) {
      setLastSyncMessage(
        "This item needs an image before AI analysis can run.",
      );
      return;
    }

    setAnalyzingItemId(itemId);
    setItems((current) =>
      current.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              aiStatus: "pending",
            }
          : entry,
      ),
    );

    try {
      const analysis = await analyzeWardrobeItemWithAi(item);
      const enrichedItem = mergeAiAnalysisIntoWardrobeItem(item, analysis);
      let persistedItem = enrichedItem;

      if (item.source === "supabase") {
        try {
          persistedItem = await updateWardrobeItemInSupabase(enrichedItem);
        } catch {
          persistedItem = enrichedItem;
        }
      }

      await updateItem(itemId, {
        aiStatus: persistedItem.aiStatus,
        aiConfidence: persistedItem.aiConfidence,
        aiSummary: persistedItem.aiSummary,
        aiTags: persistedItem.aiTags,
      });
      setItems((current) =>
        current.map((entry) => (entry.id === itemId ? persistedItem : entry)),
      );
      setLastSyncMessage("AI tags generated with Hugging Face and OpenAI.");
    } catch (error) {
      await updateItem(itemId, { aiStatus: "failed" }).catch(() => undefined);
      setItems((current) =>
        current.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                aiStatus: "failed",
              }
            : entry,
        ),
      );
      setLastSyncMessage(
        error instanceof Error
          ? `AI analysis failed. ${error.message}`
          : "AI analysis failed.",
      );
    } finally {
      setAnalyzingItemId(null);
    }
  }

  async function setNotificationTime(
    hour: number,
    minute: number,
  ): Promise<void> {
    const currentItems = items;
    const currentWeather = weather;
    if (currentItems.length > 0) {
      const rec = buildRecommendations(currentItems, profile, {
        occasion: "Office",
        weather: currentWeather,
      })[0];
      const { title, body } = buildBriefingContent(
        rec?.name ?? "Your outfit",
        currentWeather,
      );
      await scheduleMorningBriefing(hour, minute, title, body);
    }
    setNotificationsEnabled(true);
  }

  async function updateProfile(p: UserProfile): Promise<void> {
    setProfile(p);
    await saveProfile(p);
  }

  useEffect(() => {
    async function initAndSchedule() {
      await refreshWeather();
      await initDb();
      await refreshWardrobe();
      const saved = await loadProfile();
      if (saved) setProfile(saved);
    }
    void initAndSchedule();
  }, []);

  // Re-schedule the briefing whenever items or weather settle (if a time has been saved)
  useEffect(() => {
    if (!notificationsEnabled || items.length === 0) return;
    void (async () => {
      const time = await getMorningBriefingTime();
      if (!time) return;
      const rec = buildRecommendations(items, profile, {
        occasion: "Office",
        weather,
      })[0];
      const { title, body } = buildBriefingContent(
        rec?.name ?? "Your outfit",
        weather,
      );
      await scheduleMorningBriefing(time.hour, time.minute, title, body);
    })();
  }, [notificationsEnabled, items, weather]);

  // ── Supabase Realtime subscription ──────────────────────────────────────────
  // Replaces manual refresh polling: INSERT / UPDATE / DELETE events from any
  // device are applied to local SQLite and React state instantly.
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;

    let channel: ReturnType<typeof client.channel> | null = null;

    async function subscribe() {
      const session = await getSession();
      const userId = session?.user.id;
      if (!userId) return;

      channel = client
        .channel("wardrobe-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wardrobe_items",
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              const row = payload.new as WardrobeItemRow;
              const item = mapWardrobeRow(row);
              await upsertItem(item);
              await markSynced(item.id);
              setItems((prev) => {
                const idx = prev.findIndex((i) => i.id === item.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = item;
                  return next;
                }
                return [item, ...prev];
              });
              setWardrobeSource("supabase");
            } else if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              if (id) {
                await deleteItem(id);
                setItems((prev) => prev.filter((i) => i.id !== id));
              }
            }
          },
        )
        .subscribe();
    }

    void subscribe();

    return () => {
      if (channel) {
        client.removeChannel(channel);
      }
    };
  }, []);

  async function markOutfitWorn(itemIds: string[]): Promise<void> {
    for (const itemId of itemIds) {
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;
      const newWearCount = (item.wearCount ?? 0) + 1;
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, wearCount: newWearCount, lastWornDaysAgo: 0 }
            : i,
        ),
      );
      await updateItem(itemId, { wearCount: newWearCount, lastWornDaysAgo: 0 });
      if (isSupabaseConfigured) {
        try {
          await updateWardrobeItemInSupabase({
            ...item,
            wearCount: newWearCount,
            lastWornDaysAgo: 0,
          });
        } catch {
          // Supabase update failure is non-fatal; local state already updated
        }
      }
    }
  }

  const value: AppDataContextValue = {
    items,
    weather,
    isWeatherLoading,
    weatherError,
    isWardrobeLoading,
    isUploading,
    analyzingItemId,
    wardrobeSource,
    supabaseConfigured: isSupabaseConfigured,
    lastSyncMessage,
    notificationsEnabled,
    profile,
    setNotificationTime,
    refreshWeather,
    refreshWardrobe,
    addItemFromCamera: async () => pickAndAddItem("camera"),
    addItemFromLibrary: async () => pickAndAddItem("library"),
    analyzeItemWithAi,
    markOutfitWorn,
    updateProfile,
  };

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used inside AppDataProvider.");
  }

  return context;
}
