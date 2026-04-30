import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppCard, ColorSwatch, SectionTitle } from "@/components/wardrobe-ui";
import { Fonts } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { buildPackingList, buildWeeklyPlan } from "@/lib/wardrobe";
import { useAppData } from "@/providers/app-data-provider";

export default function PlannerScreen() {
  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const cool = useThemeColor({}, "accentCool");
  const { items, weather, isWeatherLoading, profile } = useAppData();

  const weeklyPlan = buildWeeklyPlan(items, profile, weather);
  const packingList = buildPackingList(weeklyPlan);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: background }]}
      contentContainerStyle={styles.content}
    >
      <SectionTitle
        eyebrow="Outfit Calendar"
        title="Plan the week"
        detail="Use AI suggestions to avoid repeats, account for weather, and prep for travel."
      />

      <AppCard accent={cool}>
        <Text style={[styles.heroTitle, { color: text }]}>
          What should I wear tomorrow?
        </Text>
        <Text style={[styles.heroText, { color: muted }]}>
          Tuesday is optimized for{" "}
          {weeklyPlan[1].context.occasion.toLowerCase()} dressing at{" "}
          {weeklyPlan[1].context.weather.temperatureC}C with a different hero
          bottom than Monday.
        </Text>
        <Text style={[styles.liveMeta, { color: muted }]}>
          {isWeatherLoading
            ? "Checking tomorrow against live weather..."
            : `Weather baseline: ${weather.location}`}
        </Text>
      </AppCard>

      <View style={styles.planList}>
        {weeklyPlan.map((entry) => (
          <AppCard key={entry.day}>
            <View style={styles.planHeader}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>{entry.day}</Text>
              </View>
              <View style={styles.planHeading}>
                <Text style={[styles.planTitle, { color: text }]}>
                  {entry.context.occasion} · {entry.outfit.name}
                </Text>
                <Text style={[styles.planMeta, { color: muted }]}>
                  {entry.context.weather.dayPart} ·{" "}
                  {entry.context.weather.condition} ·{" "}
                  {entry.context.weather.temperatureC}C
                </Text>
              </View>
              <Text style={[styles.planConfidence, { color: muted }]}>
                {entry.outfit.confidence}%
              </Text>
            </View>

            <Text style={[styles.planItems, { color: muted }]}>
              {entry.outfit.items.map((item) => item.name).join(" · ")}
            </Text>
          </AppCard>
        ))}
      </View>

      <AppCard accent={warm}>
        <View style={styles.tripHeader}>
          <View>
            <Text style={[styles.heroTitle, { color: text }]}>Trip mode</Text>
            <Text style={[styles.tripDates, { color: muted }]}>
              May 2 to May 5 · Goa city break
            </Text>
          </View>
          <MaterialIcons name="luggage" size={26} color={warm} />
        </View>

        <Text style={[styles.heroText, { color: muted }]}>
          Packing list is auto-built from upcoming travel and weekend outfits,
          with duplicate pieces removed.
        </Text>

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
                  <ColorSwatch key={`${item.id}-${colour}`} colour={colour} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </AppCard>
    </ScrollView>
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
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: Fonts.serif,
    fontWeight: "700",
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
  },
  liveMeta: {
    fontSize: 12,
  },
  planList: {
    gap: 12,
  },
  planHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  dayBadge: {
    backgroundColor: "#8b5e3c",
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBadgeText: {
    color: "#fff9f3",
    fontWeight: "700",
  },
  planHeading: {
    flex: 1,
    gap: 3,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  planMeta: {
    fontSize: 13,
  },
  planConfidence: {
    fontSize: 13,
    fontWeight: "700",
  },
  planItems: {
    fontSize: 13,
    lineHeight: 19,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tripDates: {
    marginTop: 4,
    fontSize: 13,
  },
  packList: {
    gap: 10,
  },
  packRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  packCopy: {
    flex: 1,
    gap: 3,
  },
  packName: {
    fontSize: 15,
    fontWeight: "700",
  },
  packMeta: {
    fontSize: 13,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 6,
  },
});
