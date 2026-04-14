"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@household/types";
import { hasSupabasePublicEnv, resolveSupabasePublicEnv } from "@household/supabase";

let browserClient: SupabaseClient<Database> | null = null;

export function getWebSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const env = resolveSupabasePublicEnv("web", {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_KEY,
    NEXT_PUBLIC_DEFAULT_CURRENCY: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY
  });

  if (!hasSupabasePublicEnv(env)) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(env.url!, env.publishableKey!);
  }

  return browserClient;
}
