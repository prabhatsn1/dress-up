/**
 * RatingSheet
 *
 * A bottom-anchored modal sheet shown immediately after the user taps
 * "I wore this today".  Lets them rate the outfit 1–5 stars and optionally
 * add a short note.
 *
 * UX flow:
 *   1. Modal slides up from the bottom of the screen.
 *   2. Outfit name + item thumbnail strip is shown for context.
 *   3. User taps a star (1–5).  The selected star lights up.
 *   4. Optional one-line note input appears below the stars.
 *   5. "Save rating" → calls onRate(star, note).
 *   6. "Skip" → calls onDismiss() without rating.
 *
 * Accessibility: each star has an accessibilityLabel and accessibilityRole.
 */

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Fonts } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { WardrobeItem } from "@/lib/wardrobe";

const STAR_LABELS: Record<number, string> = {
  1: "Hate it",
  2: "Not great",
  3: "It's fine",
  4: "Love it",
  5: "Perfect",
};

interface Props {
  visible: boolean;
  /** Resolved wardrobe items that make up the outfit */
  outfitItems: WardrobeItem[];
  /** Called when the user confirms a rating */
  onRate: (rating: number, note?: string) => void;
  /** Called when the user dismisses without rating */
  onDismiss: () => void;
}

export function RatingSheet({
  visible,
  outfitItems,
  onRate,
  onDismiss,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const background = useThemeColor({}, "background");
  const surface = useThemeColor({}, "surface");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const tint = useThemeColor({}, "tint");
  const warm = useThemeColor({}, "accentWarm");
  const success = useThemeColor({}, "success");

  function handleRate() {
    if (selected === null) return;
    Keyboard.dismiss();
    onRate(selected, note.trim() || undefined);
    setSelected(null);
    setNote("");
  }

  function handleDismiss() {
    Keyboard.dismiss();
    setSelected(null);
    setNote("");
    onDismiss();
  }

  const starColor = (star: number) => {
    if (selected === null) return border;
    if (star <= selected) {
      // Gradient feel: lower stars warm, higher stars gold
      return selected >= 4 ? "#f5c518" : selected === 3 ? warm : "#9b4141";
    }
    return border;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleDismiss}>
        {/* Swallow touches inside the sheet so tapping it doesn't close */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kvContainer}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: surface, borderColor: border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: border }]} />

            {/* Header */}
            <Text style={[styles.heading, { color: text }]}>
              How did you feel in this outfit?
            </Text>

            {/* Outfit item thumbnails */}
            {outfitItems.length > 0 && (
              <View style={styles.thumbRow}>
                {outfitItems.slice(0, 5).map((item) =>
                  item.imageUrl ? (
                    <Image
                      key={item.id}
                      source={{ uri: item.imageUrl }}
                      style={styles.thumb}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      key={item.id}
                      style={[styles.thumbPlaceholder, { borderColor: border }]}
                    >
                      <MaterialIcons name="checkroom" size={18} color={muted} />
                    </View>
                  ),
                )}
              </View>
            )}

            {/* Star row */}
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelected(star)}
                  style={styles.starBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${star} star${star === 1 ? "" : "s"}: ${STAR_LABELS[star]}`}
                  accessibilityState={{ selected: selected === star }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={
                      selected !== null && star <= selected
                        ? "star"
                        : "star-border"
                    }
                    size={36}
                    color={starColor(star)}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Label below stars */}
            {selected !== null && (
              <Text style={[styles.starLabel, { color: tint }]}>
                {STAR_LABELS[selected]}
              </Text>
            )}

            {/* Note input */}
            <TextInput
              style={[
                styles.noteInput,
                {
                  color: text,
                  borderColor: selected !== null ? tint : border,
                  backgroundColor: background,
                },
              ]}
              placeholder="Add a note (optional)"
              placeholderTextColor={muted}
              value={note}
              onChangeText={setNote}
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={handleRate}
            />

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleDismiss}
                style={[styles.skipBtn, { borderColor: border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.skipText, { color: muted }]}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRate}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: selected !== null ? success : border,
                    opacity: selected !== null ? 1 : 0.5,
                  },
                ]}
                disabled={selected === null}
                activeOpacity={0.75}
              >
                <Text style={styles.saveBtnText}>Save rating</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  kvContainer: {
    width: "100%",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    alignItems: "center",
    gap: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  heading: {
    fontSize: 17,
    fontFamily: Fonts.rounded,
    fontWeight: "700",
    textAlign: "center",
  },
  thumbRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  thumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  starRow: {
    flexDirection: "row",
    gap: 4,
  },
  starBtn: {
    padding: 6,
  },
  starLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: -8,
  },
  noteInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  skipBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 2,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
