import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import type { WeatherSnapshot } from "@/lib/wardrobe";

const BRIEFING_ID = "morning-briefing";
const STORAGE_KEY = "morning_briefing_time";

/**
 * Request notification permission from the user.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Schedule (or reschedule) the daily morning briefing notification.
 * Cancels any previously scheduled briefing first.
 */
export async function scheduleMorningBriefing(
  hour: number,
  minute: number,
  title: string,
  body: string,
): Promise<string> {
  await Notifications.cancelScheduledNotificationAsync(BRIEFING_ID).catch(
    () => undefined,
  );

  return Notifications.scheduleNotificationAsync({
    identifier: BRIEFING_ID,
    content: { title, body, sound: true },
    trigger: {
      hour,
      minute,
      repeats: true,
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
    },
  });
}

/**
 * Cancel the daily morning briefing notification.
 */
export async function cancelMorningBriefing(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BRIEFING_ID).catch(
    () => undefined,
  );
}

/**
 * Build the notification title and body from an outfit name and weather snapshot.
 */
export function buildBriefingContent(
  outfitName: string,
  weather: WeatherSnapshot,
): { title: string; body: string } {
  return {
    title: "👗 Today's Outfit Ready",
    body: `${outfitName} · ${weather.temperatureC}°C, ${weather.condition}`,
  };
}

/**
 * Read the saved morning briefing time from AsyncStorage.
 * Returns null if no time has been saved yet.
 */
export async function getMorningBriefingTime(): Promise<{
  hour: number;
  minute: number;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { hour: number; minute: number };
  } catch {
    return null;
  }
}

/**
 * Persist the chosen morning briefing time to AsyncStorage.
 */
export async function saveMorningBriefingTime(
  hour: number,
  minute: number,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ hour, minute }));
}
