import * as React from "react";
import dayjs from "dayjs";
import type { UseFormReturn } from "react-hook-form";
import {
  type AccountFormValues,
  type BudgetFormValues,
  type CategoryFormValues,
  type LedgerSnapshot,
  type MonthlySummary,
  type ProfileSettingsFormValues,
  type RecurringTransactionFormValues,
  type TransactionFormValues
} from "@household/types";
import {
  ACCOUNT_TYPE_OPTIONS,
  CATEGORY_KIND_OPTIONS,
  CURRENCY_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  WEEK_START_OPTIONS
} from "@household/config";
import { formatCurrency, sanitizeAmountInput } from "@household/ui";

const recurringFailureFilterStorageKey = "web-recurring-failure-filters-v1";

export type MonthlyTrendPoint = {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
};

export type RecurringExecutionLogItem = {
  id: string;
  recurringTransactionId: string;
  scheduledFor: string;
  executedAt: string;
  status: "pending" | "success" | "failed";
  transactionId: string | null;
  errorMessage?: string;
};

function formatExecutionDateTime(value: string) {
  return dayjs(value).isValid() ? dayjs(value).format("YYYY.MM.DD HH:mm") : value;
}

function normalizeExecutionFailureReason(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function getExecutionFailureReason(item: RecurringExecutionLogItem) {
  return (
    normalizeExecutionFailureReason(item.errorMessage)
  );
}

function summarizeRecurringExecutionLogs(items: RecurringExecutionLogItem[]) {
  const sevenDaysAgo = dayjs().subtract(7, "day").valueOf();
  let successCount = 0;
  let failureCount = 0;
  let totalSuccessCount = 0;
  let totalFailureCount = 0;
  let latestExecutedAt: string | null = null;
  let latestExecutedAtValue = Number.NEGATIVE_INFINITY;
  const failureReasonCounts = new Map<string, number>();

  for (const item of items) {
    const executedAt = dayjs(item.executedAt);
    const isSuccess = item.status === "success";
    if (isSuccess) {
      totalSuccessCount += 1;
    } else {
      totalFailureCount += 1;
    }

    if (executedAt.isValid()) {
      const executedAtValue = executedAt.valueOf();

      if (executedAtValue >= sevenDaysAgo) {
        if (isSuccess) {
          successCount += 1;
        } else {
          failureCount += 1;
          const reason = getExecutionFailureReason(item);

          if (reason) {
            failureReasonCounts.set(reason, (failureReasonCounts.get(reason) ?? 0) + 1);
          }
        }
      }

      if (executedAtValue > latestExecutedAtValue) {
        latestExecutedAtValue = executedAtValue;
        latestExecutedAt = item.executedAt;
      }
    }
  }

  const failureReasons = [...failureReasonCounts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], "ko");
    })
    .slice(0, 2)
    .map(([reason, count]) => `${reason}${count > 1 ? ` ${count}건` : ""}`);

  return {
    successCount,
    failureCount,
    totalSuccessCount,
    totalFailureCount,
    latestExecutedAt,
    failureReasonSummary: failureReasons.length ? failureReasons.join(", ") : "실패 사유 없음"
  };
}

export function SummaryCards({
  summary,
  loading
}: {
  summary: MonthlySummary;
  loading: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { label: "이번 달 수입", value: summary.income },
        { label: "이번 달 지출", value: summary.expense },
        { label: "이번 달 잔액", value: summary.balance }
      ].map((card) => (
        <article key={card.label} className="rounded-[24px] bg-card p-6 shadow-sm">
          <p className="text-sm text-stone-500">{card.label}</p>
          <p className="mt-3 text-3xl font-semibold">
            {loading ? "불러오는 중..." : formatCurrency(card.value)}
          </p>
        </article>
      ))}
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function FormSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FieldError({ message }: { message?: React.ReactNode }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-rose-500" role="alert">
      {message}
    </p>
  );
}

