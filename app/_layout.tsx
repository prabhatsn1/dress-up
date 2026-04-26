import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppDataProvider } from '@/providers/app-data-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const navigationTheme: Theme =
    colorScheme === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: Colors.dark.background,
            card: Colors.dark.surface,
            text: Colors.dark.text,
            border: Colors.dark.border,
            primary: Colors.dark.tint,
            notification: Colors.dark.accentWarm,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: Colors.light.background,
            card: Colors.light.surface,
            text: Colors.light.text,
            border: Colors.light.border,
            primary: Colors.light.tint,
            notification: Colors.light.accentWarm,
          },
        };

  return (
    <ThemeProvider value={navigationTheme}>
      <AppDataProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Privacy Notes' }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </AppDataProvider>
    </ThemeProvider>
  );
}
