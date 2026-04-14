import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthSessionSnapshot, Database } from "@household/types";
import {
  hasSupabasePublicEnv,
  resolveSupabasePublicEnv,
  toAuthSessionSnapshot
} from "@household/supabase";

export async function getWebSupabaseServerClient(): Promise<SupabaseClient<Database> | null> {
  const env = resolveSupabasePublicEnv("web", process.env as Record<string, string | undefined>);

  if (!hasSupabasePublicEnv(env)) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url!, env.publishableKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components in the initial draft may not be allowed to write cookies.
        }
      }
    }
  });
}

export async function getWebServerSessionSnapshot(): Promise<AuthSessionSnapshot> {
  const env = resolveSupabasePublicEnv("web", process.env as Record<string, string | undefined>);
  const hasEnv = hasSupabasePublicEnv(env);

  if (!hasEnv) {
    return toAuthSessionSnapshot("server", false, null, null);
  }

  const client = await getWebSupabaseServerClient();

  if (!client) {
    return toAuthSessionSnapshot("server", false, null, null);
  }

  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    client.auth.getSession(),
    client.auth.getUser()
  ]);

  return toAuthSessionSnapshot("server", true, sessionData.session, userData.user);
}

