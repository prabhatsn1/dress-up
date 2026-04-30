import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export async function signInWithEmail(
  email: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const { error } = await supabase.auth.signInWithOtp({ email });

  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };

  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
