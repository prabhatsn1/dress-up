import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { MetricCard } from "@/components/wardrobe-ui";
import { useThemeColor } from "@/hooks/use-theme-color";
import { suggestPairingsForItem, type AiPairingSuggestion } from "@/lib/ai";
import {
  filterWardrobe,
  getWardrobeStats,
  type Category,
  type WardrobeItem,
} from "@/lib/wardrobe";
import { useAppData } from "@/providers/app-data-provider";
import LaundryScreen from "./laundry";
import CapsuleScreen from "./capsule";

export { RouteErrorBoundary as ErrorBoundary } from "@/components/error-boundary";

type ClosetTab = "items" | "capsule" | "laundry";

const categories: { id: Category | "All"; label: string; emoji: string }[] = [
  { id: "All", label: "All", emoji: "✦" },
  { id: "Top", label: "Tops", emoji: "👕" },
  { id: "Bottom", label: "Bottoms", emoji: "👖" },
  { id: "Outerwear", label: "Outerwear", emoji: "🧥" },
  { id: "Shoes", label: "Shoes", emoji: "👟" },
  { id: "Accessory", label: "Accessories", emoji: "💍" },
];

export default function ClosetScreen() {
  const [activeTab, setActiveTab] = useState<ClosetTab>("items");
  const [category, setCategory] = useState<Category | "All">("All");
  const [query, setQuery] = useState("blue formal shirt");
  const [styleWithItem, setStyleWithItem] = useState<WardrobeItem | null>(null);
  const [pairingSuggestion, setPairingSuggestion] =
    useState<AiPairingSuggestion | null>(null);
  const [isPairingSuggesting, setIsPairingSuggesting] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
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
    dirtyItems,
  } = useAppData();

  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const cool = useThemeColor({}, "accentCool");
  const tint = useThemeColor({}, "tint");
  const stats = getWardrobeStats(items);
  const filteredItems = filterWardrobe(items, category, query);

  const tabs: { id: ClosetTab; label: string; icon: string }[] = [
    { id: "items", label: "Items", icon: "checkroom" },
    { id: "capsule", label: "Capsule", icon: "style" },
    { id: "laundry", label: "Laundry", icon: "local-laundry-service" },
  ];

  async function handleStyleWithThis(item: WardrobeItem) {
    setStyleWithItem(item);
    setPairingSuggestion(null);
    setPairingError(null);
    setIsPairingSuggesting(true);
    try {
      const suggestion = await suggestPairingsForItem({
        anchorItem: item,
        allItems: items,
      });
      setPairingSuggestion(suggestion);
    } catch (err) {
      setPairingError(
        err instanceof Error ? err.message : "AI suggestion failed.",
      );
    } finally {
      setIsPairingSuggesting(false);
    }
  }

  function closePairingModal() {
    setStyleWithItem(null);
    setPairingSuggestion(null);
    setPairingError(null);
  }

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      {/* ─── Style With This Modal ─────────────────────────────── */}
      <Modal
        visible={styleWithItem !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePairingModal}
      >
        <View style={[styles.modalRoot, { backgroundColor: background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: border }]}>
            <Text style={[styles.modalTitle, { color: text }]}>
              Style With This
            </Text>
            <Pressable onPress={closePairingModal} style={styles.modalClose}>
              <MaterialIcons name="close" size={22} color={muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Anchor Item */}
            {styleWithItem && (
              <View style={[styles.anchorCard, { borderColor: border }]}>
                {styleWithItem.imageUrl ? (
                  <Image
                    source={{ uri: styleWithItem.imageUrl }}
                    style={styles.anchorImage}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.anchorImageFallback,
                      { backgroundColor: `${cool}1A` },
                    ]}
                  >
                    <MaterialIcons name="checkroom" size={36} color={cool} />
                  </View>
                )}
                <View style={styles.anchorInfo}>
                  <Text style={[styles.anchorName, { color: text }]}>
                    {styleWithItem.name}
                  </Text>
                  <Text style={[styles.anchorMeta, { color: muted }]}>
                    {styleWithItem.subcategory ?? styleWithItem.category}
                    {styleWithItem.colours.length > 0
                      ? ` · ${styleWithItem.colours.join(", ")}`
                      : ""}
                  </Text>
                </View>
              </View>
            )}

            {/* Loading */}
            {isPairingSuggesting && (
              <View style={styles.pairingLoader}>
                <ActivityIndicator size="large" color={warm} />
                <Text style={[styles.pairingLoaderText, { color: muted }]}>
                  AI is finding the best pairings…
                </Text>
              </View>
            )}

            {/* Error */}
            {pairingError && (
              <View
                style={[styles.pairingError, { backgroundColor: "#FFF0ED" }]}
              >
                <MaterialIcons name="error-outline" size={18} color="#C44B2B" />
                <Text style={[styles.pairingErrorText, { color: "#C44B2B" }]}>
                  {pairingError}
                </Text>
              </View>
            )}

            {/* Suggestion results */}
            {pairingSuggestion && (
              <View style={styles.suggestionSection}>
                <Text style={[styles.suggestionHeadline, { color: text }]}>
                  {pairingSuggestion.headline}
                </Text>
                <Text style={[styles.suggestionNote, { color: muted }]}>
                  {pairingSuggestion.stylistNote}
                </Text>

                {pairingSuggestion.pairings.map((pairing, idx) => {
                  const pairedItems = pairing.itemIds
                    .map((id) => items.find((i) => i.id === id))
                    .filter(Boolean) as WardrobeItem[];
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.pairingCard,
                        { borderColor: border, backgroundColor: `${tint}08` },
                      ]}
                    >
                      <View style={styles.pairingCardHeader}>
                        <MaterialIcons name="style" size={14} color={tint} />
                        <Text style={[styles.pairingOccasion, { color: tint }]}>
                          {pairing.occasion}
                        </Text>
                      </View>
                      <Text style={[styles.pairingReason, { color: text }]}>
                        {pairing.reason}
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.pairingItemsRow}
                      >
                        {pairedItems.map((pi) => (
                          <View key={pi.id} style={styles.pairingItemThumb}>
                            {pi.imageUrl ? (
                              <Image
                                source={{ uri: pi.imageUrl }}
                                style={styles.pairingThumbImage}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.pairingThumbFallback,
                                  { backgroundColor: `${cool}1A` },
                                ]}
                              >
                                <MaterialIcons
                                  name="checkroom"
                                  size={16}
                                  color={cool}
                                />
                              </View>
                            )}
                            <Text
                              style={[
                                styles.pairingThumbName,
                                { color: muted },
                              ]}
                              numberOfLines={1}
                            >
                              {pi.name}
                            </Text>
                          </View>
                        ))}
                        {pairing.itemIds.length > pairedItems.length && (
                          <View style={styles.pairingItemThumb}>
                            <View
                              style={[
                                styles.pairingThumbFallback,
                                { backgroundColor: `${muted}22` },
                              ]}
                            >
                              <Text style={{ color: muted, fontSize: 10 }}>
                                +{pairing.itemIds.length - pairedItems.length}
                              </Text>
                            </View>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  );
                })}

                {pairingSuggestion.missingPieceSuggestion && (
                  <View
                    style={[
                      styles.missingPiece,
                      { borderColor: warm, backgroundColor: `${warm}10` },
                    ]}
                  >
                    <MaterialIcons name="lightbulb" size={16} color={warm} />
                    <Text style={[styles.missingPieceText, { color: text }]}>
                      {pairingSuggestion.missingPieceSuggestion}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Inner Tab Bar ─────────────────────────────────────── */}
      <View style={[styles.innerTabBar, { borderBottomColor: border }]}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.innerTab,
                active && { borderBottomColor: tint, borderBottomWidth: 2 },
              ]}
            >
              <View style={styles.innerTabContent}>
                <MaterialIcons
                  name={tab.icon as any}
                  size={16}
                  color={active ? tint : muted}
                />
                <Text
                  style={[
                    styles.innerTabLabel,
                    { color: active ? tint : muted },
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.id === "laundry" && dirtyItems.length > 0 && (
                  <View style={[styles.innerBadge, { backgroundColor: tint }]}>
                    <Text style={styles.innerBadgeText}>
                      {dirtyItems.length}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ─── Tab Content ───────────────────────────────────────── */}
      {activeTab === "capsule" ? (
        <CapsuleScreen />
      ) : activeTab === "laundry" ? (
        <LaundryScreen />
      ) : (
        <ScrollView
          style={[styles.screen, { backgroundColor: background }]}
          contentContainerStyle={styles.content}
        >
          {/* ─── Figma Header ─────────────────────────────────────── */}
          <View style={styles.headerSection}>
            <View>
              <Text style={[styles.headerTitle, { color: text }]}>
                My Closet
              </Text>
              <Text style={[styles.headerSub, { color: muted }]}>
                {items.length} items ·{" "}
                {items.filter((i) => i.aiStatus === "completed").length}{" "}
                analysed
              </Text>
            </View>
            <Pressable
              style={[styles.searchIconBtn, { borderColor: border }]}
              onPress={() => setQuery(query ? "" : "blue formal shirt")}
            >
              <MaterialIcons name="search" size={16} color={muted} />
            </Pressable>
          </View>

          {/* ─── Search ───────────────────────────────────────────── */}
          <View style={[styles.searchBar, { borderColor: border }]}>
            <MaterialIcons name="search" size={16} color={muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search wardrobe…"
              placeholderTextColor={muted}
              style={[styles.searchInput, { color: text }]}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")}>
                <MaterialIcons name="close" size={14} color={muted} />
              </Pressable>
            ) : null}
          </View>

          {/* ─── Category Filter (Figma emoji pills) ─────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {categories.map(({ id, label, emoji }) => {
              const active = id === category;
              return (
                <Pressable
                  key={id}
                  onPress={() => setCategory(id)}
                  style={[
                    styles.categoryPill,
                    active
                      ? styles.categoryPillActive
                      : {
                          backgroundColor: "#FFFFFF",
                          borderColor: border,
                          borderWidth: 1,
                        },
                  ]}
                >
                  <Text style={styles.categoryEmoji}>{emoji}</Text>
                  <Text
                    style={[
                      styles.categoryLabel,
                      active ? styles.categoryLabelActive : { color: muted },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ─── Upload Actions ───────────────────────────────────── */}
          <View style={styles.uploadActionRow}>
            <Pressable
              style={[styles.uploadButton, { backgroundColor: warm }]}
              onPress={() => void addItemFromCamera()}
            >
              <MaterialIcons name="photo-camera" size={18} color="#fff" />
              <Text style={styles.uploadButtonText}>Camera</Text>
            </Pressable>
            <Pressable
              style={[styles.uploadButton, { backgroundColor: cool }]}
              onPress={() => void addItemFromLibrary()}
            >
              <MaterialIcons name="collections" size={18} color="#fff" />
              <Text style={styles.uploadButtonText}>Gallery</Text>
            </Pressable>
          </View>

          {isUploading ? (
            <Text style={[styles.helperText, { color: muted }]}>
              Uploading item and syncing metadata...
            </Text>
          ) : null}
          {lastSyncMessage ? (
            <Text style={[styles.helperText, { color: muted }]}>
              {lastSyncMessage}
            </Text>
          ) : null}

          {/* ─── Stats Row ────────────────────────────────────────── */}
          <View style={styles.metricRow}>
            <MetricCard
              label="Total items"
              value={`${stats.total}`}
              tone={warm}
            />
            <MetricCard
              label="Favorites"
              value={`${stats.favorites}`}
              tone={cool}
            />
            <MetricCard
              label="Underused"
              value={`${stats.underused}`}
              tone="#7B9E87"
            />
          </View>

          {/* ─── Items Grid (Figma 2-col style) ───────────────────── */}
          {isWardrobeLoading ? (
            <Text style={[styles.helperText, { color: muted }]}>
              Loading wardrobe...
            </Text>
          ) : filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👗</Text>
              <Text style={[styles.emptyText, { color: muted }]}>
                No items found. Try a different filter.
              </Text>
            </View>
          ) : (
            <View style={styles.itemGrid}>
              {filteredItems.map((item) => (
                <View
                  key={item.id}
                  style={[styles.gridCard, { borderColor: border }]}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.gridImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.gridImageFallback,
                        { backgroundColor: `${cool}1A` },
                      ]}
                    >
                      <MaterialIcons name="checkroom" size={28} color={cool} />
                    </View>
                  )}

                  {/* Wear count badge */}
                  <View style={styles.wearBadge}>
                    <Text style={styles.wearBadgeText}>
                      {item.wearCount}× worn
                    </Text>
                  </View>

                  {/* Dirty indicator */}
                  {item.lastWornDaysAgo !== undefined &&
                    item.lastWornDaysAgo < 2 && (
                      <View style={styles.dirtyIndicator}>
                        <MaterialIcons
                          name="water-drop"
                          size={10}
                          color="#fff"
                        />
                      </View>
                    )}

                  {/* Info section */}
                  <View style={styles.gridCardInfo}>
                    <Text
                      style={[styles.gridItemName, { color: text }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={[styles.gridItemMeta, { color: muted }]}>
                      {item.subcategory ?? item.category}
                    </Text>
                  </View>

                  {/* AI analyze action */}
                  <Pressable
                    style={[styles.gridAiBtn, { backgroundColor: `${warm}15` }]}
                    onPress={() => void analyzeItemWithAi(item.id)}
                  >
                    <MaterialIcons name="auto-awesome" size={12} color={warm} />
                    <Text style={[styles.gridAiBtnText, { color: warm }]}>
                      {analyzingItemId === item.id
                        ? "..."
                        : item.aiStatus === "completed"
                          ? "✓ AI"
                          : "AI tag"}
                    </Text>
                  </Pressable>

                  {/* Style with this action */}
                  <Pressable
                    style={[
                      styles.gridStyleBtn,
                      { backgroundColor: `${tint}15` },
                    ]}
                    onPress={() => void handleStyleWithThis(item)}
                  >
                    <MaterialIcons name="style" size={12} color={tint} />
                    <Text style={[styles.gridAiBtnText, { color: tint }]}>
                      Style with this
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Source info */}
          <Text style={[styles.helperText, { color: muted }]}>
            {supabaseConfigured
              ? `Cloud sync: ${wardrobeSource}`
              : "Local-only mode (no Supabase env keys)"}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  /* ─── Inner Tab Bar ──────────────────────────────────────── */
  innerTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingTop: 12,
  },
  innerTab: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  innerTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  innerTabLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  innerBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  innerBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 16,
  },
  /* ─── Header ─────────────────────────────────────────────── */
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  searchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  /* ─── Search ─────────────────────────────────────────────── */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
  /* ─── Category Filter ────────────────────────────────────── */
  categoryScroll: {
    gap: 8,
    paddingRight: 16,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  categoryPillActive: {
    backgroundColor: "#1A1826",
  },
  categoryEmoji: {
    fontSize: 13,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  categoryLabelActive: {
    color: "#FFFFFF",
  },
  /* ─── Upload Actions ─────────────────────────────────────── */
  uploadActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  uploadButton: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 12,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  /* ─── Metrics ────────────────────────────────────────────── */
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  /* ─── Empty State ────────────────────────────────────────── */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  /* ─── Items Grid ─────────────────────────────────────────── */
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridCard: {
    width: "47%",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
  },
  gridImage: {
    width: "100%",
    aspectRatio: 3 / 4,
  },
  gridImageFallback: {
    width: "100%",
    aspectRatio: 3 / 4,
    alignItems: "center",
    justifyContent: "center",
  },
  wearBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  wearBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  dirtyIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#C4714F",
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardInfo: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 2,
  },
  gridItemName: {
    fontSize: 12,
    fontWeight: "600",
  },
  gridItemMeta: {
    fontSize: 10,
  },
  gridAiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 10,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  gridStyleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 10,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  gridAiBtnText: {
    fontSize: 10,
    fontWeight: "600",
  },
  /* ─── Style With This Modal ──────────────────────────────── */
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalClose: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  anchorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  anchorImage: {
    width: 72,
    height: 96,
    borderRadius: 10,
  },
  anchorImageFallback: {
    width: 72,
    height: 96,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  anchorInfo: {
    flex: 1,
    gap: 4,
  },
  anchorName: {
    fontSize: 16,
    fontWeight: "600",
  },
  anchorMeta: {
    fontSize: 12,
  },
  pairingLoader: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 14,
  },
  pairingLoaderText: {
    fontSize: 13,
  },
  pairingError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    padding: 14,
  },
  pairingErrorText: {
    flex: 1,
    fontSize: 13,
  },
  suggestionSection: {
    gap: 14,
  },
  suggestionHeadline: {
    fontSize: 18,
    fontWeight: "700",
  },
  suggestionNote: {
    fontSize: 13,
    lineHeight: 20,
  },
  pairingCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  pairingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pairingOccasion: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pairingReason: {
    fontSize: 13,
    lineHeight: 19,
  },
  pairingItemsRow: {
    gap: 10,
    paddingTop: 4,
  },
  pairingItemThumb: {
    alignItems: "center",
    gap: 4,
    width: 64,
  },
  pairingThumbImage: {
    width: 64,
    height: 80,
    borderRadius: 10,
  },
  pairingThumbFallback: {
    width: 64,
    height: 80,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pairingThumbName: {
    fontSize: 9,
    textAlign: "center",
  },
  missingPiece: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  missingPieceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
