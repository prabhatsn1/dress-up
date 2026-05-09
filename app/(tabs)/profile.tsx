import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useThemeColor } from "@/hooks/use-theme-color";
import { getSession } from "@/lib/auth";
import {
  getColourAnalysis,
  computeItemPaletteTag,
  SEASON_SWATCHES,
  SEASON_META,
  type ColourAnalysis,
} from "@/lib/colour-analysis";
import { xpForNextLevel, BADGES } from "@/lib/gamification";
import {
  cancelMorningBriefing,
  getMorningBriefingTime,
  requestNotificationPermission,
  saveMorningBriefingTime,
  scheduleMorningBriefing,
  buildBriefingContent,
} from "@/lib/notifications";
import { getTopRatedOutfits, type OutfitLog } from "@/lib/outfit-log";
import { useAppData } from "@/providers/app-data-provider";
import { WearStats } from "@/components/wear-stats";
import { WeeklyChallenges } from "@/components/weekly-challenges";

export { RouteErrorBoundary as ErrorBoundary } from "@/components/error-boundary";

const LEVEL_TITLES = [
  "Style Newbie",
  "Casual Explorer",
  "Fashion Rookie",
  "Style Curator",
  "Wardrobe Expert",
  "Fashion Maven",
  "Style Icon",
  "Trend Setter",
  "Fashion Oracle",
  "Wardrobe Legend",
];

function getLevelTitle(level: number): string {
  return (
    LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ??
    "Wardrobe Legend"
  );
}

