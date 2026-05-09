import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  AppCard,
  Chip,
  ColorSwatch,
  MetricCard,
} from "@/components/wardrobe-ui";
import { OutfitShareCard } from "@/components/outfit-share-card";
import { RatingSheet } from "@/components/rating-sheet";
import { StreakBanner } from "@/components/streak-banner";
import { WeeklyChallenges } from "@/components/weekly-challenges";
import { shareOutfitCard } from "@/lib/share-outfit";

import { useThemeColor } from "@/hooks/use-theme-color";
import {
  generateAiStylistRecommendation,
  type AiStylistRecommendation,
} from "@/lib/ai";
import {
  buildGapInsights,
  buildRecommendations,
  buildWeeklyPlan,
  computeItemCpw,
  computeOutfitCpw,
  type OccasionType,
  type OutfitSuggestion,
  type WeeklyPlanEntry,
} from "@/lib/wardrobe";
import { useAppData } from "@/providers/app-data-provider";

export { RouteErrorBoundary as ErrorBoundary } from "@/components/error-boundary";

const occasions: OccasionType[] = [
  "Office",
  "Party",
  "Date",
  "Wedding",
  "Casual",
  "Gym",
  "Travel",
];
const dayParts = ["Morning", "Afternoon", "Evening"] as const;

