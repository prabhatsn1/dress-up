import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { WardrobeItem } from "@/lib/wardrobe";

const CATEGORY_COST: Record<string, number> = {
  Top: 40,
  Bottom: 60,
  Outerwear: 120,
  Shoes: 90,
  Accessory: 30,
};

interface WearStatsProps {
  items: WardrobeItem[];
}

export function WearStats({ items }: WearStatsProps) {
  const scheme = useColorScheme() ?? "light";
  const palette = Colors[scheme];

  if (items.length === 0) return null;

  // Total wears
  const totalWears = items.reduce((sum, i) => sum + (i.wearCount ?? 0), 0);

  // Most worn
  const mostWorn = [...items].sort(
    (a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0),
  )[0];

  // Least worn / gathering dust
  const dustCount = items.filter(
    (i) => (i.wearCount ?? 0) === 0 || (i.lastWornDaysAgo ?? 99) > 60,
  ).length;

  // Wardrobe utilisation
  const wornAtLeastOnce = items.filter((i) => (i.wearCount ?? 0) > 0).length;
  const utilisationPct = Math.round((wornAtLeastOnce / items.length) * 100);

  // Cost per wear — top 3 most expensive per wear
  const withCpw = items
    .filter((i) => CATEGORY_COST[i.category] !== undefined)
    .map((i) => ({
      name: i.name,
      cpw: CATEGORY_COST[i.category] / Math.max(i.wearCount ?? 1, 1),
    }))
    .sort((a, b) => b.cpw - a.cpw)
    .slice(0, 3);

  return (
    <View style={styles.root}>
      {/* Total wears + most worn row */}
      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricBox,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.metricValue, { color: palette.tint }]}>
            {totalWears}
          </Text>
          <Text style={[styles.metricLabel, { color: palette.muted }]}>
            Total wears
          </Text>
        </View>
        <View
          style={[
            styles.metricBox,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text
            style={[styles.metricValue, { color: palette.tint }]}
            numberOfLines={1}
          >
            {mostWorn.wearCount ?? 0}×
          </Text>
          <Text
            style={[styles.metricLabel, { color: palette.muted }]}
            numberOfLines={1}
          >
            {mostWorn.name}
          </Text>
        </View>
        <View
          style={[
            styles.metricBox,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.metricValue, { color: palette.accentWarm }]}>
            {dustCount}
          </Text>
          <Text style={[styles.metricLabel, { color: palette.muted }]}>
            items gathering dust
          </Text>
        </View>
      </View>

      {/* Wardrobe utilisation */}
      <View style={styles.utilisationBlock}>
        <View style={styles.utilisationHeader}>
          <Text style={[styles.blockLabel, { color: palette.text }]}>
            Wardrobe utilisation
          </Text>
          <Text style={[styles.utilisationPct, { color: palette.tint }]}>
            {utilisationPct}%
          </Text>
        </View>
        <View
          style={[styles.progressTrack, { backgroundColor: palette.border }]}
        >
          <View
            style={[
              styles.progressFill,
              { backgroundColor: palette.tint, width: `${utilisationPct}%` },
            ]}
          />
        </View>
      </View>

      {/* Cost per wear */}
      {withCpw.length > 0 ? (
        <View style={styles.cpwBlock}>
          <Text style={[styles.blockLabel, { color: palette.text }]}>
            Highest cost per wear
          </Text>
          {withCpw.map((entry) => (
            <View
              key={entry.name}
              style={[styles.cpwRow, { borderColor: palette.border }]}
            >
              <Text
                style={[styles.cpwName, { color: palette.text }]}
                numberOfLines={1}
              >
                {entry.name}
              </Text>
              <Text style={[styles.cpwValue, { color: palette.accentWarm }]}>
                ${entry.cpw.toFixed(2)}
              </Text>
            </View>
          ))}
          <Text style={[styles.footnote, { color: palette.muted }]}>
            * Based on estimated category averages
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 4,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 26,
  },
  metricLabel: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 14,
  },
  utilisationBlock: {
    gap: 8,
  },
  utilisationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  blockLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  utilisationPct: {
    fontSize: 15,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
  cpwBlock: {
    gap: 8,
  },
  cpwRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  cpwName: {
    flex: 1,
    fontSize: 14,
  },
  cpwValue: {
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 8,
  },
  footnote: {
    fontSize: 11,
    fontStyle: "italic",
  },
});
