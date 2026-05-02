/**
 * badge-shelf.tsx
 *
 * Horizontal scrollable shelf of earned badges with locked-state fallback.
 */

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { BADGES } from "@/lib/gamification";

interface BadgeShelfProps {
  earnedBadgeIds: Set<string>;
  /** How many locked placeholders to show. Defaults to showing all. */
  maxVisible?: number;
}

export function BadgeShelf({ earnedBadgeIds, maxVisible }: BadgeShelfProps) {
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const surface = useThemeColor({}, "surface");

  const badges = maxVisible ? BADGES.slice(0, maxVisible) : BADGES;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {badges.map((badge) => {
        const earned = earnedBadgeIds.has(badge.id);
        return (
          <View
            key={badge.id}
            style={[
              styles.badge,
              {
                backgroundColor: surface,
                borderColor: earned ? warm : border,
                opacity: earned ? 1 : 0.4,
              },
            ]}
          >
            <MaterialIcons
              name={
                badge.icon as React.ComponentProps<typeof MaterialIcons>["name"]
              }
              size={22}
              color={earned ? warm : muted}
            />
            <Text
              style={[styles.badgeName, { color: earned ? text : muted }]}
              numberOfLines={2}
            >
              {badge.name}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
  },
  badge: {
    width: 72,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
    gap: 6,
  },
  badgeName: {
    fontSize: 10,
    fontFamily: Fonts.sans,
    textAlign: "center",
    lineHeight: 13,
  },
});