export default function TodayScreen() {
  const [occasion, setOccasion] = useState<OccasionType>("Office");
  const [feedback, setFeedback] = useState<string | null>("Like");
  const [wornToday, setWornToday] = useState(false);
  const [wornConfirmation, setWornConfirmation] = useState<string | null>(null);
  const wornTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<View>(null);
  const [aiStylist, setAiStylist] = useState<AiStylistRecommendation | null>(
    null,
  );
  const [isAiStylistLoading, setIsAiStylistLoading] = useState(false);
  const [aiStylistError, setAiStylistError] = useState<string | null>(null);
  const {
    items,
    weather,
    isWeatherLoading,
    weatherError,
    refreshWeather,
    wardrobeSource,
    supabaseConfigured,
    lastSyncMessage,
    logOutfit,
    repeatWarning,
    dismissRepeatWarning,
    pendingRatingLog,
    submitRating,
    dismissRating,
    profile,
    gamification,
    weeklyChallenges,
    lastGamificationUpdate,
    dismissGamificationUpdate,
  } = useAppData();
  const [showRewardModal, setShowRewardModal] = useState(false);

  useEffect(() => {
    if (
      lastGamificationUpdate &&
      (lastGamificationUpdate.newBadges.length > 0 ||
        lastGamificationUpdate.completedChallenges.length > 0)
    ) {
      setShowRewardModal(true);
    }
  }, [lastGamificationUpdate]);
  const [dayPart, setDayPart] = useState<(typeof dayParts)[number]>(
    weather.dayPart,
  );

  useEffect(() => {
    setDayPart(weather.dayPart);
  }, [weather.dayPart]);

  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const cool = useThemeColor({}, "accentCool");
  const success = useThemeColor({}, "success");

  const context = {
    occasion,
    weather: {
      ...weather,
      dayPart,
    },
  };
  const recommendations = buildRecommendations(items, profile, context);
  const heroOutfit: OutfitSuggestion = recommendations[0] ?? {
    id: "fallback-outfit",
    name: "No recommendation yet",
    confidence: 0,
    score: 0,
    items: [],
    reasons: [
      "Add at least one top, bottom, and shoes to start generating recommendations.",
    ],
    note: "Add a few wardrobe items to unlock your first AI-assisted look.",
  };
  const primaryItemIds = heroOutfit?.items.map((item) => item.id) ?? [];
  const backupOutfits = recommendations.slice(1, 4);
  const weeklyPlan = buildWeeklyPlan(items, profile, weather);
  const tomorrowRaw = weeklyPlan[1];
  const tomorrow: WeeklyPlanEntry = tomorrowRaw?.outfit
    ? tomorrowRaw
    : {
        day: tomorrowRaw?.day ?? "Tomorrow",
        context: tomorrowRaw?.context ?? {
          occasion,
          weather,
        },
        outfit: {
          id: "fallback-tomorrow",
          name: "No outfit available yet",
          confidence: 0,
          score: 0,
          items: [],
          reasons: ["Add wardrobe items to generate a weekly preview."],
          note: "",
        },
      };
  const insights = buildGapInsights(items);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const aiPrimaryItems =
    aiStylist?.primaryItemIds
      .map((itemId) => itemMap.get(itemId)?.name)
      .filter(Boolean) ?? [];

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const greetingLabel =
    dayPart === "Morning"
      ? "Good morning"
      : dayPart === "Afternoon"
        ? "Good afternoon"
        : "Good evening";

  return (
    <>
      <ScrollView
        style={[styles.screen, { backgroundColor: background }]}
        contentContainerStyle={styles.content}
      >
        {/* ─── Figma Header ─────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerDate, { color: muted }]}>
              {dateStr.toUpperCase()}
            </Text>
            <Text style={[styles.headerGreeting, { color: text }]}>
              {greetingLabel}, {profile.name.split(" ")[0]} 👋
            </Text>
          </View>
          <View style={[styles.headerAvatar, { borderColor: border }]}>
            <MaterialIcons name="person" size={20} color={muted} />
          </View>
        </View>

        {/* ─── Streak Banner (Figma style) ──────────────────────── */}
        <StreakBanner
          state={gamification}
          newXp={lastGamificationUpdate?.xpGained ?? 0}
        />

        {weeklyChallenges.length > 0 && (
          <AppCard>
            <Text style={[styles.subheading, { color: text }]}>
              This week&apos;s challenges
            </Text>
            <WeeklyChallenges challenges={weeklyChallenges} />
          </AppCard>
        )}

        {/* ─── Weather Card (Figma gradient style) ──────────────── */}
        <View style={styles.weatherCard}>
          <View style={styles.weatherTopRow}>
            <View>
              <View style={styles.weatherLocationRow}>
                <MaterialIcons
                  name="location-on"
                  size={12}
                  color="rgba(255,255,255,0.6)"
                />
                <Text style={styles.weatherLocation}>
                  {context.weather.location}
                </Text>
              </View>
              <View style={styles.weatherTempRow}>
                <Text style={styles.weatherTemp}>
                  {context.weather.temperatureC}°
                </Text>
                <Text style={styles.weatherTempUnit}>C</Text>
              </View>
              <View style={styles.weatherCondRow}>
                <MaterialIcons
                  name="cloud"
                  size={14}
                  color="rgba(255,255,255,0.7)"
                />
                <Text style={styles.weatherCondText}>
                  {context.weather.condition}
                </Text>
              </View>
            </View>
            <View style={styles.weatherIconCircle}>
              <Text style={{ fontSize: 32 }}>
                {context.weather.condition.toLowerCase().includes("rain")
                  ? "🌧"
                  : context.weather.condition.toLowerCase().includes("cloud")
                    ? "🌤"
                    : "☀️"}
              </Text>
            </View>
          </View>

          <View style={styles.weatherStatsRow}>
            <View style={styles.weatherStat}>
              <MaterialIcons
                name="water-drop"
                size={13}
                color="rgba(255,255,255,0.5)"
              />
              <View>
                <Text style={styles.weatherStatLabel}>HUMIDITY</Text>
                <Text style={styles.weatherStatValue}>
                  {context.weather.humidity ?? "—"}%
                </Text>
              </View>
            </View>
            <View style={styles.weatherStat}>
              <MaterialIcons
                name="air"
                size={13}
                color="rgba(255,255,255,0.5)"
              />
              <View>
                <Text style={styles.weatherStatLabel}>WIND</Text>
                <Text style={styles.weatherStatValue}>
                  {context.weather.windKph ?? "—"} km/h
                </Text>
              </View>
            </View>
            <View style={styles.weatherStat}>
              <MaterialIcons
                name="thermostat"
                size={13}
                color="rgba(255,255,255,0.5)"
              />
              <View>
                <Text style={styles.weatherStatLabel}>FEELS LIKE</Text>
                <Text style={styles.weatherStatValue}>
                  {context.weather.feelsLikeC ?? context.weather.temperatureC}°C
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.weatherTipRow}>
            <Text style={styles.weatherTipStar}>✦</Text>
            <Text style={styles.weatherTipText}>
              {isWeatherLoading
                ? "Refreshing live weather..."
                : `Rain risk: ${context.weather.rainChance}%. Source: ${wardrobeSource === "supabase" ? "Supabase" : "Local"}`}
            </Text>
            <Pressable onPress={() => void refreshWeather()}>
              <MaterialIcons
                name="refresh"
                size={14}
                color="rgba(255,255,255,0.7)"
              />
            </Pressable>
          </View>
          {weatherError ? (
            <Text style={styles.weatherErrorText}>{weatherError}</Text>
          ) : null}
        </View>

        {/* ─── Occasion Selector (Figma icon pills) ─────────────── */}
        <View style={styles.occasionSection}>
          <Text style={[styles.occasionHeading, { color: muted }]}>
            WHAT&apos;S THE OCCASION?
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.occasionScroll}
          >
            {occasions.map((value) => {
              const active = value === occasion;
              return (
                <Pressable
                  key={value}
                  onPress={() => setOccasion(value)}
                  style={[
                    styles.occasionPill,
                    active
                      ? styles.occasionPillActive
                      : { backgroundColor: `${cool}15` },
                  ]}
                >
                  <MaterialIcons
                    name={
                      value === "Office"
                        ? "work"
                        : value === "Party"
                          ? "star"
                          : value === "Date"
                            ? "favorite"
                            : value === "Wedding"
                              ? "celebration"
                              : value === "Casual"
                                ? "wb-sunny"
                                : value === "Gym"
                                  ? "fitness-center"
                                  : "flight"
                    }
                    size={18}
                    color={active ? "#FFFFFF" : cool}
                  />
                  <Text
                    style={[
                      styles.occasionPillText,
                      active ? styles.occasionPillTextActive : { color: text },
                    ]}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Day part selector */}
        <View style={styles.chipRow}>
          {dayParts.map((value) => (
            <Chip
              key={value}
              label={value}
              active={value === dayPart}
              onPress={() => setDayPart(value)}
            />
          ))}
        </View>

        {lastSyncMessage ? (
          <Text style={[styles.inlineNotice, { color: muted }]}>
            {lastSyncMessage}
          </Text>
        ) : null}

        {/* ─── Outfit Suggestions (Figma card style) ────────────── */}
        <View style={styles.outfitSectionHeader}>
          <Text style={[styles.outfitSectionTitle, { color: text }]}>
            Outfit Suggestions
          </Text>
          <View style={[styles.outfitCountBadge, { borderColor: border }]}>
            <Text style={[styles.outfitCountText, { color: muted }]}>
              {recommendations.length} picks
            </Text>
          </View>
        </View>

        {/* Hero Outfit Card */}
        <View style={[styles.outfitCard, { borderColor: border }]}>
          <View style={styles.outfitCardHeader}>
            <Text style={[styles.outfitName, { color: text }]}>
              {heroOutfit.name}
            </Text>
            <View style={styles.outfitConfidenceBadge}>
              <View style={styles.outfitConfidenceDot} />
              <Text style={styles.outfitConfidenceText}>
                {heroOutfit.confidence}% match
              </Text>
            </View>
          </View>

          <Text style={[styles.outfitNote, { color: muted }]}>
            {heroOutfit.note}
          </Text>
          {(() => {
            const outfitCpw = computeOutfitCpw(heroOutfit.items);
            return outfitCpw !== undefined ? (
              <Text style={[styles.outfitCpw, { color: muted }]}>
                Outfit CPW: ${outfitCpw.toFixed(2)} / wear
              </Text>
            ) : null;
          })()}

          {/* Reason tags (Figma pill style) */}
          <View style={styles.reasonTagRow}>
            {heroOutfit.reasons.map((reason, i) => (
              <View
                key={`reason-${i}`}
                style={[
                  styles.reasonTag,
                  {
                    backgroundColor: `${success}20`,
                    borderColor: `${success}40`,
                  },
                ]}
              >
                <View
                  style={[styles.reasonTagDot, { backgroundColor: success }]}
                />
                <Text style={[styles.reasonTagText, { color: success }]}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.itemList}>
            {heroOutfit.items.map((item) => (
              <View
                key={item.id}
                style={[styles.itemPill, { borderColor: border }]}
              >
                <View style={styles.swatchRow}>
                  {item.colours.map((colour) => (
                    <ColorSwatch key={`${item.id}-${colour}`} colour={colour} />
                  ))}
                </View>
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemName, { color: text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemMeta, { color: muted }]}>
                    {item.subcategory} · {item.fit} fit · {item.pattern}
                    {computeItemCpw(item) !== undefined
                      ? ` · $${computeItemCpw(item)!.toFixed(2)}/wear`
                      : ""}
                  </Text>
                </View>
              </View>
            ))}
            {heroOutfit.accessorySuggestion ? (
              <View
                style={[
                  styles.accessoryPanel,
                  { backgroundColor: `${cool}1A` },
                ]}
              >
                <MaterialIcons name="auto-fix-high" size={18} color={cool} />
                <Text style={[styles.accessoryText, { color: text }]}>
                  Add {heroOutfit.accessorySuggestion.name} for a finished look.
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Action row: Log + Share */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.wornButton,
              styles.actionRowItem,
              { backgroundColor: wornToday ? success : cool },
              (wornToday || primaryItemIds.length === 0) &&
                styles.wornButtonDisabled,
            ]}
            onPress={async () => {
              if (wornToday || primaryItemIds.length === 0) return;
              await logOutfit(
                primaryItemIds,
                occasion,
                context.weather.temperatureC,
              );
              setWornToday(true);
              setWornConfirmation(
                "Outfit logged! Your stats have been updated.",
              );
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              if (wornTimeoutRef.current) clearTimeout(wornTimeoutRef.current);
              wornTimeoutRef.current = setTimeout(
                () => setWornConfirmation(null),
                2000,
              );
            }}
            disabled={wornToday || primaryItemIds.length === 0}
            activeOpacity={0.75}
          >
            <Text style={styles.wornButtonText}>
              {wornToday ? "✓ Logged" : "✓ Wore this"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.shareButton,
              styles.actionRowItem,
              { borderColor: warm, opacity: isSharing ? 0.6 : 1 },
            ]}
            onPress={async () => {
              if (isSharing) return;
              if (!shareCardRef.current) {
                Alert.alert("Error", "Unable to capture outfit card");
                return;
              }
              setIsSharing(true);
              try {
                const result = await shareOutfitCard(
                  shareCardRef as React.RefObject<View>,
                  `${heroOutfit.name} — styled by DressUp ✨`,
                );
                if (!result.success && result.error) {
                  Alert.alert("Share failed", result.error);
                }
              } finally {
                setIsSharing(false);
              }
            }}
            disabled={isSharing}
            activeOpacity={0.75}
          >
            <MaterialIcons name="ios-share" size={16} color={warm} />
            <Text style={[styles.shareButtonText, { color: warm }]}>
              {isSharing ? "Preparing…" : "Share Look"}
            </Text>
          </TouchableOpacity>
        </View>
        {wornConfirmation ? (
          <Text style={[styles.wornConfirmation, { color: success }]}>
            {wornConfirmation}
          </Text>
        ) : null}

        {repeatWarning ? (
          <TouchableOpacity
            onPress={dismissRepeatWarning}
            style={[
              styles.repeatWarningBanner,
              { backgroundColor: `${warm}22`, borderColor: warm },
            ]}
            activeOpacity={0.8}
          >
            <MaterialIcons name="warning-amber" size={16} color={warm} />
            <Text style={[styles.repeatWarningText, { color: warm }]}>
              {repeatWarning.message}
            </Text>
            <MaterialIcons name="close" size={14} color={warm} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.metricRow}>
          <MetricCard
            label="Suggestions"
            value={`${recommendations.length}`}
            tone={warm}
          />
          <MetricCard
            label="Rain Risk"
            value={`${context.weather.rainChance}%`}
            tone={cool}
          />
          <MetricCard
            label="Feels Like"
            value={`${context.weather.feelsLikeC ?? context.weather.temperatureC}C`}
            tone={success}
          />
        </View>

        <AppCard accent={success}>
          <View style={styles.sectionRow}>
            <Text style={[styles.subheading, { color: text }]}>AI stylist</Text>
            <Pressable
              onPress={async () => {
                if (!supabaseConfigured) {
                  setAiStylistError(
                    "Supabase must be configured before the AI stylist can run.",
                  );
                  return;
                }

                setIsAiStylistLoading(true);
                setAiStylistError(null);

                try {
                  const result = await generateAiStylistRecommendation({
                    items,
                    occasion,
                    weather: context.weather,
                    profile,
                  });
                  setAiStylist(result);
                } catch (error) {
                  setAiStylistError(
                    error instanceof Error
                      ? `AI stylist failed. ${error.message}`
                      : "AI stylist failed.",
                  );
                } finally {
                  setIsAiStylistLoading(false);
                }
              }}
            >
              <Text style={[styles.utilityLink, { color: cool }]}>
                {isAiStylistLoading ? "Running..." : "Run AI stylist"}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.reasonText, { color: muted }]}>
            OpenAI generates structured outfit reasoning from your closet,
            weather, and occasion. Hugging Face improves item metadata before
            the stylist sees it.
          </Text>
          {aiStylistError ? (
            <Text style={[styles.inlineNotice, { color: warm }]}>
              {aiStylistError}
            </Text>
          ) : null}
          {aiStylist ? (
            <View style={styles.aiStylistPanel}>
              <View style={styles.sectionRow}>
                <Text style={[styles.backupTitle, { color: text }]}>
                  {aiStylist.headline}
                </Text>
                <Text style={[styles.backupScore, { color: muted }]}>
                  {aiStylist.confidence}%
                </Text>
              </View>
              <Text style={[styles.reasonText, { color: muted }]}>
                {aiStylist.summary}
              </Text>
              <Text style={[styles.aiPrimary, { color: text }]}>
                {aiPrimaryItems.length > 0
                  ? aiPrimaryItems.join(" · ")
                  : "AI returned item ids not present locally."}
              </Text>
              <View style={styles.reasonList}>
                {aiStylist.reasons.map((reason) => (
                  <View key={reason} style={styles.reasonRow}>
                    <MaterialIcons
                      name="auto-awesome"
                      size={18}
                      color={success}
                    />
                    <Text style={[styles.reasonText, { color: muted }]}>
                      {reason}
                    </Text>
                  </View>
                ))}
              </View>
              {aiStylist.accessorySuggestion ? (
                <Text style={[styles.reasonText, { color: muted }]}>
                  Accessory suggestion: {aiStylist.accessorySuggestion}
                </Text>
              ) : null}
              <Text style={[styles.stylistNote, { color: muted }]}>
                {aiStylist.stylistNote}
              </Text>
            </View>
          ) : null}
        </AppCard>

        <AppCard accent={cool}>
          <Text style={[styles.subheading, { color: text }]}>
            Why this works
          </Text>
          <View style={styles.reasonList}>
            {heroOutfit.reasons.map((reason) => (
              <View key={reason} style={styles.reasonRow}>
                <MaterialIcons name="done" size={18} color={cool} />
                <Text style={[styles.reasonText, { color: muted }]}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.subheading, { color: text }]}>
            Feedback loop
          </Text>
          <View style={styles.chipRow}>
            {["Like", "Too formal", "Colour miss", "Not my style"].map(
              (label) => (
                <Chip
                  key={label}
                  label={label}
                  active={feedback === label}
                  onPress={() => setFeedback(label)}
                />
              ),
            )}
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.sectionRow}>
            <Text style={[styles.subheading, { color: text }]}>
              Backup options
            </Text>
            <Text style={[styles.microLabel, { color: muted }]}>
              2 to 5 ranked recommendations
            </Text>
          </View>
          <View style={styles.backupList}>
            {backupOutfits.map((outfit) => (
              <View
                key={outfit.id}
                style={[styles.backupCard, { borderColor: border }]}
              >
                <View style={styles.sectionRow}>
                  <Text style={[styles.backupTitle, { color: text }]}>
                    {outfit.name}
                  </Text>
                  <Text style={[styles.backupScore, { color: muted }]}>
                    {outfit.confidence}%
                  </Text>
                </View>
                <Text style={[styles.backupItems, { color: muted }]}>
                  {outfit.items.map((item) => item.name).join(" · ")}
                </Text>
                {(() => {
                  const cpw = computeOutfitCpw(outfit.items);
                  return cpw !== undefined ? (
                    <Text style={[styles.outfitCpw, { color: muted }]}>
                      CPW ${cpw.toFixed(2)} / wear
                    </Text>
                  ) : null;
                })()}
              </View>
            ))}
          </View>
        </AppCard>

        <AppCard accent={warm}>
          <View style={styles.sectionRow}>
            <Text style={[styles.subheading, { color: text }]}>
              Tomorrow preview
            </Text>
            <Text style={[styles.microLabel, { color: muted }]}>
              {tomorrow.day}
            </Text>
          </View>
          <Text style={[styles.tomorrowTitle, { color: text }]}>
            {tomorrow.context.occasion} · {tomorrow.outfit.name}
          </Text>
          <Text style={[styles.tomorrowMeta, { color: muted }]}>
            {tomorrow.context.weather.temperatureC}C ·{" "}
            {tomorrow.context.weather.condition} · avoids repeating today&apos;s
            lead pieces
          </Text>
        </AppCard>

        <AppCard>
          <Text style={[styles.subheading, { color: text }]}>
            Wardrobe gap detection
          </Text>
          <View style={styles.reasonList}>
            {insights.map((insight) => (
              <View key={insight.title} style={styles.insightRow}>
                <View style={[styles.insightDot, { backgroundColor: warm }]} />
                <View style={styles.insightCopy}>
                  <Text style={[styles.insightTitle, { color: text }]}>
                    {insight.title}
                  </Text>
                  <Text style={[styles.reasonText, { color: muted }]}>
                    {insight.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </AppCard>
      </ScrollView>

      <RatingSheet
        visible={!!pendingRatingLog}
        outfitItems={
          pendingRatingLog
            ? pendingRatingLog.itemIds
                .map((id) => itemMap.get(id))
                .filter((i): i is NonNullable<typeof i> => !!i)
            : []
        }
        onRate={submitRating}
        onDismiss={dismissRating}
      />

      {/* Off-screen share card — captured by ViewShot, never visible */}
      <OutfitShareCard
        ref={shareCardRef}
        outfit={heroOutfit}
        weather={context.weather}
        occasion={occasion}
      />

      {/* Gamification reward modal */}
      <Modal
        visible={showRewardModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowRewardModal(false);
          dismissGamificationUpdate();
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.rewardModal,
              { backgroundColor: background, borderColor: border },
            ]}
          >
            <Text style={[styles.rewardTitle, { color: text }]}>
              {lastGamificationUpdate?.streakBroken
                ? "Streak reset — keep going!"
                : "You earned rewards! 🎉"}
            </Text>
            <Text style={[styles.rewardXp, { color: warm }]}>
              +{lastGamificationUpdate?.xpGained ?? 0} XP
            </Text>
            {(lastGamificationUpdate?.newBadges ?? []).map((badge) => (
              <View
                key={badge.id}
                style={[styles.rewardBadgeRow, { borderColor: border }]}
              >
                <MaterialIcons
                  name={
                    badge.icon as React.ComponentProps<
                      typeof MaterialIcons
                    >["name"]
                  }
                  size={22}
                  color={warm}
                />
                <View>
                  <Text style={[styles.rewardBadgeName, { color: text }]}>
                    {badge.name}
                  </Text>
                  <Text style={[styles.rewardBadgeDesc, { color: muted }]}>
                    {badge.description}
                  </Text>
                </View>
              </View>
            ))}
            {(lastGamificationUpdate?.completedChallenges ?? []).map((c) => (
              <View
                key={c.id}
                style={[styles.rewardBadgeRow, { borderColor: border }]}
              >
                <MaterialIcons name="flag" size={22} color={success} />
                <View>
                  <Text style={[styles.rewardBadgeName, { color: text }]}>
                    Challenge complete!
                  </Text>
                  <Text style={[styles.rewardBadgeDesc, { color: muted }]}>
                    {c.title}
                  </Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.rewardDismiss, { backgroundColor: warm }]}
              onPress={() => {
                setShowRewardModal(false);
                dismissGamificationUpdate();
              }}
            >
              <Text style={styles.rewardDismissText}>Keep it up!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 16,
  },
  /* ─── Header ─────────────────────────────────────────────── */
  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerDate: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.8,
  },
  headerGreeting: {
    fontSize: 22,
    fontWeight: "600",
    marginTop: 2,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0EDE8",
  },
  /* ─── Weather Card ───────────────────────────────────────── */
  weatherCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#3D5A80",
    padding: 20,
    gap: 16,
  },
  weatherTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  weatherLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  weatherLocation: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  weatherTempRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  weatherTemp: {
    fontSize: 52,
    fontWeight: "300",
    color: "#FFFFFF",
    lineHeight: 56,
  },
  weatherTempUnit: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 8,
  },
  weatherCondRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  weatherCondText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  weatherIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  weatherStatsRow: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  weatherStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  weatherStatLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.5,
  },
  weatherStatValue: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  weatherTipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weatherTipStar: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },
  weatherTipText: {
    flex: 1,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  weatherErrorText: {
    fontSize: 11,
    color: "#F4A4A4",
    marginTop: 4,
  },
  /* ─── Occasion Selector ──────────────────────────────────── */
  occasionSection: {
    gap: 12,
  },
  occasionHeading: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  occasionScroll: {
    gap: 10,
    paddingRight: 16,
  },
  occasionPill: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  occasionPillActive: {
    backgroundColor: "#1A1826",
  },
  occasionPillText: {
    fontSize: 10,
    fontWeight: "600",
  },
  occasionPillTextActive: {
    color: "#FFFFFF",
  },
  /* ─── Outfit Section ─────────────────────────────────────── */
  outfitSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  outfitSectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  outfitCountBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFFFFF",
  },
  outfitCountText: {
    fontSize: 12,
  },
  outfitCard: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
  },
  outfitCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  outfitConfidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  outfitConfidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7B9E87",
  },
  outfitConfidenceText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1A1826",
  },
  reasonTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  reasonTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reasonTagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  /* ─── Shared / existing ──────────────────────────────────── */
  inlineNotice: {
    fontSize: 12,
    lineHeight: 18,
  },
  utilityLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A6FA5",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  outfitName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    flex: 1,
  },
  outfitNote: {
    fontSize: 13,
    lineHeight: 19,
  },
  outfitCpw: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
  },
  itemList: {
    gap: 10,
  },
  itemPill: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  swatchRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  itemCopy: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
  },
  itemMeta: {
    fontSize: 13,
  },
  accessoryPanel: {
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  accessoryText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  subheading: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
  },
  reasonList: {
    gap: 12,
  },
  reasonRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  microLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  backupList: {
    gap: 10,
  },
  backupCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  backupTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  backupScore: {
    fontSize: 13,
    fontWeight: "600",
  },
  backupItems: {
    fontSize: 13,
    lineHeight: 19,
  },
  aiStylistPanel: {
    gap: 10,
  },
  aiPrimary: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  stylistNote: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },
  tomorrowTitle: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  tomorrowMeta: {
    fontSize: 13,
    lineHeight: 20,
  },
  insightRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  insightDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 5,
  },
  insightCopy: {
    flex: 1,
    gap: 4,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  wornButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionRowItem: {
    flex: 1,
  },
  shareButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1.5,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  wornButtonDisabled: {
    opacity: 0.6,
  },
  wornButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  wornConfirmation: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    marginTop: -8,
  },
  repeatWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  repeatWarningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  rewardModal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 14,
  },
  rewardTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  rewardXp: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
  },
  rewardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  rewardBadgeName: {
    fontSize: 14,
    fontWeight: "700",
  },
  rewardBadgeDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  rewardDismiss: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  rewardDismissText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
