import type { Session } from "@supabase/supabase-js";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from "@react-navigation/native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "react-native-reanimated";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { onAuthStateChange } from "@/lib/auth";
import { isOnboardingCompleted } from "@/lib/profile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { AppDataProvider } from "@/providers/app-data-provider";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [session, setSession] = useState<Session | null | undefined>(undefined);

  // Navigate to the Today tab when the user taps the morning briefing notification
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (response.notification.request.identifier === "morning-briefing") {
          router.replace("/(tabs)");
        }
      },
    );
    return () => subscription.remove();
  }, []);

  // Handle magic link deep link — extract tokens from URL fragment and set session
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    async function handleUrl(url: string) {
      const parsed = Linking.parse(url);
      const fragment = (parsed as unknown as { fragment?: string }).fragment ?? "";
      const params = Object.fromEntries(new URLSearchParams(fragment));
      if (params.access_token && params.refresh_token) {
        await supabase!.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      }
    }

    // Cold start: app opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });

    // Warm start: deep link arrives while app is open
    const sub = Linking.addEventListener("url", ({ url }) => void handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No auth configured — skip the gate entirely
      setSession(null as unknown as Session);
      isOnboardingCompleted().then((done) => {
        if (!done) router.replace("/onboarding");
      });
      return;
    }

    const { data } = onAuthStateChange(async (s) => {
      setSession(s);

      if (s) {
        const done = await isOnboardingCompleted();
        if (!done) {
          router.replace("/onboarding");
        } else {
          router.replace("/(tabs)");
        }
      } else {
        router.replace("/(auth)/sign-in");
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const navigationTheme: Theme =
    colorScheme === "dark"
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

  if (session === undefined) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <AppDataProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Privacy Notes" }}
          />
        </Stack>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </AppDataProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
