import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  computeItemCpw,
  worstValueItems,
  type WardrobeItem,
} from "@/lib/wardrobe";

interface WearStatsProps {
  items: WardrobeItem[];
  /** Optional currency symbol. Defaults to "$". */
  currencySymbol?: string;
}

export function WearStats({ items, currencySymbol = "$" }: WearStatsProps) {
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

  // Items with a real purchase price — for CPW summary stat
  const pricedItems = items.filter(
    (i) => i.purchasePrice != null && i.purchasePrice > 0,
  );
  const totalInvested = pricedItems.reduce(
    (sum, i) => sum + (i.purchasePrice ?? 0),
    0,
  );
  const avgCpw =
    pricedItems.length > 0
      ? pricedItems.reduce((sum, i) => sum + (computeItemCpw(i) ?? 0), 0) /
        pricedItems.length
      : undefined;

  // Worst value: top 5 highest CPW items (real prices only)
  const worst = worstValueItems(items, 5);

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
            gathering dust
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

      {/* Investment summary — only shown when at least one item has a price */}
      {pricedItems.length > 0 ? (
        <View style={styles.metricsRow}>
          <View
            style={[
              styles.metricBox,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.metricValue, { color: palette.tint }]}>
              {currencySymbol}
              {totalInvested.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </Text>
            <Text style={[styles.metricLabel, { color: palette.muted }]}>
              total invested
            </Text>
          </View>
          {avgCpw !== undefined ? (
            <View
              style={[
                styles.metricBox,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={[styles.metricValue, { color: palette.tint }]}>
                {currencySymbol}
                {avgCpw.toFixed(2)}
              </Text>
              <Text style={[styles.metricLabel, { color: palette.muted }]}>
                avg cost / wear
              </Text>
            </View>
          ) : null}
          <View
            style={[
              styles.metricBox,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.metricValue, { color: palette.muted }]}>
              {pricedItems.length}/{items.length}
            </Text>
            <Text style={[styles.metricLabel, { color: palette.muted }]}>
              items priced
            </Text>
          </View>
        </View>
      ) : null}

      {/* Worst value items */}
      {worst.length > 0 ? (
        <View style={styles.cpwBlock}>
          <View style={styles.cpwHeader}>
            <Text style={[styles.blockLabel, { color: palette.text }]}>
              Worst value items
            </Text>
            <Text style={[styles.cpwSubtitle, { color: palette.muted }]}>
              cost per wear ↓ wear more to improve
            </Text>
          </View>
          {worst.map(({ item, cpw }) => {
            const wears = item.wearCount ?? 0;
            // Break-even target: what wear count halves the current CPW?
            const breakEven =
              item.purchasePrice != null
                ? Math.ceil(item.purchasePrice / (cpw * 0.5))
                : null;
            return (
              <View
                key={item.id}
                style={[styles.cpwRow, { borderColor: palette.border }]}
              >
                <View style={styles.cpwLeft}>
                  <Text
                    style={[styles.cpwName, { color: palette.text }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.cpwMeta, { color: palette.muted }]}>
                    {wears} wear{wears !== 1 ? "s" : ""}
                    {item.purchasePrice != null
                      ? ` · paid ${currencySymbol}${item.purchasePrice}`
                      : ""}
                    {breakEven != null && wears < breakEven
                      ? ` · halves at ${breakEven}×`
                      : ""}
                  </Text>
                </View>
                <Text style={[styles.cpwValue, { color: palette.accentWarm }]}>
                  {currencySymbol}
                  {cpw.toFixed(2)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.cpwBlock}>
          <Text style={[styles.blockLabel, { color: palette.text }]}>
            Cost per wear
          </Text>
          <Text style={[styles.footnote, { color: palette.muted }]}>
            Add a purchase price to any item to see real cost-per-wear insights.
          </Text>
        </View>
      )}
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
  cpwHeader: {
    gap: 2,
  },
  cpwSubtitle: {
    fontSize: 12,
  },
  cpwRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  cpwLeft: {
    flex: 1,
    gap: 2,
  },
  cpwName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  cpwMeta: {
    fontSize: 11,
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
