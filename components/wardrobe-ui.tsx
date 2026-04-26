import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export function SectionTitle({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.eyebrow, { color: muted }]}>{eyebrow}</Text>
      <Text style={[styles.sectionTitle, { color: text }]}>{title}</Text>
      {detail ? <Text style={[styles.sectionDetail, { color: muted }]}>{detail}</Text> : null}
    </View>
  );
}

export function AppCard({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: string;
}) {
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');

  return (
    <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
      {accent ? <View style={[styles.cardAccent, { backgroundColor: accent }]} /> : null}
      {children}
    </View>
  );
}

export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const surface = useThemeColor({}, 'surface');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const tint = useThemeColor({}, 'tint');

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? tint : surface,
          borderColor: active ? tint : muted,
        },
      ]}>
      <Text style={[styles.chipText, { color: active ? '#fff9f3' : text }]}>{label}</Text>
    </Pressable>
  );
}

export function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  const surface = useThemeColor({}, 'surface');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  return (
    <View style={[styles.metricCard, { backgroundColor: surface }]}>
      <View style={[styles.metricDot, { backgroundColor: tone }]} />
      <Text style={[styles.metricValue, { color: text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

export function ColorSwatch({ colour }: { colour: string }) {
  return <View style={[styles.colourSwatch, { backgroundColor: colorMap[colour] ?? '#b69d88' }]} />;
}

const colorMap: Record<string, string> = {
  blue: '#5b82c8',
  white: '#efe8dc',
  beige: '#d8c09b',
  black: '#38312d',
  emerald: '#3d8967',
  grey: '#9da1aa',
  charcoal: '#63636f',
  cream: '#eee0c9',
  brown: '#8f6244',
  tan: '#cda078',
  gold: '#d6b15b',
  olive: '#6d7b4e',
};

const styles = StyleSheet.create({
  sectionHeader: {
    gap: 4,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  sectionDetail: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    overflow: 'hidden',
  },
  cardAccent: {
    height: 4,
    borderRadius: 999,
    marginBottom: 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricCard: {
    flex: 1,
    minWidth: 96,
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  metricDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  colourSwatch: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
});
