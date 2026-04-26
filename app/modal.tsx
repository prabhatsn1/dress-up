import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/wardrobe-ui';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ModalScreen() {
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const warm = useThemeColor({}, 'accentWarm');

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <AppCard accent={warm}>
        <Text style={[styles.title, { color: text }]}>Privacy-first principles</Text>
        <Text style={[styles.body, { color: muted }]}>
          Wardrobe photos should be encrypted at rest, deleted on demand, and processed on-device when
          possible. Recommendation explanations should always tell the user which inputs influenced the result.
        </Text>
        <Link href="/" dismissTo style={styles.link}>
          <Text style={[styles.linkText, { color: warm }]}>Return to the app</Text>
        </Link>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
