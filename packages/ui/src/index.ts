import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@household/config";
import dayjs from "dayjs";

export const colors = {
  background: "#f6f2ea",
  surface: "#fffdf8",
  foreground: "#1f1a17",
  muted: "#6a5f58",
  accent: "#1c7c54",
  income: "#197278",
  expense: "#c44536",
  border: "#e9dfd2"
} as const;

export const kpiToneTokens = {
  normal: {
    text: colors.foreground,
    surface: "#ffffff",
    border: colors.border
  },
  success: {
    text: "#12724f",
    surface: "#ecf9f2",
    border: "#b7e6cd"
  },
  danger: {
    text: "#b42318",
    surface: "#fff1f0",
    border: "#f1c0bc"
  }
} as const;

export const monthlyInsightCopy = {
  sectionTitle: "월간 인사이트 Top 3",
  budgetOverrunTitle: "예산 초과 카테고리 Top 3",
  budgetOverrunEmpty: "이번 달 예산 초과 카테고리가 없습니다. 좋은 흐름이에요.",
  topExpenseTitle: "지출 비중 상위 카테고리",
  topExpenseEmpty: "지출 데이터가 쌓이면 핵심 카테고리 분석이 표시됩니다."
} as const;

export type RecurringFailureKind = "permission" | "network" | "input" | "other";

const recurringFailureKindLabel: Record<RecurringFailureKind, string> = {
  permission: "권한",
  network: "네트워크",
  input: "입력값",
  other: "기타"
};

export function classifyRecurringFailureReason(reason: string | null | undefined): {
  kind: RecurringFailureKind;
  label: string;
} {
  const normalized = reason?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return {
      kind: "other",
      label: recurringFailureKindLabel.other
    };
  }

  const permissionKeywords = [
    "permission",
    "forbidden",
    "unauthorized",
    "not authorized",
    "denied",
    "rls",
    "policy",
    "권한",
    "인가",
    "인증"
  ];
  if (permissionKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      kind: "permission",
      label: recurringFailureKindLabel.permission
    };
  }

  const networkKeywords = [
    "timeout",
    "timed out",
    "network",
    "connection",
    "socket",
    "gateway",
    "fetch",
    "dns",
    "econn",
    "네트워크",
    "연결",
    "타임아웃"
  ];
  if (networkKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      kind: "network",
      label: recurringFailureKindLabel.network
    };
  }

  const inputKeywords = [
    "invalid",
    "validation",
    "required",
    "constraint",
    "format",
    "must be",
    "입력",
    "유효",
    "누락",
    "형식",
    "잘못"
  ];
  if (inputKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      kind: "input",
      label: recurringFailureKindLabel.input
    };
  }

  return {
    kind: "other",
    label: recurringFailureKindLabel.other
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatMonthLabel(month: string): string {
  return `${month} 월`;
}

export function sanitizeAmountInput(value: string): string {
  const digitsOnly = value.replace(/[^\d]/g, "");

  if (!digitsOnly) {
    return "";
  }

  return Number(digitsOnly).toLocaleString(DEFAULT_LOCALE);
}

export function parseAmountInput(value: string): number {
  const normalized = value.replaceAll(",", "");
  return normalized ? Number(normalized) : 0;
}

export function formatDateLabel(value: string): string {
  return dayjs(value).isValid() ? dayjs(value).format("YYYY.MM.DD") : value;
}

export function getTodayInputValue(): string {
  return dayjs().format("YYYY-MM-DD");
}
