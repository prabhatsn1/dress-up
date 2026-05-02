/**
 * streak-banner.tsx
 *
 * Displays the current streak, XP, and level in a compact card.
 * Animated XP bar pulses when `newXp` prop changes.
 */

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
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
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const warm = useThemeColor({}, "accentWarm");
  const border = useThemeColor({}, "border");
  const success = useThemeColor({}, "success");

  const { threshold, nextThreshold, level } = xpForNextLevel(state.xp);
  const progressRatio = Math.min(
    (state.xp - threshold) / (nextThreshold - threshold),
    1,
  );

  const barAnim = useRef(new Animated.Value(progressRatio)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: progressRatio,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [progressRatio, barAnim]);

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

  const streakLabel =
    state.currentStreak === 0
      ? "No streak yet"
      : state.currentStreak === 1
        ? "1 day streak"
        : `${state.currentStreak} day streak`;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: flashColor, borderColor: border },
      ]}
    >
      {/* Streak fire */}
      <View style={styles.streakBlock}>
        <MaterialIcons name="local-fire-department" size={28} color={warm} />
        <View>
          <Text style={[styles.streakCount, { color: warm }]}>
            {state.currentStreak}
          </Text>
          <Text style={[styles.streakLabel, { color: muted }]}>
            {streakLabel}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Level + XP */}
      <View style={styles.xpBlock}>
        <View style={styles.xpRow}>
          <Text style={[styles.levelText, { color: text }]}>Lv {level}</Text>
          {newXp > 0 && (
            <Text style={[styles.xpGainText, { color: success }]}>
              +{newXp} XP
            </Text>
          )}
          <Text style={[styles.xpText, { color: muted }]}>
            {state.xp} / {nextThreshold} XP
          </Text>
        </View>
        <View style={[styles.barTrack, { backgroundColor: border }]}>
          <Animated.View
            style={[
              styles.barFill,
              {
                backgroundColor: warm,
                width: barAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  streakBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakCount: {
    fontFamily: Fonts.ios?.rounded,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  streakLabel: {
    fontSize: 11,
    fontFamily: Fonts.ios?.sans,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  xpBlock: {
    flex: 1,
    gap: 6,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  levelText: {
    fontFamily: Fonts.ios?.rounded,
    fontSize: 15,
    fontWeight: "700",
  },
  xpGainText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Fonts.ios?.sans,
  },
  xpText: {
    fontSize: 11,
    fontFamily: Fonts.ios?.sans,
    marginLeft: "auto",
  },
  barTrack: {
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
});