export function AccountFormPanel({
  form,
  onSubmit,
  disabled = false
  }: {
  form: UseFormReturn<AccountFormValues>;
  onSubmit: (values: AccountFormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const { errors } = form.formState;

  return (
    <form className="flex flex-col gap-3" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
      <fieldset className="flex flex-col gap-3" disabled={disabled}>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="계정 이름" {...form.register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("type")}>
          {ACCOUNT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          </select>
          <FieldError message={errors.type?.message} />
        </div>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="현재 잔액" {...form.register("balanceInput")} value={form.watch("balanceInput")} onChange={(event) => form.setValue("balanceInput", sanitizeAmountInput(event.target.value))} />
          <FieldError message={errors.balanceInput?.message} />
        </div>
        <button className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} type="submit">
          {"계정 저장"}
        </button>
      </fieldset>
    </form>
  );
}

export function CategoryFormPanel({
  form,
  onSubmit,
  disabled = false
  }: {
  form: UseFormReturn<CategoryFormValues>;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const { errors } = form.formState;

  return (
    <form className="flex flex-col gap-3" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
      <fieldset className="flex flex-col gap-3" disabled={disabled}>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="카테고리 이름" {...form.register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("kind")}>
          {CATEGORY_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          </select>
          <FieldError message={errors.kind?.message} />
        </div>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="#1c7c54" {...form.register("color")} />
          <FieldError message={errors.color?.message} />
        </div>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="아이콘 키(옵션)" {...form.register("icon")} />
          <FieldError message={errors.icon?.message} />
        </div>
        <button className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} type="submit">
          {"카테고리 저장"}
        </button>
      </fieldset>
    </form>
  );
}

export function TransactionFormPanel({
  form,
  accounts,
  categories,
  transactionType,
  onSubmit,
  disabled = false
  }: {
  form: UseFormReturn<TransactionFormValues>;
  accounts: LedgerSnapshot["accounts"];
  categories: LedgerSnapshot["categories"];
  transactionType: TransactionFormValues["type"];
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const { errors } = form.formState;

  return (
    <form className="flex flex-col gap-3" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
      <fieldset className="flex flex-col gap-3" disabled={disabled}>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("type")}>
          {TRANSACTION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          </select>
          <FieldError message={errors.type?.message} />
        </div>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="금액" {...form.register("amountInput")} value={form.watch("amountInput")} onChange={(event) => form.setValue("amountInput", sanitizeAmountInput(event.target.value))} />
          <FieldError message={errors.amountInput?.message} />
        </div>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" type="date" {...form.register("occurredAt")} />
          <FieldError message={errors.occurredAt?.message} />
        </div>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("accountId")}>
          <option value="">{"계정 선택"}</option>
          {accounts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
          </select>
          <FieldError message={errors.accountId?.message} />
        </div>
        {transactionType === "transfer" ? (
          <div>
            <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("transferAccountId")}>
              <option value="">{"받는 계정 선택"}</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.transferAccountId?.message} />
          </div>
        ) : (
          <div>
            <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("categoryId")}>
              <option value="">{"카테고리 선택"}</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.categoryId?.message} />
          </div>
        )}
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="메모" {...form.register("description")} />
          <FieldError message={errors.description?.message} />
        </div>
        <button className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} type="submit">
          {"거래 저장"}
        </button>
      </fieldset>
    </form>
  );
}

