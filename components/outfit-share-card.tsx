/**
 * outfit-share-card.tsx
 *
 * A self-contained, off-screen React Native view that renders a branded
 * outfit card suitable for capture as a 1080×1350 (4:5) image.
 *
 * Layout rules
 * ─────────────
 *  ┌──────────────────────────────────────────┐  ← warm gradient header
 *  │  outfit name              confidence %   │
 *  │  occasion · date · weather               │
 *  ├──────────────────────────────────────────┤
 *  │                                          │
 *  │  ITEM GRID (2-col with photos,           │
 *  │             1-col text-only rows)        │
 *  │                                          │
 *  ├──────────────────────────────────────────┤
 *  │  🌤 18°C · Casual · May 1, 2026  DressUp │  ← footer strip
 *  └──────────────────────────────────────────┘
 *
 * Items with imageUrl fill photo tiles; items without fall back to a
 * colour-swatch + category label row so the card is never empty.
 *
 * The component is rendered at LOGICAL_WIDTH × LOGICAL_HEIGHT inside a
 * position:absolute off-screen container so it never flashes on screen.
 * react-native-view-shot captures it via a forwarded ref.
 */

import { forwardRef } from "react";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import type {
  OutfitSuggestion,
  WeatherSnapshot,
  OccasionType,
} from "@/lib/wardrobe";

// ─── Dimensions (logical pixels — ViewShot scales to device DPR) ─────────────
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 450;

const GRID_PHOTO_SIZE = 150;

// ─── Palette (hardcoded warm brand colours — card is always light) ────────────
const BRAND = {
  bg: "#f6f0e8",
  surface: "#fffaf4",
  header: "#8b5e3c",
  headerText: "#fff9f3",
  text: "#261b16",
  muted: "#6f6259",
  border: "#dfd2c6",
  tint: "#8b5e3c",
  warm: "#c7784f",
  cool: "#3f6f7f",
  success: "#2f7a58",
};

// ─── Colour map (mirrors wardrobe-ui.tsx) ────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  blue: "#5b82c8",
  white: "#efe8dc",
  beige: "#d8c09b",
  black: "#38312d",
  emerald: "#3d8967",
  grey: "#9da1aa",
  charcoal: "#63636f",
  cream: "#eee0c9",
  brown: "#8f6244",
  tan: "#cda078",
  gold: "#d6b15b",
  olive: "#6d7b4e",
};

// ─── Weather icon mapping ─────────────────────────────────────────────────────
const WEATHER_EMOJI: Record<string, string> = {
  Sunny: "☀️",
  Cloudy: "🌤",
  Rain: "🌧",
};

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface OutfitShareCardProps {
  outfit: OutfitSuggestion;
  weather: WeatherSnapshot;
  occasion: OccasionType;
  /** ISO date string — defaults to today */
  date?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const OutfitShareCard = forwardRef<View, OutfitShareCardProps>(
  function OutfitShareCard({ outfit, weather, occasion, date }, ref) {
    const photoItems = outfit.items.filter((i) => !!i.imageUrl);
    const textItems = outfit.items.filter((i) => !i.imageUrl);

    return (
      // Positioned absolutely off-screen so it can be captured without flashing
      <View style={styles.offScreen}>
        <View ref={ref} style={styles.card} collapsable={false}>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.outfitName} numberOfLines={2}>
                {outfit.name}
              </Text>
              <Text style={styles.headerMeta}>
                {occasion} · {formatDate(date)}
              </Text>
            </View>
            <View style={styles.confidencePill}>
              <Text style={styles.confidenceText}>{outfit.confidence}%</Text>
            </View>
          </View>

          {/* ── Item grid ──────────────────────────────────────────────────── */}
          <View style={styles.grid}>
            {/* Photo tiles — up to 4 in a 2-col grid */}
            {photoItems.slice(0, 4).map((item) => (
              <View key={item.id} style={styles.photoTile}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.photo}
                  contentFit="cover"
                />
                <View style={styles.photoLabel}>
                  <Text style={styles.photoLabelText} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              </View>
            ))}

            {/* Text-only rows for items without a photo */}
            {textItems.map((item) => (
              <View key={item.id} style={styles.textTile}>
                {/* Colour swatches */}
                <View style={styles.swatchRow}>
                  {item.colours.slice(0, 3).map((c) => (
                    <View
                      key={c}
                      style={[
                        styles.swatch,
                        { backgroundColor: COLOR_MAP[c] ?? "#b69d88" },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.textTileCopy}>
                  <Text style={styles.textTileName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.textTileMeta}>
                    {item.category} · {item.formality}
                  </Text>
                </View>
              </View>
            ))}

            {/* Accessory suggestion if present */}
            {outfit.accessorySuggestion ? (
              <View style={[styles.textTile, styles.accessoryTile]}>
                <Text style={styles.accessoryIcon}>✦</Text>
                <View style={styles.textTileCopy}>
                  <Text style={styles.textTileName} numberOfLines={1}>
                    + {outfit.accessorySuggestion.name}
                  </Text>
                  <Text style={styles.textTileMeta}>Accessory suggestion</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* ── Note strip ─────────────────────────────────────────────────── */}
          {outfit.note ? (
            <View style={styles.noteStrip}>
              <Text style={styles.noteText} numberOfLines={2}>
                {outfit.note}
              </Text>
            </View>
          ) : null}

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerWeather}>
              {WEATHER_EMOJI[weather.condition] ?? "🌤"} {weather.temperatureC}
              °C · {weather.condition}
            </Text>
            <Text style={styles.footerBrand}>DressUp</Text>
          </View>
        </View>
      </View>
    );
  },
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Push the card completely off-screen — captured by ViewShot, never seen
  offScreen: {
    position: "absolute",
    top: -9999,
    left: -9999,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },

  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: BRAND.bg,
    borderRadius: 0, // sharp corners look better on crop
    overflow: "hidden",
    flexDirection: "column",
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: BRAND.header,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  outfitName: {
    color: BRAND.headerText,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  headerMeta: {
    color: `${BRAND.headerText}CC`,
    fontSize: 12,
  },
  confidencePill: {
    backgroundColor: `${BRAND.headerText}22`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  confidenceText: {
    color: BRAND.headerText,
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Grid ──────────────────────────────────────────────────────────────────
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 8,
    alignContent: "flex-start",
  },

  // Photo tile (square)
  photoTile: {
    width: GRID_PHOTO_SIZE,
    height: GRID_PHOTO_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: BRAND.border,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(38,27,22,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoLabelText: {
    color: BRAND.headerText,
    fontSize: 11,
    fontWeight: "600",
  },

  // Text-only tile (full width)
  textTile: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: BRAND.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  accessoryTile: {
    borderStyle: "dashed",
    borderColor: BRAND.cool,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 4,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  textTileCopy: {
    flex: 1,
    gap: 2,
  },
  textTileName: {
    fontSize: 13,
    fontWeight: "600",
    color: BRAND.text,
  },
  textTileMeta: {
    fontSize: 11,
    color: BRAND.muted,
  },
  accessoryIcon: {
    fontSize: 14,
    color: BRAND.cool,
  },

  // ── Note strip ────────────────────────────────────────────────────────────
  noteStrip: {
    backgroundColor: `${BRAND.warm}1A`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: `${BRAND.warm}33`,
  },
  noteText: {
    fontSize: 12,
    color: BRAND.muted,
    fontStyle: "italic",
    lineHeight: 16,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: BRAND.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  footerWeather: {
    fontSize: 12,
    color: BRAND.muted,
  },
  footerBrand: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND.tint,
    letterSpacing: 0.5,
  },
});
