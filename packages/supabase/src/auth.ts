import type {
  AuthSessionSnapshot,
  Database,
  LedgerOverviewCounts,
  Profile,
  ProfileSettingsFormValues,
  SupabasePublicEnv
} from "@household/types";
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@household/config";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

type RuntimeEnv = Record<string, string | undefined>;

function mapProfile(row: Database["public"]["Tables"]["profiles"]["Row"]): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name ?? "",
    defaultCurrency: row.default_currency,
    locale: row.locale,
    weekStartsOn: row.week_starts_on,
    monthStartDay: row.month_start_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function resolveSupabasePublicEnv(
  target: "web" | "mobile",
  env: RuntimeEnv
): SupabasePublicEnv {
  const isWeb = target === "web";
  const url = isWeb ? env.NEXT_PUBLIC_SUPABASE_URL : env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = isWeb
    ? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      env.NEXT_PUBLIC_SUPABASE_KEY
    : env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      env.EXPO_PUBLIC_SUPABASE_KEY;

  return {
    url,
    publishableKey,
    defaultCurrency: (isWeb
      ? env.NEXT_PUBLIC_DEFAULT_CURRENCY
      : env.EXPO_PUBLIC_DEFAULT_CURRENCY) ?? DEFAULT_CURRENCY,
    locale: DEFAULT_LOCALE
  };
}

export function hasSupabasePublicEnv(config: SupabasePublicEnv): boolean {
  return Boolean(config.url && config.publishableKey);
}

export function buildMissingSupabaseEnvMessage(target: "web" | "mobile"): string {
  return target === "web"
    ? "\uC6F9\uC6A9 Supabase \uD658\uACBD\uBCC0\uC218\uAC00 \uC544\uC9C1 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."
    : "\uBAA8\uBC14\uC77C\uC6A9 Supabase \uD658\uACBD\uBCC0\uC218\uAC00 \uC544\uC9C1 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";
}

export async function signInWithEmail(
  client: SupabaseClient<Database>,
  email: string,
  password: string
) {
  return client.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle(
  client: SupabaseClient<Database>,
  redirectTo?: string,
  skipBrowserRedirect = false
) {
  return client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect
    }
  });
}

export async function signUpWithEmail(
  client: SupabaseClient<Database>,
  email: string,
  password: string,
  displayName?: string
) {
  return client.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName ?? ""
      }
    }
  });
}

export async function signOut(client: SupabaseClient<Database>) {
  return client.auth.signOut();
}

export function toAuthSessionSnapshot(
  source: AuthSessionSnapshot["source"],
  hasEnv: boolean,
  session: Session | null,
  user?: User | null
): AuthSessionSnapshot {
  const sessionUser = user ?? session?.user ?? null;

  return {
    source,
    hasEnv,
    isAuthenticated: Boolean(sessionUser),
    userId: sessionUser?.id ?? null,
    email: sessionUser?.email ?? null
  };
}

export async function fetchLedgerOverviewCounts(
  client: SupabaseClient<Database>
): Promise<LedgerOverviewCounts> {
  const [{ count: accounts }, { count: categories }, { count: transactions }, { count: budgets }] =
    await Promise.all([
      client.from("accounts").select("*", { count: "exact", head: true }),
      client.from("categories").select("*", { count: "exact", head: true }),
      client
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      client.from("budgets").select("*", { count: "exact", head: true })
    ]);

  return {
    accounts: accounts ?? 0,
    categories: categories ?? 0,
    transactions: transactions ?? 0,
    budgets: budgets ?? 0
  };
}

export async function fetchProfile(client: SupabaseClient<Database>): Promise<Profile | null> {
  const { data, error } = await client.from("profiles").select("*").maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfile(data) : null;
}

export async function saveProfileSettings(
  client: SupabaseClient<Database>,
  userId: string,
  values: ProfileSettingsFormValues
): Promise<Profile> {
  const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
    user_id: userId,
    display_name: values.displayName || null,
    default_currency: values.defaultCurrency,
    locale: "ko-KR",
    week_starts_on: values.weekStartsOn,
    month_start_day: values.monthStartDay
  };

  const { data, error } = await client
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}
