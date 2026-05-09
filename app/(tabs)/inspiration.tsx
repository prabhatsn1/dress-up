import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AppCard } from "@/components/wardrobe-ui";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  classifyVibe,
  deletePin,
  extractColoursFromContext,
  getAllPins,
  matchInspirationToWardrobe,
  upsertPin,
  VIBE_META,
  type InspirationPin,
  type InspirationVibe,
  type RankedMatch,
} from "@/lib/inspiration";
import { useAppData } from "@/providers/app-data-provider";

export { RouteErrorBoundary as ErrorBoundary } from "@/components/error-boundary";

const VIBES = Object.keys(VIBE_META) as InspirationVibe[];
const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 20;
const GRID_GAP = 10;
const TILE_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

// ─── Colour hex map (mirrors wardrobe-ui.tsx + extras) ────────────────────────
const COLOUR_HEX: Record<string, string> = {
  black: "#38312d",
  white: "#efe8dc",
  grey: "#9da1aa",
  charcoal: "#63636f",
  navy: "#2c3f68",
  blue: "#5b82c8",
  beige: "#d8c09b",
  cream: "#eee0c9",
  tan: "#cda078",
  brown: "#8f6244",
  olive: "#6d7b4e",
  green: "#3d7a54",
  emerald: "#3d8967",
  red: "#b84040",
  pink: "#e8a4b8",
  lavender: "#b8a8d4",
  gold: "#d6b15b",
  maroon: "#7a2a38",
  rust: "#c05838",
  terracotta: "#c86848",
  mustard: "#c8a040",
  bright: "#e87030",
  bold: "#c04820",
  mixed: "#9870c0",
  saffron: "#e89030",
  dark: "#30282c",
};

function swatchHex(name: string): string {
  return COLOUR_HEX[name.toLowerCase()] ?? "#b69d88";
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({
  value,
  max,
  colour,
}: {
  value: number;
  max: number;
  colour: string;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={scoreBarStyles.track}>
      <View
        style={[
          scoreBarStyles.fill,
          { width: `${pct * 100}%` as `${number}%`, backgroundColor: colour },
        ]}
      />
    </View>
  );
}
const scoreBarStyles = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: "#e0d4c8", flex: 1 },
  fill: { height: 4, borderRadius: 2 },
});

// ───  Main screen ─────────────────────────────────────────────────────────────
type ViewMode = "board" | "detail" | "add";

