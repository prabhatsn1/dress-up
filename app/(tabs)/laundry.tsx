import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useMemo } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppData } from "@/providers/app-data-provider";
import type { WardrobeItem } from "@/lib/wardrobe";

type Category = WardrobeItem["category"];

const CATEGORY_ORDER: Category[] = [
  "Top",
  "Bottom",
  "Outerwear",
  "Shoes",
  "Accessory",
];

const CATEGORY_LABEL: Record<Category, string> = {
  Top: "Tops",
  Bottom: "Bottoms",
  Outerwear: "Outerwear",
  Shoes: "Shoes",
  Accessory: "Accessories",
};

export default function LaundryScreen() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const { dirtyItems, markItemClean, markAllClean } = useAppData();

  const grouped = useMemo(() => {
    const map = new Map<Category, WardrobeItem[]>();
    for (const cat of CATEGORY_ORDER) {
      const group = dirtyItems.filter((i) => i.category === cat);
      if (group.length > 0) map.set(cat, group);
    }
    return Array.from(map.entries());
  }, [dirtyItems]);

  function handleMarkClean(item: WardrobeItem) {
    void markItemClean(item.id);
  }

  function handleMarkAll() {
    Alert.alert(
      "Mark all clean?",
      `This will clear all ${dirtyItems.length} items from your laundry pile.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark all clean",
          style: "default",
          onPress: () => void markAllClean(),
        },
      ],
    );
  }

  const s = styles(colors);

  if (dirtyItems.length === 0) {
    return (
      <View style={s.emptyContainer}>
        <MaterialIcons
          name="local-laundry-service"
          size={72}
          color={colors.muted}
        />
        <Text style={s.emptyTitle}>All done!</Text>
        <Text style={s.emptyBody}>
          Your wardrobe is clean. Items you wear will appear here so you can
          track what needs washing.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Laundry Pile</Text>
          <Text style={s.headerSub}>
            {dirtyItems.length} item{dirtyItems.length !== 1 ? "s" : ""} to wash
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleMarkAll}
          style={s.clearBtn}
          activeOpacity={0.75}
        >
          <MaterialIcons name="done-all" size={16} color={colors.success} />
          <Text style={s.clearBtnLabel}>Mark all clean</Text>
        </TouchableOpacity>
      </View>

      {/* Grouped list */}
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {grouped.map(([category, categoryItems]) => (
          <View key={category} style={s.section}>
            <Text style={s.sectionTitle}>{CATEGORY_LABEL[category]}</Text>
            {categoryItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                colors={colors}
                onMarkClean={() => handleMarkClean(item)}
              />
            ))}
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Item row ────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: WardrobeItem;
  colors: (typeof Colors)["light"];
  onMarkClean: () => void;
}

function ItemRow({ item, colors, onMarkClean }: ItemRowProps) {
  const s = itemRowStyles(colors);

  return (
    <View style={s.row}>
      {/* Thumbnail */}
      <View style={s.thumb}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={s.thumbImage}
            contentFit="cover"
          />
        ) : (
          <View style={s.thumbPlaceholder}>
            <MaterialIcons name="checkroom" size={22} color={colors.muted} />
          </View>
        )}
        {/* Dirty badge */}
        <View style={s.dirtyBadge}>
          <MaterialIcons name="water-drop" size={10} color="#fff" />
        </View>
      </View>

      {/* Info */}
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {item.subcategory}
          {item.colours.length > 0 ? ` · ${item.colours[0]}` : ""}
        </Text>
      </View>

      {/* Mark clean */}
      <TouchableOpacity
        onPress={onMarkClean}
        style={s.cleanBtn}
        activeOpacity={0.75}
      >
        <MaterialIcons
          name="check-circle-outline"
          size={20}
          color={colors.success}
        />
        <Text style={s.cleanBtnLabel}>Clean</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const THUMB = 60;

function styles(colors: (typeof Colors)["light"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "ios" ? 60 : 40,
      paddingBottom: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "600",
      color: colors.text,
    },
    headerSub: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
    },
    clearBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.success,
    },
    clearBtnLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.success,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.muted,
      marginBottom: 8,
      marginLeft: 4,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 40,
      backgroundColor: colors.background,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.text,
    },
    emptyBody: {
      fontSize: 14,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
  });
}

function itemRowStyles(colors: (typeof Colors)["light"]) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 10,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 12,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
    },
    thumbImage: {
      width: THUMB,
      height: THUMB,
    },
    thumbPlaceholder: {
      width: THUMB,
      height: THUMB,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    dirtyBadge: {
      position: "absolute",
      bottom: 3,
      right: 3,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "#3b82f6",
      alignItems: "center",
      justifyContent: "center",
    },
    info: {
      flex: 1,
      gap: 3,
    },
    name: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    meta: {
      fontSize: 12,
      color: colors.muted,
      textTransform: "capitalize",
    },
    cleanBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.success,
    },
    cleanBtnLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.success,
    },
  });
}
