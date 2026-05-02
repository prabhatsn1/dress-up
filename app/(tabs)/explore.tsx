import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AppCard,
  Chip,
  ColorSwatch,
  MetricCard,
  SectionTitle,
} from "@/components/wardrobe-ui";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  filterWardrobe,
  getWardrobeStats,
  computeItemCpw,
  type Category,
} from "@/lib/wardrobe";
import { useAppData } from "@/providers/app-data-provider";

export { RouteErrorBoundary as ErrorBoundary } from "@/components/error-boundary";

const categories: (Category | "All")[] = [
  "All",
  "Top",
  "Bottom",
  "Outerwear",
  "Shoes",
  "Accessory",
];

export default function ClosetScreen() {
  const [category, setCategory] = useState<Category | "All">("All");
  const [query, setQuery] = useState("blue formal shirt");
  const {
    items,
    isUploading,
    analyzingItemId,
    isWardrobeLoading,
    wardrobeSource,
    supabaseConfigured,
    lastSyncMessage,
    addItemFromCamera,
    addItemFromLibrary,
    analyzeItemWithAi,
  } = useAppData();

  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const cool = useThemeColor({}, "accentCool");
  const stats = getWardrobeStats(items);
  const filteredItems = filterWardrobe(items, category, query);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: background }]}
      contentContainerStyle={styles.content}
    >
      <SectionTitle
        eyebrow="Smart Closet"
        title="Digitised wardrobe"
        detail="Camera upload, AI background removal, and auto-tagged metadata designed for low effort."
      />

      <AppCard accent={warm}>
        <Text style={[styles.label, { color: muted }]}>
          Natural-language search
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Try blue formal shirt"
          placeholderTextColor={muted}
          style={[
            styles.searchInput,
            {
              color: text,
              borderColor: border,
            },
          ]}
        />
        <View style={styles.chipRow}>
          {categories.map((value) => (
            <Chip
              key={value}
              label={value}
              active={value === category}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>
        <View style={styles.uploadActionRow}>
          <Pressable
            style={[styles.uploadButton, { backgroundColor: warm }]}
            onPress={() => void addItemFromCamera()}
          >
            <MaterialIcons name="photo-camera" size={18} color="#fff8f0" />
            <Text style={styles.uploadButtonText}>Camera upload</Text>
          </Pressable>
          <Pressable
            style={[styles.uploadButton, { backgroundColor: cool }]}
            onPress={() => void addItemFromLibrary()}
          >
            <MaterialIcons name="collections" size={18} color="#fff8f0" />
            <Text style={styles.uploadButtonText}>Gallery upload</Text>
          </Pressable>
        </View>
        <Text style={[styles.helperText, { color: muted }]}>
          {isUploading
            ? "Uploading item and syncing metadata..."
            : supabaseConfigured
              ? `Cloud sync ready. Current source: ${wardrobeSource}.`
              : "Supabase env keys are missing, so uploads save in local-only mode."}
        </Text>
        <Text style={[styles.helperText, { color: muted }]}>
          {supabaseConfigured
            ? "AI analysis uses a Supabase Edge Function with Hugging Face plus OpenAI."
            : "Add Supabase env keys before AI tagging can run server-side."}
        </Text>
        {lastSyncMessage ? (
          <Text style={[styles.helperText, { color: muted }]}>
            {lastSyncMessage}
          </Text>
        ) : null}
      </AppCard>

      <View style={styles.metricRow}>
        <MetricCard label="Total items" value={`${stats.total}`} tone={warm} />
        <MetricCard
          label="Favorites"
          value={`${stats.favorites}`}
          tone={cool}
        />
        <MetricCard
          label="Underused"
          value={`${stats.underused}`}
          tone="#2f7a58"
        />
      </View>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: text }]}>
          Upload workflow
        </Text>
        <View style={styles.uploadSteps}>
          {[
            "Snap or import front and side images",
            "Remove background and crop automatically",
            "Tag category, fit, sleeve, colours, and pattern",
            "Save with minimal manual correction",
          ].map((step, index) => (
            <View key={step} style={styles.uploadRow}>
              <View
                style={[
                  styles.uploadIndex,
                  { backgroundColor: index % 2 === 0 ? warm : cool },
                ]}
              >
                <Text style={styles.uploadIndexText}>{index + 1}</Text>
              </View>
              <Text style={[styles.uploadText, { color: muted }]}>{step}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      <View style={styles.itemsColumn}>
        {isWardrobeLoading ? (
          <Text style={[styles.helperText, { color: muted }]}>
            Loading wardrobe...
          </Text>
        ) : null}
        {filteredItems.map((item) => (
          <AppCard key={item.id}>
            <View style={styles.itemHeader}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.itemImage}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.imageFallback,
                    { backgroundColor: `${cool}1A` },
                  ]}
                >
                  <MaterialIcons name="checkroom" size={24} color={cool} />
                </View>
              )}
              <View style={styles.itemHeading}>
                <Text style={[styles.itemName, { color: text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.itemMeta, { color: muted }]}>
                  {item.category} · {item.subcategory} · worn {item.wearCount}×
                  {computeItemCpw(item) !== undefined
                    ? ` · $${computeItemCpw(item)!.toFixed(2)}/wear`
                    : ""}
                </Text>
                <Text style={[styles.itemSource, { color: muted }]}>
                  Source: {item.source ?? "seed"}{" "}
                  {item.imageStoragePath ? "· synced to Supabase" : ""}
                </Text>
              </View>
              <View style={styles.colourRow}>
                {item.colours.map((colour) => (
                  <ColorSwatch key={`${item.id}-${colour}`} colour={colour} />
                ))}
              </View>
            </View>

            <View style={styles.tagRow}>
              {[item.fit, item.pattern, ...item.occasions.slice(0, 2)].map(
                (tag) => (
                  <View
                    key={`${item.id}-${tag}`}
                    style={[styles.tag, { borderColor: border }]}
                  >
                    <Text style={[styles.tagText, { color: muted }]}>
                      {tag}
                    </Text>
                  </View>
                ),
              )}
            </View>

            <View style={styles.aiRow}>
              <View style={styles.aiCopy}>
                <Text style={[styles.aiTitle, { color: text }]}>
                  {item.aiSummary ? "AI summary ready" : "Need sharper tags?"}
                </Text>
                <Text style={[styles.aiBody, { color: muted }]}>
                  {item.aiSummary ??
                    "Run Hugging Face + OpenAI tagging to refine category, fit, colour, and occasion metadata."}
                </Text>
              </View>
              <Pressable
                style={[styles.aiButton, { backgroundColor: warm }]}
                onPress={() => void analyzeItemWithAi(item.id)}
              >
                <Text style={styles.aiButtonText}>
                  {analyzingItemId === item.id
                    ? "Analyzing..."
                    : item.aiStatus === "completed"
                      ? "Re-run AI"
                      : "AI tag"}
                </Text>
              </Pressable>
            </View>

            {item.aiTags?.styleNotes?.length ? (
              <View style={styles.tagRow}>
                {item.aiTags.styleNotes.map((note) => (
                  <View
                    key={`${item.id}-${note}`}
                    style={[styles.aiTag, { backgroundColor: `${cool}14` }]}
                  >
                    <Text style={[styles.aiTagText, { color: cool }]}>
                      {note}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {item.aiTags?.segmentationLabels?.length ? (
              <Text style={[styles.segmentationText, { color: muted }]}>
                HF segments: {item.aiTags.segmentationLabels.join(", ")}
              </Text>
            ) : null}

            <View style={styles.itemFooter}>
              <View style={styles.footerStat}>
                <MaterialIcons name="schedule" size={16} color={cool} />
                <Text style={[styles.footerText, { color: muted }]}>
                  Last worn {item.lastWornDaysAgo} days ago
                </Text>
              </View>
              <View style={styles.footerStat}>
                <MaterialIcons name="stars" size={16} color={warm} />
                <Text style={[styles.footerText, { color: muted }]}>
                  {item.favorite ? "Favorite piece" : "Rarely surfaced"}
                </Text>
              </View>
            </View>
          </AppCard>
        ))}
      </View>
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
  label: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  uploadActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  uploadButton: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  uploadButtonText: {
    color: "#fff8f0",
    fontSize: 13,
    fontWeight: "700",
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  uploadSteps: {
    gap: 12,
  },
  uploadRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  uploadIndex: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIndexText: {
    color: "#fff8f0",
    fontWeight: "700",
  },
  uploadText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  itemsColumn: {
    gap: 12,
  },
  itemHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  itemImage: {
    width: 74,
    height: 74,
    borderRadius: 18,
  },
  imageFallback: {
    width: 74,
    height: 74,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  itemHeading: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 17,
    fontWeight: "700",
  },
  itemMeta: {
    fontSize: 13,
  },
  itemSource: {
    fontSize: 12,
  },
  colourRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  itemFooter: {
    gap: 8,
  },
  aiRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  aiCopy: {
    flex: 1,
    gap: 4,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  aiBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  aiButton: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  aiButtonText: {
    color: "#fff8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  aiTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  aiTagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  segmentationText: {
    fontSize: 12,
    lineHeight: 18,
  },
  footerStat: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
