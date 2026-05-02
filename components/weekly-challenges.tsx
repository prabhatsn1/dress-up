/**
 * weekly-challenges.tsx
 *
 * Displays this week's 3 challenges with progress bars and completion states.
 */

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { WeeklyChallengeRow } from "@/lib/local-db";

interface WeeklyChallengesProps {
  challenges: WeeklyChallengeRow[];
}

export function WeeklyChallenges({ challenges }: WeeklyChallengesProps) {
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const cool = useThemeColor({}, "accentCool");
  const success = useThemeColor({}, "success");

  if (challenges.length === 0) return null;

  return (
    <View style={styles.container}>
      {challenges.map((challenge) => {
        const ratio = Math.min(challenge.progress / challenge.target, 1);
        const done = challenge.completed;

        return (
          <View
            key={challenge.id}
            style={[
              styles.card,
              {
                backgroundColor: surface,
                borderColor: done ? success : border,
                borderWidth: done ? 1.5 : 1,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <MaterialIcons
                name={done ? "check-circle" : "flag"}
                size={18}
                color={done ? success : cool}
              />
              <Text
                style={[styles.title, { color: done ? success : text }]}
                numberOfLines={1}
              >
                {challenge.title}
              </Text>
              <Text style={[styles.xpBadge, { color: warm }]}>
                +{challenge.xpReward} XP
              </Text>
            </View>
            <Text style={[styles.description, { color: muted }]}>
              {challenge.description}
            </Text>
            <View style={styles.progressRow}>
              <View style={[styles.barTrack, { backgroundColor: border }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: done ? success : warm,
                      width: `${Math.round(ratio * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: muted }]}>
                {challenge.progress}/{challenge.target}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  card: {
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: Fonts.ios?.sans,
    fontWeight: "600",
    fontSize: 14,
  },
  xpBadge: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Fonts.ios?.sans,
  },
  description: {
    fontSize: 12,
    fontFamily: Fonts.ios?.sans,
    lineHeight: 16,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontFamily: Fonts.ios?.sans,
    width: 28,
    textAlign: "right",
  },
});
