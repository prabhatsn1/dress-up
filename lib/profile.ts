import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/wardrobe";

const PROFILE_KEY = "user_profile_v1";
const ONBOARDING_KEY = "onboarding_completed_v1";

export async function isOnboardingCompleted(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === "true";
}

export async function markOnboardingCompleted(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}

export async function loadProfile(): Promise<UserProfile | null> {
  // Try Supabase first when authenticated
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (userId) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (!error && data) {
          return {
            name: data.name,
            gender: data.gender,
            height: data.height ?? undefined,
            bodyShape: data.body_shape ?? undefined,
            skinTone: data.skin_tone ?? undefined,
            stylePreferences: data.style_preferences ?? [],
            occasionPreference: data.occasion_preference,
          } as UserProfile;
        }
      }
    } catch {
      // Fall through to local storage
    }
  }

  // Local fallback
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  // Always persist locally for offline support
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (userId) {
        await supabase.from("profiles").upsert({
          id: userId,
          name: profile.name,
          gender: profile.gender,
          height: profile.height ?? null,
          body_shape: profile.bodyShape ?? null,
          skin_tone: profile.skinTone ?? null,
          style_preferences: profile.stylePreferences,
          occasion_preference: profile.occasionPreference,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        });
      }
    } catch {
      // Supabase error is non-fatal; local save already completed
    }
  }
}