export function SimpleList({
  items,
  onEdit,
  onDelete,
  deletingId,
  deleteLabel = "삭제",
  emptyLabel
}: {
  items: Array<{ id: string; title: string; subtitle: string }>;
  onEdit: (id: string) => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  deleteLabel?: string;
  emptyLabel: string;
}) {
  if (!items.length) {
    return (
      <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-4 text-sm text-stone-600">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3">
          <div>
            <p className="font-medium">{item.title}</p>
            <p className="mt-1 text-sm text-stone-500">{item.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-full border border-stone-300 px-3 py-1 text-xs" onClick={() => onEdit(item.id)} type="button">
              {"수정"}
            </button>
            {onDelete ? (
              <button
                className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deletingId === item.id}
                onClick={() => onDelete(item.id)}
                type="button"
              >
                {deletingId === item.id ? "처리 중" : deleteLabel}
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsPanel({ ledger }: { ledger: LedgerSnapshot | null }) {
  return (
    <section className="rounded-[24px] bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">
        {"카테고리별 소비 비중"}
      </h2>
      {!ledger?.monthlyStats.categoryBreakdown.length ? (
        <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-4 text-sm text-stone-600">
          {"통계를 표시할 지출 데이터가 없습니다."}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3">
        {ledger?.monthlyStats.categoryBreakdown.map((item) => (
          <div key={item.categoryId} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{item.categoryName}</p>
              <p className="text-sm text-stone-500">{item.percentage}%</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-stone-100">
              <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(item.percentage, 100)}%` }} />
            </div>
            <p className="mt-3 text-sm text-stone-600">{formatCurrency(item.amount)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BudgetProgressPanel({ ledger }: { ledger: LedgerSnapshot | null }) {
  return (
    <section className="rounded-[24px] bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">
        {"예산 진행률"}
      </h2>
      {!ledger?.monthlyStats.budgetProgress.length ? (
        <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-4 text-sm text-stone-600">
          {"설정된 예산이 없습니다."}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3">
        {ledger?.monthlyStats.budgetProgress.map((item) => (
          <div key={item.budgetId} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {item.categoryName ?? "카테고리"}
              </p>
              <p className="text-sm text-stone-500">{item.percentUsed}%</p>
            </div>
            <p className="mt-2 text-sm text-stone-600">
              {formatCurrency(item.spentAmount)} / {formatCurrency(item.budgetAmount)}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              {"남은 예산: "}
              {formatCurrency(item.remainingAmount)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MonthlyTrendPanel({
  data,
  loading
}: {
  data: MonthlyTrendPoint[];
  loading: boolean;
}) {
  const hasData = data.some(
    (item) => item.income > 0 || item.expense > 0 || item.balance !== 0
  );
  const maxAmount = Math.max(
    1,
    ...data.map((item) => Math.max(item.income, item.expense))
  );
  const balances = data.map((item) => item.balance);
  const minBalance = Math.min(0, ...balances);
  const maxBalance = Math.max(0, ...balances);
  const balanceSpan = Math.max(maxBalance - minBalance, 1);
  const chartWidth = 600;
  const chartHeight = 140;
  const balancePoints = data.map((item, index) => {
    const x =
      data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth;
    const normalized = (item.balance - minBalance) / balanceSpan;
    const y = chartHeight - normalized * chartHeight;

    return { x, y };
  });
  const balancePath = balancePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const zeroLineVisible = minBalance < 0 && maxBalance > 0;
  const zeroLineY = chartHeight - ((0 - minBalance) / balanceSpan) * chartHeight;

  return (
    <section className="rounded-[24px] bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">
        {"최근 6개월 추이"}
      </h2>
      <p className="mt-2 text-sm text-stone-500">
        {"수입/지출은 막대, 잔액은 선으로 보여줘요."}
      </p>

      {loading ? (
        <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-4 text-sm text-stone-600">
          {"차트를 불러오는 중입니다."}
        </p>
      ) : null}

      {!loading && !hasData ? (
        <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-4 text-sm text-stone-600">
          {"최근 6개월에 차트로 만들 데이터가 없습니다."}
        </p>
      ) : null}

      {!loading && hasData ? (
        <div className="mt-4 rounded-3xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {"수입"}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              {"지출"}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              {"잔액"}
            </span>
          </div>

          <div className="mt-4">
            <div className="relative h-[150px]">
              {zeroLineVisible ? (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-stone-200"
                  style={{ top: `${zeroLineY}px` }}
                />
              ) : null}
              <svg
                aria-hidden="true"
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  points={balancePath}
                  stroke="#0ea5e9"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="3"
                />
                {balancePoints.map((point, index) => (
                  <circle
                    key={`${data[index].monthKey}-balance`}
                    cx={point.x}
                    cy={point.y}
                    fill="#0ea5e9"
                    r="4"
                  />
                ))}
              </svg>
            </div>

            <div className="mt-3 grid grid-cols-6 gap-3">
              {data.map((item) => {
                const incomeHeight = `${Math.max((item.income / maxAmount) * 100, item.income > 0 ? 8 : 0)}%`;
                const expenseHeight = `${Math.max((item.expense / maxAmount) * 100, item.expense > 0 ? 8 : 0)}%`;

                return (
                  <div key={item.monthKey} className="flex min-w-0 flex-col gap-3">
                    <div className="flex h-28 items-end justify-center gap-2 rounded-2xl bg-stone-50 px-2 py-2">
                      <div className="flex h-full flex-1 items-end justify-center">
                        <div
                          className="w-4 rounded-t-full bg-emerald-500"
                          style={{ height: incomeHeight }}
                          title={`${item.label} ${"수입"} ${formatCurrency(item.income)}`}
                        />
                      </div>
                      <div className="flex h-full flex-1 items-end justify-center">
                        <div
                          className="w-4 rounded-t-full bg-rose-500"
                          style={{ height: expenseHeight }}
                          title={`${item.label} ${"지출"} ${formatCurrency(item.expense)}`}
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-stone-800">{item.label}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatCurrency(item.balance)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function BudgetFormPanel({
  form,
  categories,
  onSubmit,
  disabled = false
  }: {
  form: UseFormReturn<BudgetFormValues>;
  categories: LedgerSnapshot["categories"];
  onSubmit: (values: BudgetFormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const { errors } = form.formState;

  return (
    <form className="flex flex-col gap-3" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
      <fieldset className="flex flex-col gap-3" disabled={disabled}>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="YYYY-MM" {...form.register("month")} />
          <FieldError message={errors.month?.message} />
        </div>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("categoryId")}>
            <option value="">{"카테고리 선택"}</option>
            {categories.filter((item) => item.kind === "expense").map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.categoryId?.message} />
        </div>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="예산 금액" {...form.register("amountInput")} value={form.watch("amountInput")} onChange={(event) => form.setValue("amountInput", sanitizeAmountInput(event.target.value))} />
          <FieldError message={errors.amountInput?.message} />
        </div>
        <button className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} type="submit">
          {"예산 저장"}
        </button>
      </fieldset>
    </form>
  );
}

export function RecurringFormPanel({
  form,
  accounts,
  categories,
  onSubmit,
  disabled = false
  }: {
  form: UseFormReturn<RecurringTransactionFormValues>;
  accounts: LedgerSnapshot["accounts"];
  categories: LedgerSnapshot["categories"];
  onSubmit: (values: RecurringTransactionFormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const recurringType = form.watch("type");
  const { errors } = form.formState;

  return (
    <form className="flex flex-col gap-3" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
      <fieldset className="flex flex-col gap-3" disabled={disabled}>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("type")}>
          {TRANSACTION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          </select>
          <FieldError message={errors.type?.message} />
        </div>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="반복 설명" {...form.register("description")} />
          <FieldError message={errors.description?.message} />
        </div>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("accountId")}>
          <option value="">{"계정 선택"}</option>
          {accounts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
          </select>
          <FieldError message={errors.accountId?.message} />
        </div>
        {recurringType === "transfer" ? (
          <div>
            <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("transferAccountId")}>
              <option value="">{"받는 계정 선택"}</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.transferAccountId?.message} />
          </div>
        ) : (
          <div>
            <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("categoryId")}>
              <option value="">{"카테고리 선택"}</option>
              {categories.filter((item) => item.kind === recurringType).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.categoryId?.message} />
          </div>
        )}
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="반복 금액" {...form.register("amountInput")} value={form.watch("amountInput")} onChange={(event) => form.setValue("amountInput", sanitizeAmountInput(event.target.value))} />
          <FieldError message={errors.amountInput?.message} />
        </div>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("frequency")}>
          {RECURRING_FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          </select>
          <FieldError message={errors.frequency?.message} />
        </div>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" type="date" {...form.register("nextRunAt")} />
          <FieldError message={errors.nextRunAt?.message} />
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm">
          <input className="h-4 w-4 accent-ink" type="checkbox" {...form.register("isActive")} />
          <span>{"활성 여부"}</span>
        </label>
        <FieldError message={errors.isActive?.message} />
        <button className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} type="submit">
          {"반복지출 저장"}
        </button>
      </fieldset>
    </form>
  );
}

export function RecurringExecutionPanel({
  items,
  loading,
  error
}: {
  items: RecurringExecutionLogItem[];
  loading: boolean;
  error?: string;
}) {
  const hasItems = items.length > 0;
  const summary = summarizeRecurringExecutionLogs(items);
  const failureLogItems = items.filter((item) => item.status === "failed");
  const [failureReasonQuery, setFailureReasonQuery] = React.useState("");
  const [failurePeriodFilter, setFailurePeriodFilter] = React.useState<"7d" | "30d" | "all">("all");
  const [failureReasonStateFilter, setFailureReasonStateFilter] = React.useState<
    "all" | "with_reason" | "without_reason"
  >("all");
  const [isFilterHydrated, setIsFilterHydrated] = React.useState(false);
  const [rerunGuideCopied, setRerunGuideCopied] = React.useState(false);
  const normalizedFailureReasonQuery = failureReasonQuery.trim().toLowerCase();
  const filteredFailureLogItems = React.useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    return failureLogItems.filter((item) => {
      const reasonText = getExecutionFailureReason(item) ?? "사유 없음";
      const normalizedReason = reasonText.toLowerCase();
      const hasReason = reasonText !== "사유 없음";
      const executedAt = new Date(item.executedAt).getTime();

      if (failurePeriodFilter === "7d" && (Number.isNaN(executedAt) || executedAt < sevenDaysAgo)) {
        return false;
      }

      if (
        failurePeriodFilter === "30d" &&
        (Number.isNaN(executedAt) || executedAt < thirtyDaysAgo)
      ) {
        return false;
      }

      if (failureReasonStateFilter === "with_reason" && !hasReason) {
        return false;
      }

      if (failureReasonStateFilter === "without_reason" && hasReason) {
        return false;
      }

      if (normalizedFailureReasonQuery && !normalizedReason.includes(normalizedFailureReasonQuery)) {
        return false;
      }

      return true;
    });
  }, [failureLogItems, failurePeriodFilter, failureReasonStateFilter, normalizedFailureReasonQuery]);
  const recentFailureLogItems = filteredFailureLogItems.slice(0, 5);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const queryFromUrl = params.get("rff_q");
      const periodFromUrl = params.get("rff_p");
      const reasonStateFromUrl = params.get("rff_s");
      const hasUrlFilters =
        queryFromUrl !== null || periodFromUrl !== null || reasonStateFromUrl !== null;

      if (hasUrlFilters) {
        if (typeof queryFromUrl === "string") {
          setFailureReasonQuery(queryFromUrl);
        }

        if (periodFromUrl === "7d" || periodFromUrl === "30d" || periodFromUrl === "all") {
          setFailurePeriodFilter(periodFromUrl);
        }

        if (
          reasonStateFromUrl === "all" ||
          reasonStateFromUrl === "with_reason" ||
          reasonStateFromUrl === "without_reason"
        ) {
          setFailureReasonStateFilter(reasonStateFromUrl);
        }
      } else {
        const raw = window.localStorage.getItem(recurringFailureFilterStorageKey);

        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw) as {
          query?: string;
          period?: "7d" | "30d" | "all";
          reasonState?: "all" | "with_reason" | "without_reason";
        };

        if (typeof parsed.query === "string") {
          setFailureReasonQuery(parsed.query);
        }

        if (parsed.period === "7d" || parsed.period === "30d" || parsed.period === "all") {
          setFailurePeriodFilter(parsed.period);
        }

        if (
          parsed.reasonState === "all" ||
          parsed.reasonState === "with_reason" ||
          parsed.reasonState === "without_reason"
        ) {
          setFailureReasonStateFilter(parsed.reasonState);
        }
      }
    } catch {
      // Ignore parse/storage errors and continue with defaults.
    } finally {
      setIsFilterHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (!isFilterHydrated || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        recurringFailureFilterStorageKey,
        JSON.stringify({
          query: failureReasonQuery,
          period: failurePeriodFilter,
          reasonState: failureReasonStateFilter
        })
      );
    } catch {
      // Ignore storage write failures.
    }

    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string, defaultValue = "") => {
      if (!value || value === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    };

    setOrDelete("rff_q", failureReasonQuery);
    setOrDelete("rff_p", failurePeriodFilter, "all");
    setOrDelete("rff_s", failureReasonStateFilter, "all");

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [failurePeriodFilter, failureReasonQuery, failureReasonStateFilter, isFilterHydrated]);

  React.useEffect(() => {
    if (!rerunGuideCopied) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRerunGuideCopied(false);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [rerunGuideCopied]);

  return (
    <section className="rounded-[24px] bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{"반복배치 실행 로그"}</h2>
      <p className="mt-2 text-sm text-stone-500">
        {"최근 실행된 반복거래의 예약 시각, 실행 시각, 생성 결과를 확인합니다."}
      </p>

      {!loading && !error ? (
        <div className="mt-4 rounded-3xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-medium text-stone-700">{"최근 7일 요약"}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <MiniStat label={"최근 7일 성공"} value={`${summary.successCount}건`} />
            <MiniStat label={"최근 7일 실패"} value={`${summary.failureCount}건`} />
            <MiniStat
              label={"마지막 실행"}
              value={
                summary.latestExecutedAt
                  ? formatExecutionDateTime(summary.latestExecutedAt)
                  : "기록 없음"
              }
            />
          </div>
          <div className="mt-4 border-t border-stone-200 pt-4">
            <p className="text-sm font-medium text-stone-700">{"총 누적 요약"}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <MiniStat label={"총 누적 성공"} value={`${summary.totalSuccessCount}건`} />
              <MiniStat label={"총 누적 실패"} value={`${summary.totalFailureCount}건`} />
            </div>
          </div>
          <p className="mt-3 text-sm text-stone-600">
            <span className="font-medium text-stone-700">{"실패 사유 요약: "}</span>
            {summary.failureReasonSummary}
          </p>
          <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-stone-600">{"배치 재실행"}</p>
            <p className="mt-1 text-sm text-stone-700">
              {"실패 원인을 정리한 뒤 아래 명령으로 dry-run을 다시 확인하세요."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-md bg-stone-100 px-2 py-1 text-xs">
                {"pnpm ops:check-recurring-batch"}
              </code>
              <button
                className="rounded-full border border-stone-300 px-3 py-1 text-xs"
                onClick={() => {
                  if (typeof window === "undefined") {
                    return;
                  }

                  navigator.clipboard
                    .writeText("pnpm ops:check-recurring-batch")
                    .then(() => setRerunGuideCopied(true))
                    .catch(() => setRerunGuideCopied(false));
                }}
                type="button"
              >
                {rerunGuideCopied ? "복사됨" : "명령 복사"}
              </button>
            </div>
          </div>
          <details className="mt-3 rounded-2xl border border-stone-200 bg-white">
            <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-sm font-medium text-stone-700">
              {`실패 로그 상세 보기 (최근 ${Math.min(recentFailureLogItems.length, 5)}건)`}
            </summary>
            <div className="border-t border-stone-200 px-4 py-4">
              {!failureLogItems.length ? (
                <p className="text-sm text-stone-600">{"실패 로그가 없습니다."}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <input
                      className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                      onChange={(event) => setFailureReasonQuery(event.target.value)}
                      placeholder="실패 사유 검색"
                      value={failureReasonQuery}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                      onChange={(event) =>
                        setFailurePeriodFilter(event.target.value as "7d" | "30d" | "all")
                      }
                      value={failurePeriodFilter}
                    >
                      <option value="all">{"기간: 전체"}</option>
                      <option value="7d">{"기간: 최근 7일"}</option>
                      <option value="30d">{"기간: 최근 30일"}</option>
                    </select>
                    <select
                      className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                      onChange={(event) =>
                        setFailureReasonStateFilter(
                          event.target.value as "all" | "with_reason" | "without_reason"
                        )
                      }
                      value={failureReasonStateFilter}
                    >
                      <option value="all">{"사유 상태: 전체"}</option>
                      <option value="with_reason">{"사유 상태: 사유 있음"}</option>
                      <option value="without_reason">{"사유 상태: 사유 없음"}</option>
                    </select>
                  </div>
                  <div>
                    <button
                      className="rounded-full border border-stone-300 px-4 py-2 text-xs"
                      onClick={() => {
                        setFailureReasonQuery("");
                        setFailurePeriodFilter("all");
                        setFailureReasonStateFilter("all");
                      }}
                      type="button"
                    >
                      {"필터 초기화"}
                    </button>
                  </div>
                  {!filteredFailureLogItems.length ? (
                    <p className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
                      {"검색 조건에 맞는 실패 로그가 없습니다."}
                    </p>
                  ) : null}
                  {recentFailureLogItems.map((item) => {
                    const reason = getExecutionFailureReason(item) ?? "사유 없음";

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-stone-50 px-4 py-3 text-sm"
                      >
                        <p className="font-medium text-stone-800">
                          {formatExecutionDateTime(item.executedAt)}
                        </p>
                        <p className="mt-1 text-stone-600">
                          <span className="font-medium text-stone-700">{"사유: "}</span>
                          {reason}
                        </p>
                      </div>
                    );
                  })}
                  {filteredFailureLogItems.length > recentFailureLogItems.length ? (
                    <details className="rounded-2xl border border-stone-200 bg-white">
                      <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-sm font-medium text-stone-700">
                        {`전체 실패 로그 보기 (${filteredFailureLogItems.length}건)`}
                      </summary>
                      <div className="border-t border-stone-200 px-4 py-4">
                        <div className="flex flex-col gap-3">
                          {filteredFailureLogItems.slice(5).map((item) => {
                            const reason = getExecutionFailureReason(item) ?? "사유 없음";

                            return (
                              <div
                                key={`${item.id}-all`}
                                className="rounded-2xl bg-stone-50 px-4 py-3 text-sm"
                              >
                                <p className="font-medium text-stone-800">
                                  {formatExecutionDateTime(item.executedAt)}
                                </p>
                                <p className="mt-1 text-stone-600">
                                  <span className="font-medium text-stone-700">{"사유: "}</span>
                                  {reason}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  ) : null}
                </div>
              )}
            </div>
          </details>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-4 text-sm text-stone-600">
          {"실행 로그를 불러오는 중입니다."}
        </p>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {!loading && !error && !hasItems ? (
        <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-4 text-sm text-stone-600">
          {"아직 실행 로그가 없습니다. 예약 시각이 지난 반복거래가 실행되면 여기에 표시됩니다."}
        </p>
      ) : null}

      {!loading && !error && hasItems ? (
        <div className="mt-4 flex flex-col gap-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {"반복거래 "}
                    <span className="font-mono text-sm text-stone-600">
                      {item.recurringTransactionId.slice(0, 8)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    {"최근 실행 "}
                    {formatExecutionDateTime(item.executedAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    item.status === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : item.status === "failed"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {item.status === "success"
                    ? "성공"
                    : item.status === "failed"
                      ? "실패"
                      : "대기"}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-stone-50 px-4 py-3">
                  <dt className="text-xs text-stone-500">{"최근 실행 시각"}</dt>
                  <dd className="mt-1 text-sm font-medium text-stone-800">
                    {formatExecutionDateTime(item.executedAt)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-3">
                  <dt className="text-xs text-stone-500">{"예약 시각"}</dt>
                  <dd className="mt-1 text-sm font-medium text-stone-800">
                    {formatExecutionDateTime(item.scheduledFor)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-3">
                  <dt className="text-xs text-stone-500">{"생성 거래 ID 유무"}</dt>
                  <dd className="mt-1 text-sm font-medium text-stone-800">
                    {item.transactionId ? "있음" : "없음"}
                  </dd>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-3 sm:col-span-3">
                  <dt className="text-xs text-stone-500">{"실패 원인"}</dt>
                  <dd className="mt-1 text-sm font-medium text-stone-800">
                    {item.status === "failed"
                      ? getExecutionFailureReason(item) ?? "알 수 없는 오류"
                      : "-"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
export function SettingsFormPanel({
  form,
  onSubmit,
  disabled = false
  }: {
  form: UseFormReturn<ProfileSettingsFormValues>;
  onSubmit: (values: ProfileSettingsFormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const { errors } = form.formState;

  return (
    <form className="flex flex-col gap-3" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
      <fieldset className="flex flex-col gap-3" disabled={disabled}>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" placeholder="표시 이름" {...form.register("displayName")} />
          <FieldError message={errors.displayName?.message} />
        </div>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("defaultCurrency")}>
          {CURRENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          </select>
          <FieldError message={errors.defaultCurrency?.message} />
        </div>
        <div>
          <select className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" {...form.register("weekStartsOn", { valueAsNumber: true })}>
          {WEEK_START_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          </select>
          <FieldError message={errors.weekStartsOn?.message} />
        </div>
        <div>
          <input className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" max={28} min={1} type="number" {...form.register("monthStartDay", { valueAsNumber: true })} />
          <FieldError message={errors.monthStartDay?.message} />
        </div>
        <button className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} type="submit">
          {"설정 저장"}
        </button>
      </fieldset>
    </form>
  );
}


