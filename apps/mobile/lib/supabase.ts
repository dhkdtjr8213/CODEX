import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@household/types";
import { hasSupabasePublicEnv, resolveSupabasePublicEnv } from "@household/supabase";

let mobileClient: SupabaseClient<Database> | null = null;

export function getMobileSupabaseClient(): SupabaseClient<Database> | null {
  const env = resolveSupabasePublicEnv("mobile", process.env as Record<string, string | undefined>);

  if (!hasSupabasePublicEnv(env)) {
    return null;
  }

  if (!mobileClient) {
    mobileClient = createClient<Database>(env.url!, env.publishableKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
  }

  return mobileClient;
}