export default function ProfileScreen() {
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [briefingHour, setBriefingHour] = useState(8);
  const [briefingMinute, setBriefingMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingHour, setPendingHour] = useState(8);
  const [pendingMinute, setPendingMinute] = useState(0);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [localOnly, setLocalOnly] = useState(true);
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [topRatedLogs, setTopRatedLogs] = useState<OutfitLog[]>([]);

  const background = useThemeColor({}, "background");
  const surface = useThemeColor({}, "surface");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const cool = useThemeColor({}, "accentCool");
  const danger = useThemeColor({}, "danger");
  const success = useThemeColor({}, "success");
  const {
    supabaseConfigured,
    weather,
    wardrobeSource,
    lastSyncMessage,
    items,
    profile,
    gamification,
    earnedBadgeIds,
    weeklyChallenges,
  } = useAppData();

  const xpProgressRef = useRef(new Animated.Value(0)).current;
  const { threshold, nextThreshold, level } = xpForNextLevel(gamification.xp);
  const xpInLevel = gamification.xp - threshold;
  const xpToNext = nextThreshold - threshold;
  const xpFraction = xpToNext > 0 ? xpInLevel / xpToNext : 0;

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const colourAnalysis: ColourAnalysis | null = getColourAnalysis(
    profile.skinTone,
  );
  const seasonSwatches = colourAnalysis
    ? SEASON_SWATCHES[colourAnalysis.palette]
    : [];
  const seasonMeta = colourAnalysis
    ? SEASON_META[colourAnalysis.palette]
    : null;
  const paletteMatchCount = colourAnalysis
    ? items.filter((i) => {
        const tag = computeItemPaletteTag(i, colourAnalysis);
        return tag === "best" || tag === "good";
      }).length
    : 0;

  useEffect(() => {
    getSession().then((session) => {
      const userId = session?.user.id;
      if (!userId) return;
      getTopRatedOutfits(userId, 4, 10)
        .then(setTopRatedLogs)
        .catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    Animated.timing(xpProgressRef, {
      toValue: xpFraction,
      duration: 900,
      useNativeDriver: false,
    }).start();
    // xpProgressRef is a stable Animated.Value ref, safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xpFraction]);

  async function handleNotificationsToggle(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "To receive morning outfit briefings, please enable notifications for this app in your device Settings.",
          [{ text: "OK" }],
        );
        return;
      }
      const saved = await getMorningBriefingTime();
      const h = saved?.hour ?? 8;
      const m = saved?.minute ?? 0;
      setPendingHour(h);
      setPendingMinute(m);
      setShowTimePicker(true);
    } else {
      await cancelMorningBriefing();
      setNotificationsOn(false);
    }
  }

  async function confirmTimePicker() {
    await saveMorningBriefingTime(pendingHour, pendingMinute);
    const { title, body } = buildBriefingContent("Your outfit", weather);
    await scheduleMorningBriefing(pendingHour, pendingMinute, title, body);
    setBriefingHour(pendingHour);
    setBriefingMinute(pendingMinute);
    setNotificationsOn(true);
    setShowTimePicker(false);
  }

  function dismissTimePicker() {
    setShowTimePicker(false);
  }

  const briefingTimeLabel = `${String(briefingHour).padStart(2, "0")}:${String(briefingMinute).padStart(2, "0")}`;
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const currentLevelTitle = getLevelTitle(level);
  const nextLevelTitle = getLevelTitle(level + 1);

  const visibleBadges = showAllBadges ? BADGES : BADGES.slice(0, 8);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: background }]}
      contentContainerStyle={styles.content}
    >
      {/* ─── Cover + Avatar ───────────────────────────────────── */}
      <View style={styles.coverGradient}>
        <View style={styles.avatarAnchor}>
          <View style={[styles.avatarBox, { borderColor: background }]}>
            <Text style={styles.avatarEmoji}>👤</Text>
            <View style={[styles.levelBadge, { borderColor: background }]}>
              <Text style={styles.levelBadgeText}>{level}</Text>
            </View>
          </View>
        </View>
      </View>
      {/* ─── Name Row ────────────────────────────────────────── */}
      <View style={styles.nameSection}>
        <View style={styles.nameRow}>
          <View style={styles.nameCopy}>
            <Text style={[styles.nameText, { color: text }]}>
              {profile.name}
            </Text>
            <Text style={[styles.nameMeta, { color: muted }]}>
              Level {level} ·{" "}
              {profile.stylePreferences
                .slice(0, 2)
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join(", ")}
            </Text>
          </View>
          <View style={[styles.streakPill, { backgroundColor: "#FAF4E8" }]}>
            <Text style={styles.streakPillFire}>🔥</Text>
            <Text style={[styles.streakPillText, { color: "#D4A853" }]}>
              {gamification.currentStreak} days
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.editButton, { borderColor: warm }]}
          onPress={() =>
            router.push({ pathname: "/onboarding", params: { mode: "edit" } })
          }
          activeOpacity={0.7}
        >
          <Text style={[styles.editButtonText, { color: warm }]}>
            Edit profile
          </Text>
        </TouchableOpacity>
      </View>
      {/* ─── Stats Bar ───────────────────────────────────────── */}
      <View
        style={[
          styles.statsBar,
          { borderColor: border, backgroundColor: surface },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: text }]}>
            {items.length}
          </Text>
          <Text style={[styles.statLabel, { color: muted }]}>Items</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: text }]}>
            {gamification.xp}
          </Text>
          <Text style={[styles.statLabel, { color: muted }]}>XP</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: text }]}>
            {gamification.currentStreak}d
          </Text>
          <Text style={[styles.statLabel, { color: muted }]}>Streak</Text>
        </View>
      </View>
      {/* ─── XP Card ─────────────────────────────────────────── */}
      <View style={styles.xpCard}>
        <View style={styles.xpCardHeader}>
          <View>
            <View style={styles.xpLevelRow}>
              <MaterialIcons name="bolt" size={16} color="#D4A853" />
              <Text style={styles.xpLevelText}>
                Level {level} · {currentLevelTitle}
              </Text>
            </View>
            <Text style={styles.xpNextText}>
              Next: Level {level + 1} · {nextLevelTitle}
            </Text>
          </View>
          <View style={styles.xpRight}>
            <Text style={styles.xpTotalValue}>
              {gamification.xp.toLocaleString()}
            </Text>
            <Text style={styles.xpTotalLabel}>total XP</Text>
          </View>
        </View>

        <View style={styles.xpBarTrack}>
          <Animated.View
            style={[
              styles.xpBarFill,
              {
                width: xpProgressRef.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
        <View style={styles.xpBarLabels}>
          <Text style={styles.xpBarLeft}>{xpInLevel} XP</Text>
          <Text style={styles.xpBarRight}>
            {xpToNext - xpInLevel} XP to next level
          </Text>
        </View>

        <View style={styles.xpStreakRow}>
          <Text style={styles.xpStreakFire}>🔥</Text>
          <Text style={styles.xpStreakLabel}>
            {gamification.currentStreak}-day outfit streak
          </Text>
          <Text style={styles.xpStreakBonus}>+25 XP/day</Text>
        </View>
      </View>
      {/* ─── Style Preferences ───────────────────────────────── */}
      <View
        style={[styles.card, { backgroundColor: surface, borderColor: border }]}
      >
        <Text style={[styles.sectionTitle, { color: text }]}>
          Style Preferences
        </Text>
        <View style={styles.chipRow}>
          {profile.stylePreferences.map((style) => (
            <View
              key={style}
              style={[
                styles.chip,
                { backgroundColor: warm + "22", borderColor: warm + "55" },
              ]}
            >
              <Text style={[styles.chipText, { color: warm }]}>
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.subBlock}>
          <Text style={[styles.subBlockTitle, { color: text }]}>
            Occasion profile
          </Text>
          <Text style={[styles.subBlockMeta, { color: muted }]}>
            {profile.occasionPreference.replace("-", " ")} wardrobe weighting
          </Text>
        </View>
      </View>
      {/* ─── Recommendation Inputs ───────────────────────────── */}
      <View
        style={[
          styles.card,
          { backgroundColor: surface, borderColor: cool + "55" },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: text }]}>
          How Recommendations Work
        </Text>
        <View style={styles.bulletList}>
          {[
            "Profile data tunes formality and styling bias.",
            "Weather changes fabric, layering, and shoe safety choices.",
            "Feedback shifts future ranking without deleting rules.",
          ].map((line) => (
            <View key={line} style={styles.bulletRow}>
              <MaterialIcons
                name="radio-button-on"
                size={10}
                color={cool}
                style={styles.bulletDot}
              />
              <Text style={[styles.bulletText, { color: muted }]}>{line}</Text>
            </View>
          ))}
        </View>
      </View>
      {/* ─── Badges ──────────────────────────────────────────── */}
      <View
        style={[styles.card, { backgroundColor: surface, borderColor: border }]}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: text }]}>Badges</Text>
          <TouchableOpacity onPress={() => setShowAllBadges(!showAllBadges)}>
            <Text style={[styles.sectionLink, { color: muted }]}>
              {showAllBadges ? "Show less" : `See all ${BADGES.length}`}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.badgeGrid}>
          {visibleBadges.map((badge) => {
            const earned = earnedBadgeIds.has(badge.id);
            return (
              <View key={badge.id} style={styles.badgeGridItem}>
                <View
                  style={[
                    styles.badgeIcon,
                    {
                      backgroundColor: earned ? surface : "#F0EDE8",
                      borderColor: earned ? warm + "60" : "transparent",
                      borderWidth: earned ? 2 : 0,
                      opacity: earned ? 1 : 0.45,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={
                      badge.icon as React.ComponentProps<
                        typeof MaterialIcons
                      >["name"]
                    }
                    size={24}
                    color={earned ? warm : muted}
                  />
                </View>
                <Text
                  style={[styles.badgeName, { color: earned ? text : muted }]}
                  numberOfLines={2}
                >
                  {badge.name}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      {/* ─── Active Challenges ────────────────────────────────── */}
      {weeklyChallenges.length > 0 && (
        <View
          style={[
            styles.card,
            { backgroundColor: surface, borderColor: border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              Active Challenges
            </Text>
            <View
              style={[styles.challengeBadge, { backgroundColor: "#FAF4E8" }]}
            >
              <Text style={[styles.challengeBadgeText, { color: "#D4A853" }]}>
                {weeklyChallenges.length} active
              </Text>
            </View>
          </View>
          <WeeklyChallenges challenges={weeklyChallenges} />
        </View>
      )}
      {/* ─── Wardrobe Intelligence ────────────────────────────── */}
      <View
        style={[styles.card, { backgroundColor: surface, borderColor: border }]}
      >
        <Text style={[styles.sectionTitle, { color: text }]}>
          Wardrobe Intelligence
        </Text>
        <WearStats items={items} />
      </View>
      {/* ─── Live Integrations ───────────────────────────────── */}
      <View
        style={[styles.card, { backgroundColor: surface, borderColor: border }]}
      >
        <Text style={[styles.sectionTitle, { color: text }]}>
          Live Integrations
        </Text>
        <View style={styles.integrationList}>
          {[
            {
              label: "Supabase",
              detail: supabaseConfigured ? wardrobeSource : "not configured",
              active: supabaseConfigured,
              color: success,
            },
            {
              label: "AI tagging",
              detail: supabaseConfigured
                ? "OpenAI + Hugging Face"
                : "unavailable — needs Supabase",
              active: supabaseConfigured,
              color: success,
            },
            {
              label: "Weather",
              detail: `${weather.source ?? "sample"} · ${weather.location} · ${weather.temperatureC}°C`,
              active: weather.source !== "Sample" && weather.source != null,
              color: cool,
            },
          ].map((item) => (
            <View key={item.label} style={styles.integrationRow}>
              <View
                style={[
                  styles.integrationDot,
                  { backgroundColor: item.active ? item.color : "#9ca3af" },
                ]}
              />
              <View style={styles.integrationCopy}>
                <Text style={[styles.integrationLabel, { color: text }]}>
                  {item.label}
                </Text>
                <Text style={[styles.integrationDetail, { color: muted }]}>
                  {item.detail}
                </Text>
              </View>
              <Text
                style={[
                  styles.integrationStatus,
                  { color: item.active ? item.color : muted },
                ]}
              >
                {item.active ? "Connected" : "Offline"}
              </Text>
            </View>
          ))}
        </View>
        {lastSyncMessage ? (
          <Text style={[styles.bulletText, { color: muted, marginTop: 6 }]}>
            {lastSyncMessage}
          </Text>
        ) : null}
      </View>
      {/* ─── Colour Analysis ─────────────────────────────────── */}
      {colourAnalysis && seasonMeta ? (
        <View
          style={[
            styles.card,
            { backgroundColor: surface, borderColor: warm + "55" },
          ]}
        >
          <View style={styles.paletteHeader}>
            <Text style={styles.paletteEmoji}>{seasonMeta.emoji}</Text>
            <View style={styles.paletteHeaderText}>
              <Text style={[styles.sectionTitle, { color: text }]}>
                Your colour palette: {colourAnalysis.palette}
              </Text>
              <Text style={[styles.subBlockMeta, { color: muted }]}>
                {seasonMeta.adjective}
              </Text>
            </View>
          </View>
          <View style={styles.swatchRow}>
            {seasonSwatches.map((hex) => (
              <View
                key={hex}
                style={[styles.swatch, { backgroundColor: hex }]}
              />
            ))}
          </View>
          <Text style={[styles.bulletText, { color: muted }]}>
            {colourAnalysis.description}
          </Text>
          <Text style={[styles.paletteCount, { color: warm }]}>
            {paletteMatchCount} of {items.length} wardrobe items match your
            palette
          </Text>
        </View>
      ) : null}
      {/* ─── Top Rated Outfits ───────────────────────────────── */}
      {topRatedLogs.length > 0 && (
        <View
          style={[
            styles.card,
            { backgroundColor: surface, borderColor: success + "55" },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: text }]}>
            Top Rated Outfits
          </Text>
          <Text style={[styles.bulletText, { color: muted }]}>
            Outfits you rated 4★ or higher. These combinations get a score boost
            in future AI recommendations.
          </Text>
          <View style={styles.ratedList}>
            {topRatedLogs.map((log) => {
              const names = log.itemIds
                .map((id) => itemMap.get(id)?.name)
                .filter(Boolean)
                .join(" · ");
              return (
                <View
                  key={log.id}
                  style={[styles.ratedRow, { borderColor: border }]}
                >
                  <View style={styles.ratedStars}>
                    {Array.from({ length: log.rating ?? 0 }).map((_, i) => (
                      <Text key={i} style={styles.starGlyph}>
                        ★
                      </Text>
                    ))}
                  </View>
                  <View style={styles.ratedCopy}>
                    <Text
                      style={[styles.ratedItems, { color: text }]}
                      numberOfLines={1}
                    >
                      {names || "Deleted items"}
                    </Text>
                    <Text style={[styles.ratedMeta, { color: muted }]}>
                      {log.occasion ? `${log.occasion} · ` : ""}
                      {log.wornDate}
                      {log.ratingNote ? ` · "${log.ratingNote}"` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
      {/* ─── Settings ────────────────────────────────────────── */}
      <View>
        <Text style={[styles.sectionTitle, { color: text, marginBottom: 12 }]}>
          Settings
        </Text>

        {/* Preferences group */}
        <Text style={[styles.groupLabel, { color: muted }]}>PREFERENCES</Text>
        <View
          style={[
            styles.settingsGroup,
            { backgroundColor: surface, borderColor: border },
          ]}
        >
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomColor: border }]}
            activeOpacity={0.6}
          >
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#EEF2FA" }]}
            >
              <MaterialIcons name="notifications" size={18} color="#4A6FA5" />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: text }]}>
                Notifications
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                {notificationsOn
                  ? `Daily briefing at ${briefingTimeLabel}`
                  : "Daily outfit reminders"}
              </Text>
            </View>
            <Switch
              value={notificationsOn}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: "#D0CBE0", true: "#7B9E87" }}
              thumbColor="#fff"
            />
          </TouchableOpacity>

          <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#F3EEF9" }]}
            >
              <MaterialIcons name="dark-mode" size={18} color="#7B5EA7" />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: text }]}>
                Dark Mode
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                Easier on the eyes
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={muted} />
          </View>
        </View>

        {/* Data & Privacy group */}
        <Text style={[styles.groupLabel, { color: muted, marginTop: 16 }]}>
          DATA & PRIVACY
        </Text>
        <View
          style={[
            styles.settingsGroup,
            { backgroundColor: surface, borderColor: border },
          ]}
        >
          <View style={[styles.settingsRow, { borderBottomColor: border }]}>
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#F0EDE8" }]}
            >
              <MaterialIcons name="smartphone" size={18} color={text} />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: text }]}>
                Local-only image processing
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                Keep wardrobe photos on-device whenever supported.
              </Text>
            </View>
            <Switch
              value={localOnly}
              onValueChange={setLocalOnly}
              trackColor={{ false: "#D0CBE0", true: "#7B9E87" }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingsRow, { borderBottomColor: border }]}>
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#EBF3EE" }]}
            >
              <MaterialIcons name="cloud" size={18} color="#7B9E87" />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: text }]}>
                Cloud backup
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                {supabaseConfigured
                  ? "Backed up to Supabase"
                  : "Sync metadata across devices."}
              </Text>
            </View>
            <Switch
              value={backupEnabled}
              onValueChange={setBackupEnabled}
              trackColor={{ false: "#D0CBE0", true: "#7B9E87" }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingsRow, { borderBottomColor: border }]}>
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#EEF2FA" }]}
            >
              <MaterialIcons name="wb-sunny" size={18} color="#4A6FA5" />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: text }]}>
                Weather-aware suggestions
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                Use location to adapt fabrics, layering, and rain-safe shoes.
              </Text>
            </View>
            <Switch
              value={weatherEnabled}
              onValueChange={setWeatherEnabled}
              trackColor={{ false: "#D0CBE0", true: "#7B9E87" }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomColor: border }]}
            activeOpacity={0.6}
          >
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#EBF3EE" }]}
            >
              <MaterialIcons name="verified-user" size={18} color="#3D6B50" />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: text }]}>
                Privacy & Data
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                Manage your on-device data
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={muted} />
          </TouchableOpacity>

          <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#F0EDE8" }]}
            >
              <MaterialIcons name="offline-bolt" size={18} color={text} />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: text }]}>
                Offline Mode
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                All data stays on device
              </Text>
            </View>
            <View style={[styles.activePill, { backgroundColor: "#EBF3EE" }]}>
              <Text style={[styles.activePillText, { color: "#7B9E87" }]}>
                Active
              </Text>
            </View>
          </View>
        </View>

        {/* Account group */}
        <Text style={[styles.groupLabel, { color: muted, marginTop: 16 }]}>
          ACCOUNT
        </Text>
        <View
          style={[
            styles.settingsGroup,
            { backgroundColor: surface, borderColor: border },
          ]}
        >
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomColor: border }]}
            activeOpacity={0.6}
            onPress={() =>
              router.push({ pathname: "/onboarding", params: { mode: "edit" } })
            }
          >
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#EEF2FA" }]}
            >
              <MaterialIcons name="person" size={18} color="#4A6FA5" />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: text }]}>
                Edit Profile
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                Update style preferences
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomColor: border }]}
            activeOpacity={0.6}
          >
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#FAF0EC" }]}
            >
              <MaterialIcons name="refresh" size={18} color="#C4714F" />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: text }]}>
                Reset Onboarding
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                Restart style preferences
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomWidth: 0 }]}
            activeOpacity={0.6}
          >
            <View
              style={[styles.settingsIconBox, { backgroundColor: "#FAF0F0" }]}
            >
              <MaterialIcons name="delete" size={18} color="#C45454" />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={[styles.settingsLabel, { color: danger }]}>
                Delete All Data
              </Text>
              <Text style={[styles.settingsDesc, { color: muted }]}>
                Permanently remove wardrobe
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={muted} />
          </TouchableOpacity>
        </View>
      </View>
      {/* ─── Data Ownership ───────────────────────────────────── */}
      <View
        style={[
          styles.card,
          { backgroundColor: surface, borderColor: danger + "55" },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: text }]}>
          Data Ownership
        </Text>
        <Text style={[styles.bulletText, { color: muted }]}>
          Delete wardrobe images, profile data, and recommendation history from
          one place. Export of tags and outfit history should be available
          before destructive actions.
        </Text>
        <View style={[styles.deletePanel, { backgroundColor: danger + "14" }]}>
          <Text style={[styles.deleteTitle, { color: danger }]}>
            Delete account and all wardrobe data
          </Text>
          <Text style={[styles.settingsDesc, { color: muted }]}>
            Recommended safeguard: 7-day recovery hold plus explicit
            confirmation.
          </Text>
        </View>
      </View>
      {/* ─── Privacy Footer ───────────────────────────────────── */}
      <View style={[styles.privacyFooter, { backgroundColor: "#EBF3EE" }]}>
        <MaterialIcons name="verified-user" size={14} color="#7B9E87" />
        <Text style={[styles.privacyText, { color: "#3D6B50" }]}>
          Your data is stored locally and never shared. Privacy first, always.
        </Text>
      </View>
      <Text style={[styles.versionText, { color: muted }]}>
        AI Wardrobe Expo v1.0.0 · Built with ♡
      </Text>
      {/* ─── Time-picker Modal ────────────────────────────────── */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={dismissTimePicker}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: background, borderColor: border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: text }]}>
              Set briefing time
            </Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: muted }]}>Hour</Text>
                <ScrollView
                  style={[styles.pickerScroll, { borderColor: border }]}
                  showsVerticalScrollIndicator={false}
                >
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.pickerItem,
                        pendingHour === h && { backgroundColor: warm + "33" },
                      ]}
                      onPress={() => setPendingHour(h)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          { color: pendingHour === h ? warm : text },
                        ]}
                      >
                        {String(h).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text style={[styles.pickerColon, { color: text }]}>:</Text>
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: muted }]}>Min</Text>
                <ScrollView
                  style={[styles.pickerScroll, { borderColor: border }]}
                  showsVerticalScrollIndicator={false}
                >
                  {MINUTES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.pickerItem,
                        pendingMinute === m && { backgroundColor: warm + "33" },
                      ]}
                      onPress={() => setPendingMinute(m)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          { color: pendingMinute === m ? warm : text },
                        ]}
                      >
                        {String(m).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: border }]}
                onPress={dismissTimePicker}
              >
                <Text style={[styles.modalBtnText, { color: muted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnConfirm,
                  { backgroundColor: warm },
                ]}
                onPress={confirmTimePicker}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 120,
    gap: 16,
  },

  /* ─── Cover & Avatar ─────────────────────────────────────── */
  coverGradient: {
    height: 120,
    backgroundColor: "#2C2840",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginHorizontal: -16,
    marginBottom: 32,
  },
  avatarAnchor: {
    position: "absolute",
    bottom: -28,
    left: 16,
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 3,
    backgroundColor: "#F0EDE8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 28 },
  levelBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#7B9E87",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadgeText: { fontSize: 8, fontWeight: "700", color: "#fff" },

  /* ─── Name Section ───────────────────────────────────────── */
  nameSection: { gap: 10 },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  nameCopy: { flex: 1, gap: 2 },
  nameText: { fontSize: 22, fontWeight: "700" },
  nameMeta: { fontSize: 12, lineHeight: 18 },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakPillFire: { fontSize: 14 },
  streakPillText: { fontSize: 12, fontWeight: "700" },
  editButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  editButtonText: { fontSize: 13, fontWeight: "600" },

  /* ─── Stats Bar ──────────────────────────────────────────── */
  statsBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 10, marginTop: 2 },
  statDivider: { width: 1, marginVertical: 10 },

  /* ─── XP Card ────────────────────────────────────────────── */
  xpCard: {
    backgroundColor: "#1A1826",
    borderRadius: 22,
    padding: 16,
    gap: 0,
  },
  xpCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  xpLevelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  xpLevelText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  xpNextText: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  xpRight: { alignItems: "flex-end" },
  xpTotalValue: { fontSize: 22, fontWeight: "700", color: "#fff" },
  xpTotalLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)" },
  xpBarTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: "#D4A853",
    borderRadius: 4,
  },
  xpBarLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 12,
  },
  xpBarLeft: { fontSize: 10, color: "rgba(255,255,255,0.4)" },
  xpBarRight: { fontSize: 10, color: "rgba(255,255,255,0.4)" },
  xpStreakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  xpStreakFire: { fontSize: 16 },
  xpStreakLabel: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  xpStreakBonus: { fontSize: 11, color: "#D4A853", fontWeight: "700" },

  /* ─── Shared Card ────────────────────────────────────────── */
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  sectionLink: { fontSize: 12 },

  /* ─── Badge Grid ─────────────────────────────────────────── */
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeGridItem: {
    width: "22%",
    alignItems: "center",
    gap: 6,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeName: {
    fontSize: 9,
    textAlign: "center",
    lineHeight: 13,
    fontWeight: "500",
  },

  /* ─── Challenges ─────────────────────────────────────────── */
  challengeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  challengeBadgeText: { fontSize: 11, fontWeight: "700" },

  /* ─── Settings ───────────────────────────────────────────── */
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  settingsGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  settingsIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsCopy: { flex: 1, gap: 1 },
  settingsLabel: { fontSize: 13, fontWeight: "600" },
  settingsDesc: { fontSize: 11 },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePillText: { fontSize: 11, fontWeight: "700" },

  /* ─── Privacy Footer ─────────────────────────────────────── */
  privacyFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  privacyText: { fontSize: 11, flex: 1, lineHeight: 16 },
  versionText: {
    textAlign: "center",
    fontSize: 10,
    marginBottom: 8,
  },

  /* ─── Time Picker Modal ──────────────────────────────────── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  pickerColumn: { flex: 1, gap: 6, alignItems: "center" },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pickerScroll: {
    height: 160,
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
  },
  pickerItem: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  pickerItemText: { fontSize: 18, fontWeight: "500" },
  pickerColon: { fontSize: 28, fontWeight: "700", marginTop: 20 },
  modalActions: { flexDirection: "row", gap: 12 },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalBtnConfirm: { borderWidth: 0 },
  modalBtnText: { fontSize: 15, fontWeight: "600" },

  /* ─── Style Preferences ──────────────────────────────────── */
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  subBlock: { gap: 3 },
  subBlockTitle: { fontSize: 14, fontWeight: "600" },
  subBlockMeta: { fontSize: 12, lineHeight: 18 },

  /* ─── Bullet List ────────────────────────────────────────── */
  bulletList: { gap: 8 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletDot: { marginTop: 4 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20 },

  /* ─── Live Integrations ──────────────────────────────────── */
  integrationList: { gap: 4 },
  integrationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  integrationDot: { width: 10, height: 10, borderRadius: 5 },
  integrationCopy: { flex: 1, gap: 1 },
  integrationLabel: { fontSize: 14, fontWeight: "600" },
  integrationDetail: { fontSize: 12 },
  integrationStatus: { fontSize: 12, fontWeight: "700" },

  /* ─── Colour Analysis ────────────────────────────────────── */
  paletteHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  paletteEmoji: { fontSize: 32 },
  paletteHeaderText: { flex: 1, gap: 2 },
  swatchRow: { flexDirection: "row", gap: 8 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  paletteCount: { fontSize: 13, fontWeight: "600", marginTop: 4 },

  /* ─── Top Rated Outfits ──────────────────────────────────── */
  ratedList: { gap: 8, marginTop: 4 },
  ratedRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  ratedStars: { flexDirection: "row", paddingTop: 1 },
  starGlyph: { fontSize: 13, color: "#f5c518" },
  ratedCopy: { flex: 1, gap: 2 },
  ratedItems: { fontSize: 13, fontWeight: "600" },
  ratedMeta: { fontSize: 11 },

  /* ─── Data Ownership ─────────────────────────────────────── */
  deletePanel: { borderRadius: 14, padding: 14, gap: 4 },
  deleteTitle: { fontSize: 14, fontWeight: "600" },
});
