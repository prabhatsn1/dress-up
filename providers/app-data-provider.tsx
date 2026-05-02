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
import {
  detectRepeatOutfit,
  dominantFormality,
  rateOutfitLog,
  saveOutfitLog,
  getRecentLogs,
  type RepeatWarning,
} from "@/lib/outfit-log";
import type {
  OutfitItemSnapshot,
  OutfitLog,
  GamificationState,
  WeeklyChallengeRow,
} from "@/lib/local-db";
import {
  getEarnedBadges,
  getOrCreateWeeklyChallenges,
  onOutfitLogged,
  onOutfitRated,
  getGamificationState,
  type GamificationUpdate,
} from "@/lib/gamification";
import {
  buildBriefingContent,
  cancelLaundryReminder,
  getMorningBriefingTime,
  scheduleLaundryReminder,
  scheduleMorningBriefing,
} from "@/lib/notifications";
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
  logOutfit: (
    itemIds: string[],
    occasion?: string,
    temperatureC?: number,
  ) => Promise<RepeatWarning | null>;
  repeatWarning: RepeatWarning | null;
  dismissRepeatWarning: () => void;
  /** Non-null immediately after logOutfit() — triggers the RatingSheet */
  pendingRatingLog: OutfitLog | null;
  submitRating: (rating: number, note?: string) => Promise<void>;
  dismissRating: () => void;
  /** Items currently marked as dirty (in the laundry pile). */
  dirtyItems: WardrobeItem[];
  markItemClean: (itemId: string) => Promise<void>;
  markAllClean: () => Promise<void>;
  updateProfile: (p: UserProfile) => Promise<void>;
  /** Gamification */
  gamification: GamificationState;
  earnedBadgeIds: Set<string>;
  weeklyChallenges: WeeklyChallengeRow[];
  /** Non-null for one render cycle after an outfit is logged or rated. */
  lastGamificationUpdate: GamificationUpdate | null;
  dismissGamificationUpdate: () => void;
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
  const [repeatWarning, setRepeatWarning] = useState<RepeatWarning | null>(
    null,
  );
  const [pendingRatingLog, setPendingRatingLog] = useState<OutfitLog | null>(
    null,
  );
  const [gamification, setGamification] = useState<GamificationState>({
    xp: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    lastLogDate: null,
  });
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set());
  const [weeklyChallenges, setWeeklyChallenges] = useState<
    WeeklyChallengeRow[]
  >([]);
  const [lastGamificationUpdate, setLastGamificationUpdate] =
    useState<GamificationUpdate | null>(null);
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

  // Load gamification state once DB is initialised
  useEffect(() => {
    void (async () => {
      const state = await getGamificationState();
      setGamification(state);
      const badges = await getEarnedBadges();
      setEarnedBadgeIds(new Set(badges.map((b) => b.id)));
      const challenges = await getOrCreateWeeklyChallenges();
      setWeeklyChallenges(challenges);
    })();
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
  }, [notificationsEnabled, items, weather, profile]);

  // ── Supabase Realtime subscription ──────────────────────────────────────────
  // Replaces manual refresh polling: INSERT / UPDATE / DELETE events from any
  // device are applied to local SQLite and React state instantly.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const session = await getSession();
      const userId = session?.user.id;
      if (!userId) return;

      channel = supabase!
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
        supabase!.removeChannel(channel);
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
            ? {
                ...i,
                wearCount: newWearCount,
                lastWornDaysAgo: 0,
                isDirty: true,
              }
            : i,
        ),
      );
      await updateItem(itemId, {
        wearCount: newWearCount,
        lastWornDaysAgo: 0,
        isDirty: true,
      });
      if (isSupabaseConfigured) {
        try {
          await updateWardrobeItemInSupabase({
            ...item,
            wearCount: newWearCount,
            lastWornDaysAgo: 0,
            isDirty: true,
          });
        } catch {
          // Supabase update failure is non-fatal; local state already updated
        }
      }
    }
  }

  /**
   * Log an outfit as worn.  Runs repeat-detection first, persists the log,
   * and also bumps wear_count / last_worn_days_ago on each item (same as the
   * legacy markOutfitWorn path).  Returns the RepeatWarning if one was
   * detected, or null.
   */
  async function logOutfit(
    itemIds: string[],
    occasion?: string,
    temperatureC?: number,
  ): Promise<RepeatWarning | null> {
    const session = await getSession();
    const userId = session?.user.id;
    if (!userId) return null;

    // 1. Repeat-detection — run before persisting so the user can cancel
    const warning = await detectRepeatOutfit(userId, itemIds);
    if (warning) {
      setRepeatWarning(warning);
    }

    // 2. Build full outfit context to persist
    const wornItems = itemIds
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => i !== undefined);

    const itemSnapshot: OutfitItemSnapshot[] = wornItems.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      colours: i.colours,
      formality: i.formality,
      imageUrl: i.imageUrl,
    }));

    const colorPalette = [...new Set(wornItems.flatMap((i) => i.colours))];
    const formality = dominantFormality(wornItems.map((i) => i.formality));

    // 3. Persist outfit log with full context
    const log = await saveOutfitLog({
      userId,
      itemIds,
      occasion,
      temperatureC: temperatureC ?? weather.temperatureC,
      weatherCondition: weather.condition,
      locationName: weather.location,
      itemSnapshot,
      colorPalette,
      formality,
    });

    // 4. Queue the rating sheet
    setPendingRatingLog(log);

    // 5. Update per-item stats (reuse existing path)
    await markOutfitWorn(itemIds);

    // 6. Schedule evening laundry reminder if items are now dirty
    const newDirtyCount = items.filter(
      (i) => itemIds.includes(i.id) || i.isDirty,
    ).length;
    if (newDirtyCount >= 1) {
      await scheduleLaundryReminder(newDirtyCount).catch(() => undefined);
    }

    // 7. Gamification: update streak, XP, badges, challenges
    try {
      const recentLogs = await getRecentLogs(userId, 200);
      const gamUpdate = await onOutfitLogged(log, recentLogs);
      setGamification(gamUpdate.state);
      if (gamUpdate.newBadges.length > 0) {
        const ids = new Set([
          ...earnedBadgeIds,
          ...gamUpdate.newBadges.map((b) => b.id),
        ]);
        setEarnedBadgeIds(ids);
      }
      const updatedChallenges = await getOrCreateWeeklyChallenges();
      setWeeklyChallenges(updatedChallenges);
      setLastGamificationUpdate(gamUpdate);
    } catch {
      // Gamification failure is non-fatal
    }

    return warning;
  }

  function dismissRepeatWarning() {
    setRepeatWarning(null);
  }

  async function submitRating(rating: number, note?: string): Promise<void> {
    if (!pendingRatingLog) return;
    const logSnapshot = { ...pendingRatingLog, rating, ratingNote: note };
    await rateOutfitLog(pendingRatingLog.id, rating, note);
    setPendingRatingLog(null);
    // Gamification: award rating XP and check rating badges
    try {
      const session = await getSession();
      const userId = session?.user.id;
      if (userId) {
        const recentLogs = await getRecentLogs(userId, 200);
        const gamUpdate = await onOutfitRated(logSnapshot, recentLogs);
        setGamification(gamUpdate.state);
        if (gamUpdate.newBadges.length > 0) {
          const ids = new Set([
            ...earnedBadgeIds,
            ...gamUpdate.newBadges.map((b) => b.id),
          ]);
          setEarnedBadgeIds(ids);
        }
        const updatedChallenges = await getOrCreateWeeklyChallenges();
        setWeeklyChallenges(updatedChallenges);
        if (gamUpdate.xpGained > 0) setLastGamificationUpdate(gamUpdate);
      }
    } catch {
      // non-fatal
    }
  }

  function dismissRating() {
    setPendingRatingLog(null);
  }

  function dismissGamificationUpdate() {
    setLastGamificationUpdate(null);
  }

  async function markItemClean(itemId: string): Promise<void> {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isDirty: false } : i)),
    );
    await updateItem(itemId, { isDirty: false });
    if (isSupabaseConfigured) {
      const item = items.find((i) => i.id === itemId);
      if (item) {
        try {
          await updateWardrobeItemInSupabase({ ...item, isDirty: false });
        } catch {
          // non-fatal
        }
      }
    }
    // Cancel reminder if nothing is dirty after this update
    const remaining = items.filter((i) => i.id !== itemId && i.isDirty);
    if (remaining.length === 0) {
      await cancelLaundryReminder();
    } else {
      await scheduleLaundryReminder(remaining.length);
    }
  }

  async function markAllClean(): Promise<void> {
    const dirtyIds = items.filter((i) => i.isDirty).map((i) => i.id);
    setItems((prev) => prev.map((i) => ({ ...i, isDirty: false })));
    await Promise.all(dirtyIds.map((id) => updateItem(id, { isDirty: false })));
    if (isSupabaseConfigured) {
      await Promise.all(
        dirtyIds.map((id) => {
          const item = items.find((i) => i.id === id);
          return item
            ? updateWardrobeItemInSupabase({ ...item, isDirty: false }).catch(
                () => undefined,
              )
            : Promise.resolve();
        }),
      );
    }
    await cancelLaundryReminder();
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
    logOutfit,
    repeatWarning,
    dismissRepeatWarning,
    pendingRatingLog,
    submitRating,
    dismissRating,
    dirtyItems: items.filter((i) => i.isDirty === true),
    markItemClean,
    markAllClean,
    updateProfile,
    gamification,
    earnedBadgeIds,
    weeklyChallenges,
    lastGamificationUpdate,
    dismissGamificationUpdate,
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
