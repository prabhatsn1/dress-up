import { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";

import { AppCard, Chip, SectionTitle } from "@/components/wardrobe-ui";
import { WearStats } from "@/components/wear-stats";
import { Fonts } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  cancelMorningBriefing,
  getMorningBriefingTime,
  requestNotificationPermission,
  saveMorningBriefingTime,
  scheduleMorningBriefing,
  buildBriefingContent,
} from "@/lib/notifications";
import { useAppData } from "@/providers/app-data-provider";

export default function ProfileScreen() {
  const [localOnly, setLocalOnly] = useState(true);
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [briefingHour, setBriefingHour] = useState(8);
  const [briefingMinute, setBriefingMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingHour, setPendingHour] = useState(8);
  const [pendingMinute, setPendingMinute] = useState(0);

  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const border = useThemeColor({}, "border");
  const warm = useThemeColor({}, "accentWarm");
  const cool = useThemeColor({}, "accentCool");
  const danger = useThemeColor({}, "danger");
  const {
    supabaseConfigured,
    weather,
    wardrobeSource,
    lastSyncMessage,
    items,
    profile,
  } = useAppData();

  async function handleNotificationsToggle(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "To receive morning outfit briefings, please enable notifications for this app in your device Settings.",
          [{ text: "OK" }],
        );
        return;
      }
      // Load previously saved time (default 08:00)
      const saved = await getMorningBriefingTime();
      const h = saved?.hour ?? 8;
      const m = saved?.minute ?? 0;
      setPendingHour(h);
      setPendingMinute(m);
      setShowTimePicker(true);
    } else {
      await cancelMorningBriefing();
      setNotificationsOn(false);
    }
  }

  async function confirmTimePicker() {
    await saveMorningBriefingTime(pendingHour, pendingMinute);
    const { title, body } = buildBriefingContent("Your outfit", weather);
    await scheduleMorningBriefing(pendingHour, pendingMinute, title, body);
    setBriefingHour(pendingHour);
    setBriefingMinute(pendingMinute);
    setNotificationsOn(true);
    setShowTimePicker(false);
  }

  function dismissTimePicker() {
    setShowTimePicker(false);
  }

  const briefingTimeLabel = `${String(briefingHour).padStart(2, "0")}:${String(briefingMinute).padStart(2, "0")}`;

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: background }]}
      contentContainerStyle={styles.content}
    >
      <SectionTitle
        eyebrow="Personalization"
        title="Profile and privacy"
        detail="Recommendations stay explainable because profile, weather, and feedback signals are all visible."
      />

      <AppCard accent={warm}>
        <View style={styles.profileHeaderRow}>
          <View style={styles.profileHeaderText}>
            <Text style={[styles.profileName, { color: text }]}>
              {profile.name}
            </Text>
            <Text style={[styles.profileMeta, { color: muted }]}>
              {profile.gender}
              {profile.height ? ` · ${profile.height}` : ""}
              {profile.bodyShape ? ` · ${profile.bodyShape}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.editButton, { borderColor: warm }]}
            onPress={() =>
              router.push({ pathname: "/onboarding", params: { mode: "edit" } })
            }
            activeOpacity={0.7}
          >
            <Text style={[styles.editButtonText, { color: warm }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.preferenceBlock}>
          <Text style={[styles.blockTitle, { color: text }]}>
            Style preferences
          </Text>
          <View style={styles.chipRow}>
            {profile.stylePreferences.map((style) => (
              <Chip key={style} label={style} active />
            ))}
          </View>
        </View>

        <View style={styles.preferenceBlock}>
          <Text style={[styles.blockTitle, { color: text }]}>
            Occasion profile
          </Text>
          <Text style={[styles.profileMeta, { color: muted }]}>
            {profile.occasionPreference.replace("-", " ")} wardrobe weighting
          </Text>
        </View>
      </AppCard>

      <AppCard accent={cool}>
        <Text style={[styles.blockTitle, { color: text }]}>
          Recommendation inputs
        </Text>
        <View style={styles.ruleList}>
          {[
            "Profile data tunes formality and styling bias.",
            "Weather changes fabric, layering, and shoe safety choices.",
            "Feedback shifts future ranking without deleting rules.",
          ].map((line) => (
            <Text key={line} style={[styles.ruleText, { color: muted }]}>
              • {line}
            </Text>
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.blockTitle, { color: text }]}>
          Live integrations
        </Text>
        <View style={styles.ruleList}>
          <Text style={[styles.ruleText, { color: muted }]}>
            • Weather source: {weather.source ?? "unknown"} for{" "}
            {weather.location} at {weather.temperatureC}C.
          </Text>
          <Text style={[styles.ruleText, { color: muted }]}>
            • Feels like {weather.feelsLikeC ?? weather.temperatureC}C, humidity{" "}
            {weather.humidity ?? "n/a"}%, wind {weather.windKph ?? "n/a"} kph.
          </Text>
          <Text style={[styles.ruleText, { color: muted }]}>
            • Wardrobe sync:{" "}
            {supabaseConfigured ? wardrobeSource : "local-only mode"}.
          </Text>
          <Text style={[styles.ruleText, { color: muted }]}>
            • Supabase keys:{" "}
            {supabaseConfigured ? "configured" : "missing from Expo public env"}
            .
          </Text>
          {lastSyncMessage ? (
            <Text style={[styles.ruleText, { color: muted }]}>
              • {lastSyncMessage}
            </Text>
          ) : null}
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.blockTitle, { color: text }]}>
          Wardrobe Intelligence
        </Text>
        <WearStats items={items} />
      </AppCard>

      <AppCard>
        <Text style={[styles.blockTitle, { color: text }]}>
          Privacy controls
        </Text>
        <View style={styles.toggleList}>
          <View style={[styles.toggleRow, { borderColor: border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: text }]}>
                Local-only image processing
              </Text>
              <Text style={[styles.toggleMeta, { color: muted }]}>
                Keep wardrobe photos on-device whenever supported.
              </Text>
            </View>
            <Switch value={localOnly} onValueChange={setLocalOnly} />
          </View>

          <View style={[styles.toggleRow, { borderColor: border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: text }]}>
                Cloud backup
              </Text>
              <Text style={[styles.toggleMeta, { color: muted }]}>
                Sync processed metadata and outfit plans across devices.
              </Text>
            </View>
            <Switch value={backupEnabled} onValueChange={setBackupEnabled} />
          </View>

          <View style={[styles.toggleRow, { borderColor: border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: text }]}>
                Weather-aware suggestions
              </Text>
              <Text style={[styles.toggleMeta, { color: muted }]}>
                Use location to adapt fabrics, layering, and rain-safe shoes.
              </Text>
            </View>
            <Switch value={weatherEnabled} onValueChange={setWeatherEnabled} />
          </View>

          <View style={[styles.toggleRow, { borderColor: border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: text }]}>
                Morning outfit briefing
              </Text>
              <Text style={[styles.toggleMeta, { color: muted }]}>
                {notificationsOn
                  ? `Daily notification at ${briefingTimeLabel} with today's outfit and weather.`
                  : "Get a daily push notification with your AI-suggested outfit."}
              </Text>
            </View>
            <Switch
              value={notificationsOn}
              onValueChange={handleNotificationsToggle}
            />
          </View>
        </View>
      </AppCard>

      {/* Time-picker modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={dismissTimePicker}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: background, borderColor: border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: text }]}>
              Set briefing time
            </Text>

            <View style={styles.pickerRow}>
              {/* Hour picker */}
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: muted }]}>Hour</Text>
                <ScrollView
                  style={[styles.pickerScroll, { borderColor: border }]}
                  showsVerticalScrollIndicator={false}
                >
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.pickerItem,
                        pendingHour === h && { backgroundColor: warm + "33" },
                      ]}
                      onPress={() => setPendingHour(h)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          { color: pendingHour === h ? warm : text },
                        ]}
                      >
                        {String(h).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={[styles.pickerColon, { color: text }]}>:</Text>

              {/* Minute picker */}
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: muted }]}>Min</Text>
                <ScrollView
                  style={[styles.pickerScroll, { borderColor: border }]}
                  showsVerticalScrollIndicator={false}
                >
                  {MINUTES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.pickerItem,
                        pendingMinute === m && { backgroundColor: warm + "33" },
                      ]}
                      onPress={() => setPendingMinute(m)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          { color: pendingMinute === m ? warm : text },
                        ]}
                      >
                        {String(m).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: border }]}
                onPress={dismissTimePicker}
              >
                <Text style={[styles.modalBtnText, { color: muted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnConfirm,
                  { backgroundColor: warm },
                ]}
                onPress={confirmTimePicker}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AppCard accent={danger}>
        <Text style={[styles.blockTitle, { color: text }]}>Data ownership</Text>
        <Text style={[styles.profileMeta, { color: muted }]}>
          Delete wardrobe images, profile data, and recommendation history from
          one place. Export of tags and outfit history should be available
          before destructive actions.
        </Text>
        <View style={styles.deletePanel}>
          <Text style={[styles.deleteTitle, { color: danger }]}>
            Delete account and all wardrobe data
          </Text>
          <Text style={[styles.toggleMeta, { color: muted }]}>
            Recommended safeguard: 7-day recovery hold plus explicit
            confirmation.
          </Text>
        </View>
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  profileHeaderText: {
    flex: 1,
    gap: 4,
  },
  editButton: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
    gap: 18,
  },
  profileName: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: Fonts.serif,
    fontWeight: "700",
  },
  profileMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  preferenceBlock: {
    gap: 10,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ruleList: {
    gap: 10,
  },
  ruleText: {
    fontSize: 14,
    lineHeight: 21,
  },
  toggleList: {
    gap: 12,
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  toggleMeta: {
    fontSize: 13,
    lineHeight: 19,
  },
  deletePanel: {
    borderRadius: 18,
    backgroundColor: "rgba(155, 65, 65, 0.08)",
    padding: 14,
    gap: 4,
  },
  deleteTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  pickerColumn: {
    flex: 1,
    gap: 6,
    alignItems: "center",
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pickerScroll: {
    height: 160,
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
  },
  pickerItem: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  pickerItemText: {
    fontSize: 18,
    fontWeight: "500",
  },
  pickerColon: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalBtnConfirm: {
    borderWidth: 0,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
