import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { OutfitCalendar } from "@/components/outfit-calendar";
import { ColorSwatch } from "@/components/wardrobe-ui";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getSession } from "@/lib/auth";
import { buildPackingList, buildWeeklyPlan } from "@/lib/wardrobe";
import { useAppData } from "@/providers/app-data-provider";
import InspirationScreen from "./inspiration";

export { RouteErrorBoundary as ErrorBoundary } from "@/components/error-boundary";

type PlanTab = "plan" | "inspiration";

export default function PlannerScreen() {
  const [activeTab, setActiveTab] = useState<PlanTab>("plan");
  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const cool = useThemeColor({}, "accentCool");
  const tint = useThemeColor({}, "tint");
  const { items, weather, isWeatherLoading, profile } = useAppData();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((s) => setUserId(s?.user.id ?? null));
  }, []);

  const weeklyPlanRaw = buildWeeklyPlan(items, profile, weather);
  const weeklyPlan = weeklyPlanRaw.filter((e) => e.outfit != null);
  const packingList = buildPackingList(weeklyPlan);

  const tabs: { id: PlanTab; label: string; icon: string }[] = [
    { id: "plan", label: "Planner", icon: "calendar-month" },
    { id: "inspiration", label: "Inspiration", icon: "collections" },
  ];

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      {/* ─── Inner Tab Bar ─────────────────────────────────────── */}
      <View style={[styles.innerTabBar, { borderBottomColor: border }]}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.innerTab,
                active && { borderBottomColor: tint, borderBottomWidth: 2 },
              ]}
            >
              <View style={styles.innerTabContent}>
                <MaterialIcons
                  name={tab.icon as any}
                  size={16}
                  color={active ? tint : muted}
                />
                <Text
                  style={[
                    styles.innerTabLabel,
                    { color: active ? tint : muted },
                  ]}
                >
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ─── Tab Content ───────────────────────────────────────── */}
      {activeTab === "inspiration" ? (
        <InspirationScreen />
      ) : (
        <ScrollView
          style={[styles.screen, { backgroundColor: background }]}
          contentContainerStyle={styles.content}
        >
          {/* ─── Figma Header ─────────────────────────────────────── */}
          <View style={styles.headerSection}>
            <Text style={[styles.headerTitle, { color: text }]}>Planner</Text>
            <Text style={[styles.headerSub, { color: muted }]}>
              Plan your week ahead with AI suggestions.
            </Text>
          </View>

          {userId ? <OutfitCalendar userId={userId} items={items} /> : null}

          {/* ─── Tomorrow Card ────────────────────────────────────── */}
          <View style={[styles.tomorrowCard, { borderColor: border }]}>
            <View style={styles.tomorrowTop}>
              <Text style={[styles.tomorrowTitle, { color: text }]}>
                What should I wear tomorrow?
              </Text>
              <MaterialIcons name="wb-sunny" size={18} color={cool} />
            </View>
            <Text style={[styles.tomorrowText, { color: muted }]}>
              Tomorrow is optimized for{" "}
              {weeklyPlan[1]?.context.occasion.toLowerCase() ?? "your style"} at{" "}
              {weeklyPlan[1]?.context.weather.temperatureC ?? "—"}°C with a
              different hero piece than today.
            </Text>
            <Text style={[styles.tomorrowMeta, { color: muted }]}>
              {isWeatherLoading
                ? "Checking tomorrow against live weather..."
                : `Weather: ${weather.location}`}
            </Text>
          </View>

          {/* ─── Weekly Plan ──────────────────────────────────────── */}
          <View style={styles.planSection}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              This Week
            </Text>
            <View style={styles.planList}>
              {weeklyPlan.map((entry) => (
                <View
                  key={entry.day}
                  style={[styles.planCard, { borderColor: border }]}
                >
                  <View style={styles.planDayBadge}>
                    <Text style={styles.planDayBadgeText}>
                      {entry.day.slice(0, 3)}
                    </Text>
                  </View>
                  <View style={styles.planCardContent}>
                    <Text
                      style={[styles.planCardTitle, { color: text }]}
                      numberOfLines={1}
                    >
                      {entry.outfit?.name ?? "No outfit"}
                    </Text>
                    <Text style={[styles.planCardMeta, { color: muted }]}>
                      {entry.context.occasion} ·{" "}
                      {entry.context.weather.temperatureC}°C ·{" "}
                      {entry.context.weather.condition}
                    </Text>
                  </View>
                  <Text style={[styles.planConfidence, { color: muted }]}>
                    {entry.outfit?.confidence ?? 0}%
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ─── Trip Mode / Packing List ─────────────────────────── */}
          <View style={[styles.tripCard, { borderColor: border }]}>
            <View style={styles.tripHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: text }]}>
                  Trip Mode
                </Text>
                <Text style={[styles.tripDates, { color: muted }]}>
                  Packing list built from upcoming outfits
                </Text>
              </View>
              <MaterialIcons name="luggage" size={24} color={warm} />
            </View>

            <View style={styles.packList}>
              {packingList.map((item) => (
                <View
                  key={item.id}
                  style={[styles.packRow, { borderColor: border }]}
                >
                  <View style={styles.packCopy}>
                    <Text style={[styles.packName, { color: text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.packMeta, { color: muted }]}>
                      {item.category} · {item.material}
                    </Text>
                  </View>
                  <View style={styles.swatchRow}>
                    {item.colours.map((colour) => (
                      <ColorSwatch
                        key={`${item.id}-${colour}`}
                        colour={colour}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  /* ─── Inner Tab Bar ──────────────────────────────────────── */
  innerTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingTop: 12,
  },
  innerTab: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  innerTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  innerTabLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
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
    gap: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
  },
  headerSub: {
    fontSize: 12,
  },
  /* ─── Tomorrow Card ──────────────────────────────────────── */
  tomorrowCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  tomorrowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tomorrowTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  tomorrowText: {
    fontSize: 13,
    lineHeight: 20,
  },
  tomorrowMeta: {
    fontSize: 11,
  },
  /* ─── Plan Section ───────────────────────────────────────── */
  planSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  planList: {
    gap: 8,
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  planDayBadge: {
    backgroundColor: "#1A1826",
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  planDayBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 11,
  },
  planCardContent: {
    flex: 1,
    gap: 2,
  },
  planCardTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  planCardMeta: {
    fontSize: 11,
  },
  planConfidence: {
    fontSize: 12,
    fontWeight: "600",
  },
  /* ─── Trip Card ──────────────────────────────────────────── */
  tripCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 14,
    backgroundColor: "#FFFFFF",
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tripDates: {
    marginTop: 2,
    fontSize: 12,
  },
  packList: {
    gap: 8,
  },
  packRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  packCopy: {
    flex: 1,
    gap: 2,
  },
  packName: {
    fontSize: 14,
    fontWeight: "600",
  },
  packMeta: {
    fontSize: 12,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 6,
  },
});
const [userId, setUserId] = useState<string | null>(null);
