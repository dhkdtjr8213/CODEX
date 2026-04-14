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
