import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AppCard, Chip } from "@/components/wardrobe-ui";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  buildCapsuleSuggestions,
  challengeProgress,
  computeCapsuleCoverage,
  createCapsule,
  validateChallenge,
  CAPSULE_MAX_ITEMS,
  CAPSULE_MIN_ITEMS,
  CHALLENGE_ITEM_COUNT,
  CHALLENGE_MIN_OUTFITS,
  type Capsule,
  type CapsuleCoverage,
  type CapsulePurpose,
  type CapsuleSuggestion,
} from "@/lib/capsule";
import { getAllCapsules, upsertCapsule, deleteCapsule } from "@/lib/local-db";
import { useAppData } from "@/providers/app-data-provider";

export { RouteErrorBoundary as ErrorBoundary } from "@/components/error-boundary";

// ─── Constants ────────────────────────────────────────────────────────────────

const PURPOSES: { value: CapsulePurpose; label: string; icon: string }[] = [
  { value: "work", label: "Work", icon: "work" },
  { value: "travel", label: "Travel", icon: "flight" },
  { value: "weekend", label: "Weekend", icon: "wb-sunny" },
  { value: "evening", label: "Evening", icon: "nights-stay" },
  { value: "seasonal", label: "Seasonal", icon: "ac-unit" },
  { value: "custom", label: "Custom", icon: "style" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number, colors: (typeof Colors)["light"]) {
  if (score >= 75) return colors.success;
  if (score >= 40) return colors.accentWarm;
  return colors.danger;
}

function progressBar(
  value: number,
  max: number,
  fillColor: string,
  trackColor: string,
) {
  const pct = Math.min(value / max, 1) * 100;
  return (
    <View style={[barStyles.track, { backgroundColor: trackColor }]}>
      <View
        style={[
          barStyles.fill,
          { backgroundColor: fillColor, width: `${pct}%` },
        ]}
      />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: { height: 6, borderRadius: 999, overflow: "hidden" },
  fill: { height: 6, borderRadius: 999 },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function CoverageCard({
  coverage,
  colors,
}: {
  coverage: CapsuleCoverage;
  colors: (typeof Colors)["light"];
}) {
  const covColor = scoreColor(coverage.coverageScore, colors);
  const verColor = scoreColor(coverage.versatilityScore, colors);
  return (
    <View style={cardStyles.root}>
      <View style={cardStyles.row}>
        <View style={cardStyles.metric}>
          <Text style={[cardStyles.value, { color: covColor }]}>
            {coverage.coverageScore}
          </Text>
          <Text style={[cardStyles.label, { color: colors.muted }]}>
            Coverage
          </Text>
          {progressBar(coverage.coverageScore, 100, covColor, colors.border)}
        </View>
        <View style={cardStyles.metric}>
          <Text style={[cardStyles.value, { color: verColor }]}>
            {coverage.versatilityScore}
          </Text>
          <Text style={[cardStyles.label, { color: colors.muted }]}>
            Versatility
          </Text>
          {progressBar(coverage.versatilityScore, 100, verColor, colors.border)}
        </View>
        <View style={cardStyles.metric}>
          <Text style={[cardStyles.value, { color: colors.tint }]}>
            {coverage.totalCombos}
          </Text>
          <Text style={[cardStyles.label, { color: colors.muted }]}>
            Outfits
          </Text>
          {progressBar(coverage.totalCombos, 30, colors.tint, colors.border)}
        </View>
      </View>

      {coverage.occasionGaps.length > 0 ? (
        <View style={cardStyles.gapRow}>
          <MaterialIcons
            name="warning-amber"
            size={14}
            color={colors.accentWarm}
          />
          <Text style={[cardStyles.gapText, { color: colors.muted }]}>
            No coverage for:{" "}
            <Text style={{ color: colors.accentWarm }}>
              {coverage.occasionGaps.join(", ")}
            </Text>
          </Text>
        </View>
      ) : null}

      <View style={cardStyles.chipRow}>
        {coverage.occasionsCovered.map((o) => (
          <View
            key={o}
            style={[
              cardStyles.chip,
              { backgroundColor: `${colors.success}22` },
            ]}
          >
            <Text style={[cardStyles.chipText, { color: colors.success }]}>
              {o}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  root: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, gap: 4, alignItems: "center" },
  value: { fontSize: 24, fontWeight: "700" },
  label: { fontSize: 11, textAlign: "center" },
  gapRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  gapText: { fontSize: 12, flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: "600" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

type ViewMode = "list" | "detail" | "create" | "challenge";

export default function CapsuleScreen() {
  const scheme = useColorScheme() ?? "light";
  const palette = Colors[scheme];
  const { items, isWardrobeLoading } = useAppData();

  // Navigation state
  const [view, setView] = useState<ViewMode>("list");
  const [selectedCapsule, setSelectedCapsule] = useState<Capsule | null>(null);

  // Capsule list
  const [capsules, setCapsules] = useState<Capsule[]>([]);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formPurpose, setFormPurpose] = useState<CapsulePurpose>("work");
  const [formDescription, setFormDescription] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [isChallenge, setIsChallenge] = useState(false);

  const loadCapsules = useCallback(async () => {
    try {
      const all = await getAllCapsules();
      setCapsules(all);
    } catch {
      // DB not yet initialised — will retry when wardrobe finishes loading
    }
  }, []);

  useEffect(() => {
    if (isWardrobeLoading) return;
    void loadCapsules();
  }, [loadCapsules, isWardrobeLoading]);

  // ── Detail view derived state ─────────────────────────────────────────────

  const detailItems = useMemo(() => {
    if (!selectedCapsule) return [];
    const idSet = new Set(selectedCapsule.itemIds);
    return items.filter((i) => idSet.has(i.id));
  }, [selectedCapsule, items]);

  const detailCoverage = useMemo(
    () => computeCapsuleCoverage(detailItems),
    [detailItems],
  );

  const detailSuggestions = useMemo(
    () => buildCapsuleSuggestions(detailItems, items, 6),
    [detailItems, items],
  );

  const detailChallenge = useMemo(
    () =>
      selectedCapsule?.isChallenge ? challengeProgress(selectedCapsule) : null,
    [selectedCapsule],
  );

  // ── Create form derived state ─────────────────────────────────────────────

  const selectedItems = useMemo(
    () => items.filter((i) => selectedItemIds.has(i.id)),
    [items, selectedItemIds],
  );

  const createCoverage = useMemo(
    () => computeCapsuleCoverage(selectedItems),
    [selectedItems],
  );

  const challengeError = useMemo(
    () => (isChallenge ? validateChallenge(selectedItems) : null),
    [isChallenge, selectedItems],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (
        next.size < (isChallenge ? CHALLENGE_ITEM_COUNT : CAPSULE_MAX_ITEMS)
      ) {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!formName.trim()) {
      Alert.alert("Name required", "Give your capsule a name.");
      return;
    }
    if (selectedItemIds.size < CAPSULE_MIN_ITEMS) {
      Alert.alert(
        "Too few items",
        `Add at least ${CAPSULE_MIN_ITEMS} items to your capsule.`,
      );
      return;
    }
    if (isChallenge && challengeError) {
      Alert.alert("Challenge not ready", challengeError);
      return;
    }
    const capsule = await createCapsule(
      formName.trim(),
      formPurpose,
      [...selectedItemIds],
      {
        description: formDescription.trim() || undefined,
        isChallenge,
        challengeDays: isChallenge ? 10 : undefined,
      },
    );
    await upsertCapsule(capsule);
    await loadCapsules();
    setView("list");
    resetForm();
  }

  function resetForm() {
    setFormName("");
    setFormPurpose("work");
    setFormDescription("");
    setSelectedItemIds(new Set());
    setIsChallenge(false);
  }

  async function handleDelete(capsule: Capsule) {
    Alert.alert(
      "Delete capsule?",
      `"${capsule.name}" will be removed. Your wardrobe items are not affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteCapsule(capsule.id);
            await loadCapsules();
            if (selectedCapsule?.id === capsule.id) {
              setSelectedCapsule(null);
              setView("list");
            }
          },
        },
      ],
    );
  }

  async function handleApplySuggestion(s: CapsuleSuggestion) {
    if (!selectedCapsule) return;
    let newIds: string[];
    if (s.action === "add") {
      newIds = [...selectedCapsule.itemIds, s.item.id];
    } else {
      newIds = selectedCapsule.itemIds.filter((id) => id !== s.item.id);
    }
    const updated: Capsule = {
      ...selectedCapsule,
      itemIds: newIds,
      updatedAt: new Date().toISOString(),
    };
    await upsertCapsule(updated);
    setSelectedCapsule(updated);
    await loadCapsules();
  }

  // ─── Renders ───────────────────────────────────────────────────────────────

  if (view === "detail" && selectedCapsule) {
    return (
      <ScrollView
        style={[s.screen, { backgroundColor: palette.background }]}
        contentContainerStyle={s.content}
      >
        <Pressable onPress={() => setView("list")} style={s.back}>
          <MaterialIcons name="arrow-back" size={20} color={palette.tint} />
          <Text style={[s.backText, { color: palette.tint }]}>
            All capsules
          </Text>
        </Pressable>

        <View style={s.pageHeader}>
          <Text style={[s.headerEyebrow, { color: palette.muted }]}>
            {selectedCapsule.purpose.toUpperCase()}
          </Text>
          <Text style={[s.headerTitle, { color: palette.text }]}>
            {selectedCapsule.name}
          </Text>
          {selectedCapsule.description ? (
            <Text style={[s.headerDetail, { color: palette.muted }]}>
              {selectedCapsule.description}
            </Text>
          ) : null}
        </View>

        {/* Challenge progress banner */}
        {detailChallenge ? (
          <AppCard accent={palette.accentWarm}>
            <View style={s.challengeHeader}>
              <MaterialIcons
                name="emoji-events"
                size={22}
                color={palette.accentWarm}
              />
              <Text style={[s.challengeTitle, { color: palette.text }]}>
                10×10 Challenge
              </Text>
              {detailChallenge.complete ? (
                <View
                  style={[s.badge, { backgroundColor: `${palette.success}22` }]}
                >
                  <Text style={[s.badgeText, { color: palette.success }]}>
                    Complete!
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={s.challengeRow}>
              <View style={s.challengeStat}>
                <Text style={[s.challengeValue, { color: palette.accentWarm }]}>
                  {detailChallenge.outfitsLogged}
                </Text>
                <Text style={[s.challengeLabel, { color: palette.muted }]}>
                  outfits logged
                </Text>
              </View>
              <View style={s.challengeStat}>
                <Text style={[s.challengeValue, { color: palette.tint }]}>
                  {CHALLENGE_MIN_OUTFITS}
                </Text>
                <Text style={[s.challengeLabel, { color: palette.muted }]}>
                  target
                </Text>
              </View>
              {detailChallenge.daysLeft !== null ? (
                <View style={s.challengeStat}>
                  <Text
                    style={[
                      s.challengeValue,
                      {
                        color:
                          detailChallenge.daysLeft < 3
                            ? palette.danger
                            : palette.muted,
                      },
                    ]}
                  >
                    {detailChallenge.daysLeft}
                  </Text>
                  <Text style={[s.challengeLabel, { color: palette.muted }]}>
                    days left
                  </Text>
                </View>
              ) : null}
            </View>
            {progressBar(
              detailChallenge.outfitsLogged,
              CHALLENGE_MIN_OUTFITS,
              detailChallenge.complete ? palette.success : palette.accentWarm,
              palette.border,
            )}
            {!detailChallenge.complete ? (
              <Text style={[s.challengeHint, { color: palette.muted }]}>
                Wear outfits from this capsule and log them on the Today tab.{" "}
                {detailChallenge.outfitsNeeded} more to go!
              </Text>
            ) : null}
          </AppCard>
        ) : null}

        {/* Coverage */}
        <AppCard accent={palette.tint}>
          <Text style={[s.sectionTitle, { color: palette.text }]}>
            Coverage analysis
          </Text>
          <CoverageCard coverage={detailCoverage} colors={palette} />
        </AppCard>

        {/* Items */}
        <AppCard>
          <Text style={[s.sectionTitle, { color: palette.text }]}>
            {detailItems.length} items
          </Text>
          <View style={s.itemGrid}>
            {detailItems.map((item) => (
              <View
                key={item.id}
                style={[s.itemChip, { borderColor: palette.border }]}
              >
                <Text
                  style={[s.itemChipText, { color: palette.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={[s.itemChipMeta, { color: palette.muted }]}>
                  {item.category} · {item.formality}
                </Text>
              </View>
            ))}
          </View>
        </AppCard>

        {/* Suggestions */}
        {detailSuggestions.length > 0 ? (
          <AppCard accent={palette.accentCool}>
            <Text style={[s.sectionTitle, { color: palette.text }]}>
              Optimisation suggestions
            </Text>
            <Text style={[s.sectionSubtitle, { color: palette.muted }]}>
              Apply suggestions to improve coverage and versatility.
            </Text>
            {detailSuggestions.map((sg, i) => (
              <View
                key={`${sg.action}-${sg.item.id}`}
                style={[s.suggestionRow, { borderColor: palette.border }]}
              >
                <View
                  style={[
                    s.suggestionBadge,
                    {
                      backgroundColor:
                        sg.action === "add"
                          ? `${palette.success}22`
                          : `${palette.danger}22`,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={sg.action === "add" ? "add" : "remove"}
                    size={14}
                    color={
                      sg.action === "add" ? palette.success : palette.danger
                    }
                  />
                </View>
                <View style={s.suggestionCopy}>
                  <Text
                    style={[s.suggestionName, { color: palette.text }]}
                    numberOfLines={1}
                  >
                    {sg.item.name}
                  </Text>
                  <Text style={[s.suggestionReason, { color: palette.muted }]}>
                    {sg.reason}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    s.applyBtn,
                    {
                      backgroundColor:
                        sg.action === "add" ? palette.success : palette.danger,
                    },
                  ]}
                  onPress={() => void handleApplySuggestion(sg)}
                >
                  <Text style={s.applyBtnText}>
                    {sg.action === "add" ? "Add" : "Remove"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </AppCard>
        ) : null}

        <TouchableOpacity
          style={[s.deleteBtn, { borderColor: palette.danger }]}
          onPress={() => void handleDelete(selectedCapsule)}
        >
          <MaterialIcons
            name="delete-outline"
            size={18}
            color={palette.danger}
          />
          <Text style={[s.deleteBtnText, { color: palette.danger }]}>
            Delete capsule
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (view === "create") {
    return (
      <ScrollView
        style={[s.screen, { backgroundColor: palette.background }]}
        contentContainerStyle={s.content}
      >
        <Pressable
          onPress={() => {
            setView("list");
            resetForm();
          }}
          style={s.back}
        >
          <MaterialIcons name="arrow-back" size={20} color={palette.tint} />
          <Text style={[s.backText, { color: palette.tint }]}>Cancel</Text>
        </Pressable>

        <View style={s.pageHeader}>
          <Text style={[s.headerEyebrow, { color: palette.muted }]}>
            NEW CAPSULE
          </Text>
          <Text style={[s.headerTitle, { color: palette.text }]}>
            Build your capsule
          </Text>
          <Text style={[s.headerDetail, { color: palette.muted }]}>
            Choose {CAPSULE_MIN_ITEMS}–{CAPSULE_MAX_ITEMS} items that work
            together.
          </Text>
        </View>

        {/* Name */}
        <AppCard>
          <Text style={[s.fieldLabel, { color: palette.muted }]}>Name</Text>
          <TextInput
            value={formName}
            onChangeText={setFormName}
            placeholder="e.g. NYC Work Trip"
            placeholderTextColor={palette.muted}
            style={[
              s.textInput,
              { color: palette.text, borderColor: palette.border },
            ]}
          />

          <Text style={[s.fieldLabel, { color: palette.muted }]}>Purpose</Text>
          <View style={s.chipRow}>
            {PURPOSES.map(({ value, label }) => (
              <Chip
                key={value}
                label={label}
                active={formPurpose === value}
                onPress={() => setFormPurpose(value)}
              />
            ))}
          </View>

          <Text style={[s.fieldLabel, { color: palette.muted }]}>
            Description (optional)
          </Text>
          <TextInput
            value={formDescription}
            onChangeText={setFormDescription}
            placeholder="What is this capsule for?"
            placeholderTextColor={palette.muted}
            multiline
            numberOfLines={2}
            style={[
              s.textInput,
              s.textArea,
              { color: palette.text, borderColor: palette.border },
            ]}
          />
        </AppCard>

        {/* 10×10 toggle */}
        <AppCard accent={palette.accentWarm}>
          <View style={s.challengeToggleRow}>
            <View style={s.challengeToggleCopy}>
              <Text style={[s.sectionTitle, { color: palette.text }]}>
                10×10 Challenge
              </Text>
              <Text style={[s.sectionSubtitle, { color: palette.muted }]}>
                Pick exactly 10 items and wear 10 distinct outfits in 10 days.
              </Text>
            </View>
            <TouchableOpacity
              style={[
                s.toggleBtn,
                {
                  backgroundColor: isChallenge
                    ? palette.accentWarm
                    : palette.border,
                },
              ]}
              onPress={() => {
                setIsChallenge((v) => !v);
                setSelectedItemIds(new Set());
              }}
            >
              <Text style={s.toggleBtnText}>{isChallenge ? "ON" : "OFF"}</Text>
            </TouchableOpacity>
          </View>
          {isChallenge && challengeError ? (
            <Text style={[s.errorText, { color: palette.danger }]}>
              {challengeError}
            </Text>
          ) : null}
          {isChallenge &&
          !challengeError &&
          selectedItems.length === CHALLENGE_ITEM_COUNT ? (
            <Text style={[s.successText, { color: palette.success }]}>
              {createCoverage.totalCombos} valid outfits — ready to start!
            </Text>
          ) : null}
        </AppCard>

        {/* Live coverage preview */}
        {selectedItems.length >= 2 ? (
          <AppCard>
            <Text style={[s.sectionTitle, { color: palette.text }]}>
              Live coverage preview ({selectedItems.length} items)
            </Text>
            <CoverageCard coverage={createCoverage} colors={palette} />
          </AppCard>
        ) : null}

        {/* Item picker */}
        <AppCard>
          <Text style={[s.sectionTitle, { color: palette.text }]}>
            Select items
          </Text>
          <Text style={[s.sectionSubtitle, { color: palette.muted }]}>
            {isChallenge
              ? `${selectedItemIds.size} / ${CHALLENGE_ITEM_COUNT} selected`
              : `${selectedItemIds.size} selected · ${CAPSULE_MIN_ITEMS}–${CAPSULE_MAX_ITEMS} items`}
          </Text>
          <View style={s.itemPickerGrid}>
            {items.map((item) => {
              const selected = selectedItemIds.has(item.id);
              const atLimit = isChallenge
                ? selectedItemIds.size >= CHALLENGE_ITEM_COUNT
                : selectedItemIds.size >= CAPSULE_MAX_ITEMS;
              const disabled = !selected && atLimit;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleItem(item.id)}
                  disabled={disabled}
                  style={[
                    s.pickerChip,
                    {
                      backgroundColor: selected
                        ? `${palette.tint}22`
                        : palette.surface,
                      borderColor: selected ? palette.tint : palette.border,
                      opacity: disabled ? 0.4 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.pickerChipText,
                      { color: selected ? palette.tint : palette.text },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text style={[s.pickerChipMeta, { color: palette.muted }]}>
                    {item.category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </AppCard>

        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: palette.tint }]}
          onPress={() => void handleSave()}
        >
          <Text style={s.saveBtnText}>Save capsule</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={[s.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={s.content}
    >
      <View style={s.pageHeader}>
        <Text style={[s.headerTitle, { color: palette.text }]}>
          Capsule wardrobe
        </Text>
        <Text style={[s.headerDetail, { color: palette.muted }]}>
          Curate a focused collection that maximises outfit variety from fewer
          pieces.
        </Text>
      </View>

      {/* What is a capsule */}
      <AppCard accent={palette.tint}>
        <Text style={[s.sectionTitle, { color: palette.text }]}>
          What&apos;s a capsule wardrobe?
        </Text>
        <Text style={[s.bodyText, { color: palette.muted }]}>
          A capsule is a small, intentional collection where every item pairs
          with at least two others. The goal is maximum outfit count from
          minimum items — quality over quantity.
        </Text>
        <View style={s.formulaBlock}>
          {[
            {
              label: "Coverage",
              formula: "valid top+bottom pairs + layered triples",
            },
            {
              label: "Versatility",
              formula: "avg fraction of items each piece pairs with",
            },
            {
              label: "10×10",
              formula: "10 items → 10 outfits → 10 days",
            },
          ].map(({ label, formula }) => (
            <View key={label} style={s.formulaRow}>
              <Text style={[s.formulaLabel, { color: palette.tint }]}>
                {label}
              </Text>
              <Text style={[s.formulaValue, { color: palette.muted }]}>
                {formula}
              </Text>
            </View>
          ))}
        </View>
      </AppCard>

      {/* Capsule list */}
      {capsules.length === 0 ? (
        <AppCard>
          <View style={s.emptyState}>
            <MaterialIcons name="style" size={48} color={palette.muted} />
            <Text style={[s.emptyTitle, { color: palette.text }]}>
              No capsules yet
            </Text>
            <Text style={[s.emptyBody, { color: palette.muted }]}>
              Create your first capsule to start building a focused, versatile
              wardrobe.
            </Text>
          </View>
        </AppCard>
      ) : (
        capsules.map((cap) => {
          const capItems = items.filter((i) => cap.itemIds.includes(i.id));
          const cov = computeCapsuleCoverage(capItems);
          const prog = cap.isChallenge ? challengeProgress(cap) : null;
          const covColor = scoreColor(cov.coverageScore, palette);
          return (
            <TouchableOpacity
              key={cap.id}
              onPress={() => {
                setSelectedCapsule(cap);
                setView("detail");
              }}
            >
              <AppCard
                accent={cap.isChallenge ? palette.accentWarm : palette.tint}
              >
                <View style={s.capsuleCardHeader}>
                  <View style={s.capsuleCardTitles}>
                    <Text style={[s.capsuleName, { color: palette.text }]}>
                      {cap.name}
                    </Text>
                    <Text style={[s.capsuleMeta, { color: palette.muted }]}>
                      {cap.purpose} · {cap.itemIds.length} items
                      {cap.isChallenge ? " · 10×10" : ""}
                    </Text>
                  </View>
                  <View style={s.capsuleScores}>
                    <Text style={[s.capsuleScore, { color: covColor }]}>
                      {cov.coverageScore}
                    </Text>
                    <Text
                      style={[s.capsuleScoreLabel, { color: palette.muted }]}
                    >
                      cov
                    </Text>
                  </View>
                </View>

                {progressBar(cov.coverageScore, 100, covColor, palette.border)}

                {prog ? (
                  <View style={s.challengePill}>
                    <MaterialIcons
                      name="emoji-events"
                      size={12}
                      color={palette.accentWarm}
                    />
                    <Text
                      style={[
                        s.challengePillText,
                        { color: palette.accentWarm },
                      ]}
                    >
                      {prog.outfitsLogged}/{CHALLENGE_MIN_OUTFITS} outfits
                      {prog.daysLeft !== null
                        ? ` · ${prog.daysLeft}d left`
                        : ""}
                      {prog.complete ? " · Done!" : ""}
                    </Text>
                  </View>
                ) : null}
              </AppCard>
            </TouchableOpacity>
          );
        })
      )}

      {/* Create button */}
      <TouchableOpacity
        style={[s.saveBtn, { backgroundColor: palette.tint }]}
        onPress={() => setView("create")}
      >
        <MaterialIcons name="add" size={20} color="#fff9f3" />
        <Text style={s.saveBtnText}>New capsule</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 48 },

  pageHeader: { gap: 4, marginBottom: 4 },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerTitle: { fontSize: 22, fontWeight: "600" },
  headerDetail: { fontSize: 13, lineHeight: 19 },

  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  backText: { fontSize: 15, fontWeight: "600" },

  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, marginBottom: 4 },
  bodyText: { fontSize: 14, lineHeight: 20 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
  },
  textArea: { height: 60, textAlignVertical: "top" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },

  itemGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  itemChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 2,
  },
  itemChipText: { fontSize: 13, fontWeight: "600" },
  itemChipMeta: { fontSize: 11 },

  itemPickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickerChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 2,
    minWidth: "45%",
    flex: 1,
  },
  pickerChipText: { fontSize: 13, fontWeight: "600" },
  pickerChipMeta: { fontSize: 11 },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
  },
  deleteBtnText: { fontWeight: "600", fontSize: 14 },

  formulaBlock: { marginTop: 10, gap: 6 },
  formulaRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  formulaLabel: { fontSize: 12, fontWeight: "700", width: 80 },
  formulaValue: { fontSize: 12, flex: 1, lineHeight: 16 },

  // Challenge
  challengeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  challengeTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  challengeRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 8,
  },
  challengeStat: { alignItems: "center", gap: 2 },
  challengeValue: { fontSize: 24, fontWeight: "600" },
  challengeLabel: { fontSize: 11 },
  challengeHint: { fontSize: 12, marginTop: 6 },

  challengeToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  challengeToggleCopy: { flex: 1, gap: 2 },
  toggleBtn: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  toggleBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },

  errorText: { fontSize: 13, marginTop: 6 },
  successText: { fontSize: 13, marginTop: 6, fontWeight: "600" },

  // Suggestions
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  suggestionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionCopy: { flex: 1, gap: 2 },
  suggestionName: { fontSize: 14, fontWeight: "600" },
  suggestionReason: { fontSize: 12 },
  applyBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  applyBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 12 },

  // Capsule list card
  capsuleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  capsuleCardTitles: { flex: 1, gap: 2 },
  capsuleName: { fontSize: 15, fontWeight: "600" },
  capsuleMeta: { fontSize: 12 },
  capsuleScores: { alignItems: "center" },
  capsuleScore: { fontSize: 22, fontWeight: "600" },
  capsuleScoreLabel: { fontSize: 10 },
  challengePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  challengePillText: { fontSize: 12, fontWeight: "600" },

  // Empty
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});
