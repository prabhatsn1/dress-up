import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { WeatherSnapshot } from "@/lib/wardrobe";

/** Whether notifications are actually usable in the current runtime */
const notificationsSupported = Platform.OS !== "android" || !__DEV__;

const BRIEFING_ID = "morning-briefing";
const STORAGE_KEY = "morning_briefing_time";

/**
 * Request notification permission from the user.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
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
  if (!notificationsSupported) return "";
  await Notifications.cancelScheduledNotificationAsync(BRIEFING_ID).catch(
    () => undefined,
  );

  return Notifications.scheduleNotificationAsync({
    identifier: BRIEFING_ID,
    content: { title, body, sound: true },
    trigger: {
      hour,
      minute,
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
    },
  });
}

/**
 * Cancel the daily morning briefing notification.
 */
export async function cancelMorningBriefing(): Promise<void> {
  if (!notificationsSupported) return;
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

// ─── Laundry reminder ───────────────────────────────────────────────────────

const LAUNDRY_ID = "laundry-reminder";

/**
 * Schedule a one-time laundry reminder for 8 pm tonight.
 * Replaces any previously scheduled laundry reminder.
 *
 * @param dirtyCount - number of items currently in the laundry pile
 */
export async function scheduleLaundryReminder(
  dirtyCount: number,
): Promise<void> {
  if (!notificationsSupported) return;
  await Notifications.cancelScheduledNotificationAsync(LAUNDRY_ID).catch(
    () => undefined,
  );

  const body =
    dirtyCount === 1
      ? "You have 1 item waiting to be washed."
      : `You have ${dirtyCount} items waiting to be washed.`;

  const now = new Date();
  const trigger = new Date(now);
  trigger.setHours(20, 0, 0, 0);

  // If 8 pm has already passed today, fire tomorrow
  if (trigger <= now) {
    trigger.setDate(trigger.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: LAUNDRY_ID,
    content: {
      title: "🧺 Laundry reminder",
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
    },
  });
}

/**
 * Cancel any pending laundry reminder (e.g., after all items are marked clean).
 */
export async function cancelLaundryReminder(): Promise<void> {
  if (!notificationsSupported) return;
  await Notifications.cancelScheduledNotificationAsync(LAUNDRY_ID).catch(
    () => undefined,
  );
}
