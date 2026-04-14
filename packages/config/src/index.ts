import type { CurrencyCode } from "@household/types";

export const APP_NAME = "\uAE30\uB85D\uAC00\uACC4\uBD80";
export const DEFAULT_LOCALE = "ko-KR";
export const DEFAULT_CURRENCY: CurrencyCode = "KRW";

export const SUPABASE_ENV_KEYS = {
  web: {
    url: "NEXT_PUBLIC_SUPABASE_URL",
    publishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    anonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  },
  mobile: {
    url: "EXPO_PUBLIC_SUPABASE_URL",
    publishableKey: "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    anonKey: "EXPO_PUBLIC_SUPABASE_ANON_KEY"
  }
} as const;

export const MVP_DOMAINS = [
  "user",
  "profile",
  "account",
  "category",
  "transaction",
  "budget",
  "recurring_transaction"
] as const;

export const ACCOUNT_TYPE_OPTIONS = [
  { value: "cash", label: "\uD604\uAE08" },
  { value: "bank", label: "\uC740\uD589" },
  { value: "card", label: "\uCE74\uB4DC" },
  { value: "investment", label: "\uD22C\uC790" },
  { value: "other", label: "\uAE30\uD0C0" }
] as const;

export const TRANSACTION_TYPE_OPTIONS = [
  { value: "expense", label: "\uC9C0\uCD9C" },
  { value: "income", label: "\uC218\uC785" },
  { value: "transfer", label: "\uC774\uCCB4" }
] as const;

export const CATEGORY_KIND_OPTIONS = [
  { value: "expense", label: "\uC9C0\uCD9C" },
  { value: "income", label: "\uC218\uC785" }
] as const;

export const RECURRING_FREQUENCY_OPTIONS = [
  { value: "monthly", label: "\uB9E4\uC6D4" }
] as const;

export const CURRENCY_OPTIONS = [
  { value: "KRW", label: "\uD55C\uAD6D \uC6D0 (KRW)" }
] as const;

export const WEEK_START_OPTIONS = [
  { value: 1, label: "\uC6D4\uC694\uC77C \uC2DC\uC791" },
  { value: 0, label: "\uC77C\uC694\uC77C \uC2DC\uC791" }
] as const;

export const PERIOD_PRESET_OPTIONS = [
  { value: "this_month", label: "\uC774\uBC88 \uB2EC" },
  { value: "last_3_months", label: "\uCD5C\uADFC 3\uAC1C\uC6D4" },
  { value: "this_year", label: "\uC62C\uD574" },
  { value: "all", label: "\uC804\uCCB4" },
  { value: "custom", label: "\uC9C1\uC811 \uC120\uD0DD" }
] as const;
