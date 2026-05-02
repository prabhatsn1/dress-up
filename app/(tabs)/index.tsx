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
  SectionTitle,
} from "@/components/wardrobe-ui";
import { OutfitShareCard } from "@/components/outfit-share-card";
import { RatingSheet } from "@/components/rating-sheet";
import { StreakBanner } from "@/components/streak-banner";
import { WeeklyChallenges } from "@/components/weekly-challenges";
import { shareOutfitCard } from "@/lib/share-outfit";
import { Fonts } from "@/constants/theme";
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
  const heroOutfit = recommendations[0];
  const primaryItemIds = heroOutfit?.items.map((item) => item.id) ?? [];
  const backupOutfits = recommendations.slice(1, 4);
  const weeklyPlan = buildWeeklyPlan(items, profile, weather);
  const tomorrow = weeklyPlan[1];
  const insights = buildGapInsights(items);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const aiPrimaryItems =
    aiStylist?.primaryItemIds
      .map((itemId) => itemMap.get(itemId)?.name)
      .filter(Boolean) ?? [];

  return (
    <>
      <ScrollView
        style={[styles.screen, { backgroundColor: background }]}
        contentContainerStyle={styles.content}
      >
        <SectionTitle
          eyebrow="AI Wardrobe Expo"
          title={`Good ${dayPart.toLowerCase()}, ${profile.name.split(" ")[0]}.`}
          detail="Personal, weather-aware outfit picks built from your real closet."
        />

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

        <AppCard accent={warm}>
          <View style={styles.heroRow}>
            <View style={styles.heroHeading}>
              <Text style={[styles.heroTitle, { color: text }]}>
                What should I wear today?
              </Text>
              <Text style={[styles.heroMeta, { color: muted }]}>
                {context.weather.location} · {context.weather.temperatureC}C ·{" "}
                {context.weather.condition}
              </Text>
              <Text style={[styles.weatherSource, { color: muted }]}>
                {isWeatherLoading
                  ? "Refreshing live weather..."
                  : `Live weather via ${context.weather.source ?? "provider"}${context.weather.lastUpdated ? ` · ${context.weather.lastUpdated}` : ""}`}
              </Text>
            </View>
            <View
              style={[styles.confidenceBadge, { backgroundColor: success }]}
            >
              <Text style={styles.confidenceText}>
                {heroOutfit.confidence}% match
              </Text>
            </View>
          </View>

          <View style={styles.utilityRow}>
            <Text style={[styles.utilityText, { color: muted }]}>
              Closet source:{" "}
              {wardrobeSource === "supabase" ? "Supabase" : "Local wardrobe"}
            </Text>
            <Pressable onPress={() => void refreshWeather()}>
              <Text style={[styles.utilityLink, { color: cool }]}>
                Refresh weather
              </Text>
            </Pressable>
          </View>
          {weatherError ? (
            <Text style={[styles.inlineNotice, { color: warm }]}>
              {weatherError}
            </Text>
          ) : null}
          {lastSyncMessage ? (
            <Text style={[styles.inlineNotice, { color: muted }]}>
              {lastSyncMessage}
            </Text>
          ) : null}

          <View style={styles.chipRow}>
            {occasions.map((value) => (
              <Chip
                key={value}
                label={value}
                active={value === occasion}
                onPress={() => setOccasion(value)}
              />
            ))}
          </View>

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

          <View style={[styles.outfitPanel, { borderColor: border }]}>
            <Text style={[styles.outfitName, { color: text }]}>
              {heroOutfit.name}
            </Text>
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
            <View style={styles.itemList}>
              {heroOutfit.items.map((item) => (
                <View
                  key={item.id}
                  style={[styles.itemPill, { borderColor: border }]}
                >
                  <View style={styles.swatchRow}>
                    {item.colours.map((colour) => (
                      <ColorSwatch
                        key={`${item.id}-${colour}`}
                        colour={colour}
                      />
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
                    Add {heroOutfit.accessorySuggestion.name} for a finished
                    look.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </AppCard>

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
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
    gap: 18,
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  heroHeading: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: Fonts.serif,
    fontWeight: "700",
  },
  heroMeta: {
    fontSize: 14,
  },
  weatherSource: {
    fontSize: 12,
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  utilityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  utilityText: {
    flex: 1,
    fontSize: 12,
  },
  utilityLink: {
    fontSize: 13,
    fontWeight: "700",
  },
  inlineNotice: {
    fontSize: 12,
    lineHeight: 18,
  },
  confidenceText: {
    color: "#fff8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  outfitPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  outfitName: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
  },
  outfitNote: {
    fontSize: 14,
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
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
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
    fontSize: 14,
    lineHeight: 21,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  microLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
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
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  tomorrowMeta: {
    fontSize: 14,
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
    borderRadius: 999,
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
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1.5,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  wornButtonDisabled: {
    opacity: 0.6,
  },
  wornButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
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
    borderRadius: 10,
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
    borderRadius: 20,
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
    borderRadius: 999,
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