export default function InspirationScreen() {
  const { items } = useAppData();

  const background = useThemeColor({}, "background");
  const surface = useThemeColor({}, "surface");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const cool = useThemeColor({}, "accentCool");
  const tint = useThemeColor({}, "tint");

  const [view, setView] = useState<ViewMode>("board");
  const [pins, setPins] = useState<InspirationPin[]>([]);
  const [selectedPin, setSelectedPin] = useState<InspirationPin | null>(null);
  const [matches, setMatches] = useState<RankedMatch[]>([]);

  // Add flow state
  const [addImageUri, setAddImageUri] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addVibe, setAddVibe] = useState<InspirationVibe>("minimal");
  const [addTagInput, setAddTagInput] = useState("");
  const [addTags, setAddTags] = useState<string[]>([]);
  const [addNotes, setAddNotes] = useState("");
  const [addPreviewMatches, setAddPreviewMatches] = useState<RankedMatch[]>([]);
  const [isPickingImage, setIsPickingImage] = useState(false);

  // ── Load pins from SQLite ──────────────────────────────────────────────────
  const loadPins = useCallback(async () => {
    try {
      const stored = await getAllPins();
      setPins(stored);
    } catch {
      // DB not ready yet — silently ignore, will retry on next open
    }
  }, []);

  useEffect(() => {
    void loadPins();
  }, [loadPins]);

  // ── Open add flow ──────────────────────────────────────────────────────────
  function openAddFlow() {
    setAddImageUri(null);
    setAddTitle("");
    setAddVibe("minimal");
    setAddTags([]);
    setAddTagInput("");
    setAddNotes("");
    setAddPreviewMatches([]);
    setView("add");
  }

  // ── Pick image from library or camera ──────────────────────────────────────
  async function pickImage(source: "library" | "camera") {
    setIsPickingImage(true);
    try {
      const permResult =
        source === "library"
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();

      if (!permResult.granted) {
        Alert.alert(
          "Permission required",
          source === "library"
            ? "Enable photo library access in Settings to add inspiration."
            : "Enable camera access in Settings to take a photo.",
        );
        return;
      }

      const result =
        source === "library"
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: "images",
              quality: 0.8,
              allowsEditing: true,
              aspect: [4, 5],
            })
          : await ImagePicker.launchCameraAsync({
              quality: 0.8,
              allowsEditing: true,
              aspect: [4, 5],
            });

      if (result.canceled || !result.assets[0]) return;

      const uri = result.assets[0].uri;
      setAddImageUri(uri);

      // Auto-classify vibe from filename/path keywords
      const pathParts =
        uri.split("/").pop()?.replace(/[_.-]/g, " ").split(" ") ?? [];
      const detected = classifyVibe(pathParts);
      setAddVibe(detected);

      // Derive initial colour palette and preview matches
      const colours = extractColoursFromContext(detected, pathParts);
      const draftPin: InspirationPin = {
        id: "preview",
        imageUri: uri,
        title: "",
        vibe: detected,
        extractedColours: colours,
        tags: pathParts,
        matchedItemIds: [],
        createdAt: new Date().toISOString(),
      };
      setAddPreviewMatches(matchInspirationToWardrobe(draftPin, items, 6));
    } finally {
      setIsPickingImage(false);
    }
  }

  // ── Re-run matching whenever vibe/tags change in add flow ──────────────────
  function refreshPreviewMatches(
    vibe: InspirationVibe,
    tags: string[],
    imageUri: string | null,
  ) {
    if (!imageUri) return;
    const colours = extractColoursFromContext(vibe, tags);
    const draftPin: InspirationPin = {
      id: "preview",
      imageUri,
      title: "",
      vibe,
      extractedColours: colours,
      tags,
      matchedItemIds: [],
      createdAt: new Date().toISOString(),
    };
    setAddPreviewMatches(matchInspirationToWardrobe(draftPin, items, 6));
  }

  function handleVibeChange(v: InspirationVibe) {
    setAddVibe(v);
    refreshPreviewMatches(v, addTags, addImageUri);
  }

  function addTag(raw: string) {
    const cleaned = raw.trim().toLowerCase();
    if (!cleaned || addTags.includes(cleaned)) return;
    const next = [...addTags, cleaned];
    setAddTags(next);
    setAddTagInput("");
    refreshPreviewMatches(addVibe, next, addImageUri);
  }

  function removeTag(tag: string) {
    const next = addTags.filter((t) => t !== tag);
    setAddTags(next);
    refreshPreviewMatches(addVibe, next, addImageUri);
  }

  // ── Save pin ────────────────────────────────────────────────────────────────
  async function savePin() {
    if (!addImageUri) {
      Alert.alert("No image", "Please pick an image first.");
      return;
    }
    const colours = extractColoursFromContext(addVibe, addTags);
    const pin: InspirationPin = {
      id: `pin-${Date.now()}`,
      imageUri: addImageUri,
      title: addTitle.trim() || VIBE_META[addVibe].label,
      vibe: addVibe,
      extractedColours: colours,
      tags: addTags,
      matchedItemIds: addPreviewMatches.map((m) => m.item.id),
      notes: addNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await upsertPin(pin);
    await loadPins();
    setView("board");
  }

  // ── Open pin detail ─────────────────────────────────────────────────────────
  function openDetail(pin: InspirationPin) {
    setSelectedPin(pin);
    const ranked = matchInspirationToWardrobe(pin, items, 6);
    setMatches(ranked);
    setView("detail");
  }

  // ── Delete pin ──────────────────────────────────────────────────────────────
  async function handleDeletePin(pin: InspirationPin) {
    Alert.alert("Remove pin", "Delete this inspiration from your board?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePin(pin.id);
          await loadPins();
          setView("board");
          setSelectedPin(null);
        },
      },
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────

  function renderBoardView() {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: background }]}
        contentContainerStyle={styles.boardContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: text }]}>Inspiration</Text>
          <Text style={[styles.pageSubtitle, { color: muted }]}>
            Save looks you love and see which items in your closet get you
            closest.
          </Text>
        </View>

        {/* Vibes filter row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vibeFilterRow}
        >
          {VIBES.map((v) => (
            <TouchableOpacity
              key={v}
              style={[
                styles.vibeFilterChip,
                { borderColor: border, backgroundColor: surface },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.vibeFilterEmoji}>{VIBE_META[v].emoji}</Text>
              <Text style={[styles.vibeFilterLabel, { color: muted }]}>
                {VIBE_META[v].label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Pin grid */}
        {pins.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📸</Text>
            <Text style={[styles.emptyTitle, { color: text }]}>
              No pins yet
            </Text>
            <Text style={[styles.emptyMeta, { color: muted }]}>
              Add your first inspiration photo to see which items in your
              wardrobe match the vibe.
            </Text>
            <TouchableOpacity
              style={[styles.emptyAddBtn, { backgroundColor: warm }]}
              onPress={openAddFlow}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyAddBtnText}>Add inspiration</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.pinGrid}>
              {pins.map((pin) => (
                <TouchableOpacity
                  key={pin.id}
                  style={[
                    styles.pinTile,
                    { backgroundColor: surface, borderColor: border },
                  ]}
                  onPress={() => openDetail(pin)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: pin.imageUri }}
                    style={styles.pinTileImage}
                    resizeMode="cover"
                  />
                  <View style={styles.pinTileFooter}>
                    <Text style={[styles.pinTileVibe, { color: warm }]}>
                      {VIBE_META[pin.vibe].emoji} {VIBE_META[pin.vibe].label}
                    </Text>
                    <Text
                      style={[styles.pinTileTitle, { color: text }]}
                      numberOfLines={1}
                    >
                      {pin.title}
                    </Text>
                    <Text style={[styles.pinTileMeta, { color: muted }]}>
                      {pin.matchedItemIds.length} items matched
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  function renderDetailView() {
    if (!selectedPin) return null;
    const meta = VIBE_META[selectedPin.vibe];

    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: background }]}
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setView("board")}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={20} color={muted} />
          <Text style={[styles.backText, { color: muted }]}>Board</Text>
        </TouchableOpacity>

        {/* Hero image */}
        <View style={[styles.heroImageWrap, { borderColor: border }]}>
          <Image
            source={{ uri: selectedPin.imageUri }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          {/* Vibe badge */}
          <View style={[styles.vibeBadge, { backgroundColor: warm }]}>
            <Text style={styles.vibeBadgeText}>
              {meta.emoji} {meta.label}
            </Text>
          </View>
        </View>

        {/* Title + description */}
        <AppCard accent={warm}>
          <Text style={[styles.detailTitle, { color: text }]}>
            {selectedPin.title}
          </Text>
          <Text style={[styles.detailDesc, { color: muted }]}>
            {meta.description}
          </Text>

          {/* Colour palette */}
          <View style={styles.swatchRow}>
            {selectedPin.extractedColours.map((c) => (
              <View
                key={c}
                style={[styles.swatch, { backgroundColor: swatchHex(c) }]}
              />
            ))}
          </View>

          {/* Tags */}
          {selectedPin.tags.length > 0 && (
            <View style={styles.tagRow}>
              {selectedPin.tags.map((t) => (
                <View key={t} style={[styles.tagChip, { borderColor: border }]}>
                  <Text style={[styles.tagChipText, { color: muted }]}>
                    #{t}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {selectedPin.notes ? (
            <Text style={[styles.detailNotes, { color: muted }]}>
              {selectedPin.notes}
            </Text>
          ) : null}
        </AppCard>

        {/* Matched wardrobe items */}
        <AppCard accent={cool}>
          <Text style={[styles.sectionLabel, { color: text }]}>
            Closest items in your closet
          </Text>
          <Text style={[styles.sectionSub, { color: muted }]}>
            Ranked by how well each piece captures the{" "}
            {meta.label.toLowerCase()} vibe.
          </Text>

          {matches.length === 0 ? (
            <Text style={[styles.noMatchText, { color: muted }]}>
              No wardrobe items found. Add more clothes to your closet to see
              matches here.
            </Text>
          ) : (
            matches.map((match, idx) => (
              <MatchRow
                key={match.item.id}
                match={match}
                rank={idx + 1}
                warm={warm}
                cool={cool}
                text={text}
                muted={muted}
                border={border}
                surface={surface}
              />
            ))
          )}
        </AppCard>

        {/* Delete button */}
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: "#9b4141" }]}
          onPress={() => handleDeletePin(selectedPin)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="delete-outline" size={18} color="#9b4141" />
          <Text style={[styles.deleteBtnText, { color: "#9b4141" }]}>
            Remove from board
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderAddView() {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: background }]}
        contentContainerStyle={styles.addContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setView("board")}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={20} color={muted} />
          <Text style={[styles.backText, { color: muted }]}>Board</Text>
        </TouchableOpacity>

        <Text style={[styles.addScreenTitle, { color: text }]}>
          New inspiration
        </Text>

        {/* Step 1: pick image */}
        <AppCard accent={warm}>
          <Text style={[styles.stepLabel, { color: text }]}>1. Add image</Text>
          {addImageUri ? (
            <View>
              <Image
                source={{ uri: addImageUri }}
                style={styles.addPreviewImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={[styles.changeImageBtn, { borderColor: border }]}
                onPress={() => pickImage("library")}
                activeOpacity={0.7}
              >
                <Text style={[styles.changeImageBtnText, { color: muted }]}>
                  Change image
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickRow}>
              <TouchableOpacity
                style={[styles.pickBtn, { backgroundColor: tint }]}
                onPress={() => pickImage("library")}
                activeOpacity={0.8}
                disabled={isPickingImage}
              >
                <MaterialIcons name="photo-library" size={20} color="#fff" />
                <Text style={styles.pickBtnText}>Library</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickBtn, { backgroundColor: cool }]}
                onPress={() => pickImage("camera")}
                activeOpacity={0.8}
                disabled={isPickingImage}
              >
                <MaterialIcons name="camera-alt" size={20} color="#fff" />
                <Text style={styles.pickBtnText}>Camera</Text>
              </TouchableOpacity>
            </View>
          )}
        </AppCard>

        {/* Step 2: title */}
        <AppCard>
          <Text style={[styles.stepLabel, { color: text }]}>
            2. Title (optional)
          </Text>
          <TextInput
            style={[
              styles.textInput,
              { color: text, borderColor: border, backgroundColor: surface },
            ]}
            value={addTitle}
            onChangeText={setAddTitle}
            placeholder="e.g. Autumn layers look"
            placeholderTextColor={muted}
            returnKeyType="done"
          />
        </AppCard>

        {/* Step 3: vibe classification */}
        <AppCard accent={cool}>
          <Text style={[styles.stepLabel, { color: text }]}>3. Style vibe</Text>
          <Text style={[styles.stepSub, { color: muted }]}>
            Auto-detected from image — tap to override.
          </Text>
          <View style={styles.vibeGrid}>
            {VIBES.map((v) => {
              const active = addVibe === v;
              return (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.vibeOption,
                    {
                      backgroundColor: active ? warm + "22" : surface,
                      borderColor: active ? warm : border,
                    },
                  ]}
                  onPress={() => handleVibeChange(v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.vibeOptionEmoji}>
                    {VIBE_META[v].emoji}
                  </Text>
                  <Text
                    style={[
                      styles.vibeOptionLabel,
                      { color: active ? warm : text },
                    ]}
                  >
                    {VIBE_META[v].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Colour palette preview */}
          <View style={styles.swatchRow}>
            {VIBE_META[addVibe].colours.slice(0, 6).map((c) => (
              <View
                key={c}
                style={[styles.swatch, { backgroundColor: swatchHex(c) }]}
              />
            ))}
          </View>
          <Text style={[styles.vibeDesc, { color: muted }]}>
            {VIBE_META[addVibe].description}
          </Text>
        </AppCard>

        {/* Step 4: tags */}
        <AppCard>
          <Text style={[styles.stepLabel, { color: text }]}>
            4. Tags (optional)
          </Text>
          <Text style={[styles.stepSub, { color: muted }]}>
            Add colours, materials, or keywords to refine matching.
          </Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[
                styles.tagInput,
                { color: text, borderColor: border, backgroundColor: surface },
              ]}
              value={addTagInput}
              onChangeText={setAddTagInput}
              placeholder="e.g. linen, earthy, oversized"
              placeholderTextColor={muted}
              onSubmitEditing={() => addTag(addTagInput)}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.tagAddBtn, { backgroundColor: tint }]}
              onPress={() => addTag(addTagInput)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {addTags.length > 0 && (
            <View style={styles.tagRow}>
              {addTags.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.tagChipRemovable,
                    { borderColor: warm, backgroundColor: warm + "18" },
                  ]}
                  onPress={() => removeTag(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tagChipText, { color: warm }]}>
                    #{t}
                  </Text>
                  <MaterialIcons
                    name="close"
                    size={12}
                    color={warm}
                    style={{ marginLeft: 3 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </AppCard>

        {/* Step 5: notes */}
        <AppCard>
          <Text style={[styles.stepLabel, { color: text }]}>
            5. Notes (optional)
          </Text>
          <TextInput
            style={[
              styles.textInput,
              styles.notesInput,
              { color: text, borderColor: border, backgroundColor: surface },
            ]}
            value={addNotes}
            onChangeText={setAddNotes}
            placeholder="What do you love about this look?"
            placeholderTextColor={muted}
            multiline
            returnKeyType="default"
          />
        </AppCard>

        {/* Live match preview */}
        {addPreviewMatches.length > 0 && (
          <AppCard accent={cool}>
            <Text style={[styles.stepLabel, { color: text }]}>
              Closest matches in your closet
            </Text>
            <Text style={[styles.stepSub, { color: muted }]}>
              These items best capture the{" "}
              {VIBE_META[addVibe].label.toLowerCase()} vibe.
            </Text>
            {addPreviewMatches.slice(0, 4).map((match, idx) => (
              <MatchRow
                key={match.item.id}
                match={match}
                rank={idx + 1}
                warm={warm}
                cool={cool}
                text={text}
                muted={muted}
                border={border}
                surface={surface}
              />
            ))}
          </AppCard>
        )}

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: warm }]}
          onPress={savePin}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>Save to board</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {view === "board" && renderBoardView()}
      {view === "detail" && renderDetailView()}
      {view === "add" && renderAddView()}

      {/* FAB — only on board view */}
      {view === "board" && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: warm }]}
          onPress={openAddFlow}
          activeOpacity={0.85}
        >
          <MaterialIcons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── MatchRow sub-component ───────────────────────────────────────────────────
