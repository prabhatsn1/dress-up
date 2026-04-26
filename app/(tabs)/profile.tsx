import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppCard, Chip, SectionTitle } from '@/components/wardrobe-ui';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { userProfile } from '@/lib/wardrobe';
import { useAppData } from '@/providers/app-data-provider';

export default function ProfileScreen() {
  const [localOnly, setLocalOnly] = useState(true);
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(true);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const border = useThemeColor({}, 'border');
  const warm = useThemeColor({}, 'accentWarm');
  const cool = useThemeColor({}, 'accentCool');
  const danger = useThemeColor({}, 'danger');
  const { supabaseConfigured, weather, wardrobeSource, lastSyncMessage } = useAppData();

  return (
    <ScrollView style={[styles.screen, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <SectionTitle
        eyebrow="Personalization"
        title="Profile and privacy"
        detail="Recommendations stay explainable because profile, weather, and feedback signals are all visible."
      />

      <AppCard accent={warm}>
        <Text style={[styles.profileName, { color: text }]}>{userProfile.name}</Text>
        <Text style={[styles.profileMeta, { color: muted }]}>
          {userProfile.gender} · {userProfile.height} · {userProfile.skinTone}
        </Text>

        <View style={styles.preferenceBlock}>
          <Text style={[styles.blockTitle, { color: text }]}>Style preferences</Text>
          <View style={styles.chipRow}>
            {userProfile.stylePreferences.map((style) => (
              <Chip key={style} label={style} active />
            ))}
          </View>
        </View>

        <View style={styles.preferenceBlock}>
          <Text style={[styles.blockTitle, { color: text }]}>Occasion profile</Text>
          <Text style={[styles.profileMeta, { color: muted }]}>
            {userProfile.occasionPreference.replace('-', ' ')} wardrobe weighting
          </Text>
        </View>
      </AppCard>

      <AppCard accent={cool}>
        <Text style={[styles.blockTitle, { color: text }]}>Recommendation inputs</Text>
        <View style={styles.ruleList}>
          {[
            'Profile data tunes formality and styling bias.',
            'Weather changes fabric, layering, and shoe safety choices.',
            'Feedback shifts future ranking without deleting rules.',
          ].map((line) => (
            <Text key={line} style={[styles.ruleText, { color: muted }]}>
              • {line}
            </Text>
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.blockTitle, { color: text }]}>Live integrations</Text>
        <View style={styles.ruleList}>
          <Text style={[styles.ruleText, { color: muted }]}>
            • Weather source: {weather.source ?? 'unknown'} for {weather.location} at {weather.temperatureC}C.
          </Text>
          <Text style={[styles.ruleText, { color: muted }]}>
            • Feels like {weather.feelsLikeC ?? weather.temperatureC}C, humidity {weather.humidity ?? 'n/a'}%, wind {weather.windKph ?? 'n/a'} kph.
          </Text>
          <Text style={[styles.ruleText, { color: muted }]}>
            • Wardrobe sync: {supabaseConfigured ? wardrobeSource : 'local-only mode'}.
          </Text>
          <Text style={[styles.ruleText, { color: muted }]}>
            • Supabase keys: {supabaseConfigured ? 'configured' : 'missing from Expo public env'}.
          </Text>
          {lastSyncMessage ? <Text style={[styles.ruleText, { color: muted }]}>• {lastSyncMessage}</Text> : null}
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.blockTitle, { color: text }]}>Privacy controls</Text>
        <View style={styles.toggleList}>
          <View style={[styles.toggleRow, { borderColor: border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: text }]}>Local-only image processing</Text>
              <Text style={[styles.toggleMeta, { color: muted }]}>
                Keep wardrobe photos on-device whenever supported.
              </Text>
            </View>
            <Switch value={localOnly} onValueChange={setLocalOnly} />
          </View>

          <View style={[styles.toggleRow, { borderColor: border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: text }]}>Cloud backup</Text>
              <Text style={[styles.toggleMeta, { color: muted }]}>
                Sync processed metadata and outfit plans across devices.
              </Text>
            </View>
            <Switch value={backupEnabled} onValueChange={setBackupEnabled} />
          </View>

          <View style={[styles.toggleRow, { borderColor: border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: text }]}>Weather-aware suggestions</Text>
              <Text style={[styles.toggleMeta, { color: muted }]}>
                Use location to adapt fabrics, layering, and rain-safe shoes.
              </Text>
            </View>
            <Switch value={weatherEnabled} onValueChange={setWeatherEnabled} />
          </View>
        </View>
      </AppCard>

      <AppCard accent={danger}>
        <Text style={[styles.blockTitle, { color: text }]}>Data ownership</Text>
        <Text style={[styles.profileMeta, { color: muted }]}>
          Delete wardrobe images, profile data, and recommendation history from one place. Export of tags
          and outfit history should be available before destructive actions.
        </Text>
        <View style={styles.deletePanel}>
          <Text style={[styles.deleteTitle, { color: danger }]}>Delete account and all wardrobe data</Text>
          <Text style={[styles.toggleMeta, { color: muted }]}>
            Recommended safeguard: 7-day recovery hold plus explicit confirmation.
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
    fontWeight: '700',
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
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  toggleMeta: {
    fontSize: 13,
    lineHeight: 19,
  },
  deletePanel: {
    borderRadius: 18,
    backgroundColor: 'rgba(155, 65, 65, 0.08)',
    padding: 14,
    gap: 4,
  },
  deleteTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
});
