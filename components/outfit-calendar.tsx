/**
 * OutfitCalendar
 *
 * A monthly calendar that shows which days have logged outfits and lets
 * the user tap a day to see its outfit details.
 *
 * Behaviour:
 *  - Renders a 7-column grid for the selected month.
 *  - Days with at least one outfit log show a filled dot below the number.
 *  - Days with more than one log show a stacked-dot indicator.
 *  - Tapping a logged day slides open an inline panel listing item names
 *    (with thumbnail if imageUrl is available).
 *  - Tapping a day twice (or tapping the open day again) collapses the panel.
 *  - Forward/back chevrons navigate months; future months are disabled.
 *  - Today is highlighted with the theme tint colour.
 */

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Fonts } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getLogsForMonth, type OutfitLog } from "@/lib/outfit-log";
import type { WardrobeItem } from "@/lib/wardrobe";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface Props {
  userId: string;
  /** All wardrobe items, used to resolve item names and thumbnails */
  items: WardrobeItem[];
}

export function OutfitCalendar({ userId, items }: Props) {
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
  const [logMap, setLogMap] = useState<Record<string, OutfitLog[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Theme colours
  const surface = useThemeColor({}, "surface");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const tint = useThemeColor({}, "tint");
  const success = useThemeColor({}, "success");
  const accentWarm = useThemeColor({}, "accentWarm");

  const itemMap = useMemo(() => {
    const map: Record<string, WardrobeItem> = {};
    for (const item of items) map[item.id] = item;
    return map;
  }, [items]);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      setLoading(true);
      try {
        const data = await getLogsForMonth(userId, y, m);
        setLogMap(data);
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadMonth(year, month);
    setSelectedDate(null);
  }, [year, month, loadMonth]);

  // ─── Navigation ────────────────────────────────────────────────────────────

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    const isCurrentMonth =
      year === today.getFullYear() && month === today.getMonth() + 1;
    if (isCurrentMonth) return; // no future months
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;

  // ─── Calendar grid computation ─────────────────────────────────────────────

  const { daysInMonth, firstDayOfWeek } = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return {
      daysInMonth: new Date(year, month, 0).getDate(),
      firstDayOfWeek: d.getDay(), // 0=Sunday
    };
  }, [year, month]);

  const todayStr = today.toISOString().slice(0, 10);

  const cells: { date: string | null; day: number | null }[] = useMemo(() => {
    const result: { date: string | null; day: number | null }[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      result.push({ date: null, day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      result.push({ date: `${year}-${mm}-${dd}`, day: d });
    }
    // pad to complete last row
    while (result.length % 7 !== 0) {
      result.push({ date: null, day: null });
    }
    return result;
  }, [year, month, daysInMonth, firstDayOfWeek]);

  // ─── Selected day panel ────────────────────────────────────────────────────

  const selectedLogs = selectedDate ? (logMap[selectedDate] ?? []) : [];

  function handleDayPress(date: string | null) {
    if (!date) return;
    const hasLogs = !!(logMap[date] && logMap[date].length > 0);
    if (!hasLogs) return;
    setSelectedDate((prev) => (prev === date ? null : date));
  }

  // ─── Month label ───────────────────────────────────────────────────────────

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: surface, borderColor: border },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={prevMonth} style={styles.navBtn} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={22} color={muted} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: text }]}>{monthLabel}</Text>
        <Pressable
          onPress={nextMonth}
          style={[styles.navBtn, isCurrentMonth && styles.navBtnDisabled]}
          hitSlop={8}
          disabled={isCurrentMonth}
        >
          <MaterialIcons
            name="chevron-right"
            size={22}
            color={isCurrentMonth ? border : muted}
          />
        </Pressable>
      </View>

      {/* Day-of-week labels */}
      <View style={styles.dayLabelsRow}>
        {DAY_LABELS.map((l) => (
          <Text key={l} style={[styles.dayLabel, { color: muted }]}>
            {l}
          </Text>
        ))}
      </View>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={tint} />
        </View>
      )}

      {/* Calendar grid */}
      {!loading && (
        <View style={styles.grid}>
          {cells.map((cell, idx) => {
            if (!cell.date) {
              return <View key={`empty-${idx}`} style={styles.cell} />;
            }
            const logs = logMap[cell.date] ?? [];
            const hasLog = logs.length > 0;
            const isToday = cell.date === todayStr;
            const isSelected = cell.date === selectedDate;

            return (
              <Pressable
                key={cell.date}
                style={[
                  styles.cell,
                  isToday && { backgroundColor: tint + "22" },
                  isSelected && {
                    backgroundColor: tint + "44",
                    borderRadius: 8,
                  },
                ]}
                onPress={() => handleDayPress(cell.date)}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    { color: isToday ? tint : text },
                    isToday && styles.dayNumberToday,
                  ]}
                >
                  {cell.day}
                </Text>
                {/* Dot indicator */}
                {hasLog && (
                  <View style={styles.dotsRow}>
                    <View style={[styles.dot, { backgroundColor: success }]} />
                    {logs.length > 1 && (
                      <View
                        style={[styles.dot, { backgroundColor: accentWarm }]}
                      />
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Detail panel */}
      {selectedDate && selectedLogs.length > 0 && (
        <View style={[styles.detailPanel, { borderTopColor: border }]}>
          <Text style={[styles.detailDate, { color: muted }]}>
            {new Date(
              Number(selectedDate.slice(0, 4)),
              Number(selectedDate.slice(5, 7)) - 1,
              Number(selectedDate.slice(8, 10)),
            ).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
          {selectedLogs.map((log) => (
            <LogDetailRow
              key={log.id}
              log={log}
              itemMap={itemMap}
              textColor={text}
              mutedColor={muted}
              borderColor={border}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Log detail row ──────────────────────────────────────────────────────────

function LogDetailRow({
  log,
  itemMap,
  textColor,
  mutedColor,
  borderColor,
}: {
  log: OutfitLog;
  itemMap: Record<string, WardrobeItem>;
  textColor: string;
  mutedColor: string;
  borderColor: string;
}) {
  const resolvedItems = log.itemIds
    .map((id) => itemMap[id])
    .filter((i): i is WardrobeItem => !!i);

  return (
    <View style={[styles.logRow, { borderColor }]}>
      {/* Meta */}
      <View style={styles.logMeta}>
        {log.occasion ? (
          <Text style={[styles.logOccasion, { color: mutedColor }]}>
            {log.occasion}
            {log.temperatureC !== undefined ? ` · ${log.temperatureC}°C` : ""}
          </Text>
        ) : null}
      </View>

      {/* Thumbnail strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbStrip}
      >
        {resolvedItems.map((item) => (
          <View key={item.id} style={styles.thumbItem}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.thumbImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.thumbPlaceholder, { borderColor }]}>
                <MaterialIcons name="checkroom" size={20} color={mutedColor} />
              </View>
            )}
            <Text
              style={[styles.thumbName, { color: mutedColor }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </View>
        ))}

        {/* Fallback for items no longer in wardrobe */}
        {log.itemIds.length > resolvedItems.length && (
          <Text style={[styles.thumbName, { color: mutedColor }]}>
            +{log.itemIds.length - resolvedItems.length} removed
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CELL_SIZE = 44;

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBtn: {
    padding: 4,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  monthLabel: {
    fontSize: 15,
    fontFamily: Fonts.ios?.rounded ?? Fonts.default.rounded,
    fontWeight: "700",
  },
  dayLabelsRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  dayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  loadingRow: {
    height: CELL_SIZE * 5,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  cell: {
    width: `${100 / 7}%`,
    height: CELL_SIZE,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 6,
    borderRadius: 8,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: "500",
  },
  dayNumberToday: {
    fontWeight: "700",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  detailPanel: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  detailDate: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  logRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  logMeta: {
    flexDirection: "row",
    gap: 6,
  },
  logOccasion: {
    fontSize: 12,
    fontWeight: "500",
  },
  thumbStrip: {
    gap: 10,
    paddingVertical: 2,
  },
  thumbItem: {
    alignItems: "center",
    width: 60,
    gap: 4,
  },
  thumbImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbName: {
    fontSize: 10,
    textAlign: "center",
  },
});