function MatchRow({
  match,
  rank,
  warm,
  cool,
  text,
  muted,
  border,
  surface,
}: {
  match: RankedMatch;
  rank: number;
  warm: string;
  cool: string;
  text: string;
  muted: string;
  border: string;
  surface: string;
}) {
  const { item, score, breakdown } = match;
  const pct = Math.round((score / 100) * 100);

  return (
    <View style={[matchRowStyles.row, { borderColor: border }]}>
      <View
        style={[
          matchRowStyles.rank,
          {
            backgroundColor: rank <= 2 ? warm + "22" : surface,
            borderColor: border,
          },
        ]}
      >
        <Text
          style={[matchRowStyles.rankText, { color: rank <= 2 ? warm : muted }]}
        >
          {rank}
        </Text>
      </View>

      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={matchRowStyles.thumb}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            matchRowStyles.thumbPlaceholder,
            { backgroundColor: surface, borderColor: border },
          ]}
        >
          <MaterialIcons name="checkroom" size={20} color={muted} />
        </View>
      )}

      <View style={matchRowStyles.info}>
        <Text style={[matchRowStyles.name, { color: text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[matchRowStyles.meta, { color: muted }]}>
          {item.subcategory} · {item.formality}
        </Text>
        {/* Colour dots */}
        <View style={matchRowStyles.colourDots}>
          {item.colours.slice(0, 4).map((c) => (
            <View
              key={c}
              style={[
                matchRowStyles.dot,
                { backgroundColor: COLOUR_HEX[c.toLowerCase()] ?? "#b69d88" },
              ]}
            />
          ))}
        </View>
        {/* Score breakdown bars */}
        <View style={matchRowStyles.bars}>
          <ScoreBar value={breakdown.vibeScore} max={40} colour={warm} />
          <ScoreBar value={breakdown.colourScore} max={30} colour={cool} />
          <ScoreBar value={breakdown.categoryScore} max={20} colour="#7d8c4f" />
          <ScoreBar value={breakdown.tagScore} max={10} colour="#c09845" />
        </View>
      </View>

      <View style={matchRowStyles.badge}>
        <Text
          style={[
            matchRowStyles.badgeText,
            { color: pct >= 70 ? warm : muted },
          ]}
        >
          {pct}%
        </Text>
      </View>
    </View>
  );
}

const matchRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 11,
    fontWeight: "700",
  },
  thumb: {
    width: 48,
    height: 56,
    borderRadius: 6,
  },
  thumbPlaceholder: {
    width: 48,
    height: 56,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: "600",
  },
  meta: {
    fontSize: 11,
  },
  colourDots: {
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bars: {
    flexDirection: "row",
    gap: 3,
    marginTop: 4,
  },
  badge: {
    minWidth: 36,
    alignItems: "flex-end",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  boardContent: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 16,
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 16,
  },
  addContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 16,
  },

  pageHeader: {
    gap: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "600",
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },

  // Board: vibe filter row
  vibeFilterRow: {
    gap: 8,
    paddingBottom: 4,
  },
  vibeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  vibeFilterEmoji: {
    fontSize: 14,
  },
  vibeFilterLabel: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Board: pin grid
  pinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  pinTile: {
    width: TILE_SIZE,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  pinTileImage: {
    width: "100%",
    height: TILE_SIZE * 1.2,
  },
  pinTileFooter: {
    padding: 10,
    gap: 2,
  },
  pinTileVibe: {
    fontSize: 11,
    fontWeight: "600",
  },
  pinTileTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  pinTileMeta: {
    fontSize: 11,
  },

  // Board: empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptyMeta: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyAddBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  emptyAddBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },

  // Detail view
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
  heroImageWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  heroImage: {
    width: "100%",
    height: 320,
  },
  vibeBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  vibeBadgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
  detailDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  detailNotes: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
    marginTop: 10,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagChipRemovable: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  noMatchText: {
    fontSize: 13,
    lineHeight: 20,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Add view
  addScreenTitle: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  stepSub: {
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  pickRow: {
    flexDirection: "row",
    gap: 12,
  },
  pickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  pickBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  addPreviewImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  changeImageBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  changeImageBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  vibeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  vibeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  vibeOptionEmoji: {
    fontSize: 14,
  },
  vibeOptionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  vibeDesc: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
    fontStyle: "italic",
  },
  tagInputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  tagAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
