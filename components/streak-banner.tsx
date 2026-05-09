/**
 * streak-banner.tsx
 *
 * Displays the current streak, XP, and level in a compact card.
 * Animated XP bar pulses when `newXp` prop changes.
 */

import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";
import { xpForNextLevel } from "@/lib/gamification";
import type { GamificationState } from "@/lib/local-db";

interface StreakBannerProps {
  state: GamificationState;
  /** Pass a non-zero value to trigger the XP gain animation. */
  newXp?: number;
}

export function StreakBanner({ state, newXp = 0 }: StreakBannerProps) {
  const background = useThemeColor({}, "surface");
  const muted = useThemeColor({}, "muted");
  const warm = useThemeColor({}, "accentWarm");

  const { level } = xpForNextLevel(state.xp);

  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (newXp <= 0) return;
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();
  }, [newXp, flashAnim]);

  const flashColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [background, warm],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: flashColor, borderColor: `${warm}33` },
      ]}
    >
      <Text style={styles.fireEmoji}>🔥</Text>
      <Text style={[styles.streakText, { color: warm }]}>
        {state.currentStreak}-day streak! Keep it up.
      </Text>
      <View style={styles.xpBadge}>
        {newXp > 0 ? (
          <Text style={[styles.xpBadgeText, { color: muted }]}>
            +{newXp} XP
          </Text>
        ) : (
          <Text style={[styles.xpBadgeText, { color: muted }]}>
            Lv {level} · {state.xp} XP
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  fireEmoji: {
    fontSize: 16,
  },
  streakText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  xpBadge: {
    marginLeft: "auto",
  },
  xpBadgeText: {
    fontSize: 11,
  },
});
