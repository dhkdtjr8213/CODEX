import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type {
  Account,
  AccountFormValues,
  Budget,
  BudgetFormValues,
  BudgetProgress,
  Category,
  CategoryFormValues,
  CategorySpendingStat,
  Database,
  LedgerSnapshot,
  LedgerTransactionItem,
  MonthlyStats,
  MonthlySummary,
  RecurringExecutionLog,
  RecurringTransaction,
  RecurringTransactionFormValues,
  Transaction,
  TransactionType,
  TransactionFormValues
} from "@household/types";
import { parseAmountInput } from "@household/ui";
import type { SupabaseClient } from "@supabase/supabase-js";

dayjs.extend(customParseFormat);

type LedgerEntryFormValues = Pick<
  TransactionFormValues,
  "type" | "amountInput" | "accountId" | "categoryId" | "transferAccountId" | "description"
>;

type NormalizedLedgerEntryPayload = {
  user_id: string;
  type: TransactionType;
  amount: number;
  account_id: string;
  category_id: string | null;
  transfer_account_id: string | null;
  description: string | null;
};

function normalizeOptionalId(value?: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeLedgerDateOrThrow(value: string, errorMessage: string): string {
  const normalized = value.trim();

  if (!dayjs(normalized, "YYYY-MM-DD", true).isValid()) {
    throw new Error(errorMessage);
  }

  return normalized;
}

function normalizeLedgerEntryPayload(
  userId: string,
  values: LedgerEntryFormValues
): NormalizedLedgerEntryPayload {
  const basePayload = {
    user_id: userId,
    type: values.type,
    amount: parseAmountInput(values.amountInput),
    account_id: values.accountId,
    description: normalizeOptionalId(values.description)
  };

  if (values.type === "transfer") {
    const transferAccountId = normalizeOptionalId(values.transferAccountId);

    if (!transferAccountId) {
      throw new Error("이체 대상 계정을 선택해 주세요.");
    }

    if (transferAccountId === values.accountId) {
      throw new Error("출금 계정과 다른 계정을 선택해 주세요.");
    }

    return {
      ...basePayload,
      category_id: null,
      transfer_account_id: transferAccountId
    };
  }

  const categoryId = normalizeOptionalId(values.categoryId);

  if (!categoryId) {
    throw new Error("카테고리를 선택해 주세요.");
  }

  return {
    ...basePayload,
    category_id: categoryId,
    transfer_account_id: null
  };
}

function mapAccount(row: Database["public"]["Tables"]["accounts"]["Row"]): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    balance: row.balance,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCategory(row: Database["public"]["Tables"]["categories"]["Row"]): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    color: row.color,
    icon: row.icon ?? undefined,
    isDefault: row.is_default,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTransaction(row: Database["public"]["Tables"]["transactions"]["Row"]): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    occurredAt: row.occurred_at,
    description: row.description ?? undefined,
    accountId: row.account_id,
    categoryId: row.category_id ?? undefined,
    transferAccountId: row.transfer_account_id ?? undefined,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBudget(row: Database["public"]["Tables"]["budgets"]["Row"]): Budget {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    amount: row.amount,
    currency: row.currency,
    period: row.period,
    month: row.month,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRecurringTransaction(
  row: Database["public"]["Tables"]["recurring_transactions"]["Row"]
): RecurringTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    frequency: row.frequency,
    nextRunAt: row.next_run_at,
    accountId: row.account_id,
    categoryId: row.category_id ?? undefined,
    transferAccountId: row.transfer_account_id ?? undefined,
    description: row.description ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRecurringExecutionLog(
  row: Database["public"]["Tables"]["recurring_transaction_executions"]["Row"]
): RecurringExecutionLog {
  return {
    id: row.id,
    recurringTransactionId: row.recurring_transaction_id,
    userId: row.user_id,
    scheduledFor: row.scheduled_for,
    executedAt: row.executed_at,
    transactionId: row.transaction_id,
    createdAt: row.created_at
  };
}

function getMonthRange(baseDate?: string) {
  const current = baseDate ? dayjs(baseDate) : dayjs();
  const start = current.startOf("month");
  const end = current.endOf("month").add(1, "millisecond");

  return {
    month: start.format("YYYY-MM"),
    start: start.toISOString(),
    end: end.toISOString()
  };
}

export async function listAccounts(client: SupabaseClient<Database>): Promise<Account[]> {
  const { data, error } = await client
    .from("accounts")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAccount);
}

export async function saveAccount(
  client: SupabaseClient<Database>,
  userId: string,
  values: AccountFormValues
): Promise<Account> {
  const payload = {
    user_id: userId,
    name: values.name,
    type: values.type,
    balance: parseAmountInput(values.balanceInput)
  };

  const query = values.id
    ? client.from("accounts").update(payload).eq("id", values.id).select("*").single()
    : client.from("accounts").insert(payload).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return mapAccount(data);
}

export async function archiveAccount(
  client: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await client
    .from("accounts")
    .update({ is_archived: true })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function listCategories(client: SupabaseClient<Database>): Promise<Category[]> {
  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("is_archived", false)
    .order("kind", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCategory);
}

export async function saveCategory(
  client: SupabaseClient<Database>,
  userId: string,
  values: CategoryFormValues
): Promise<Category> {
  const payload = {
    user_id: userId,
    name: values.name,
    kind: values.kind,
    color: values.color,
    icon: values.icon || null
  };

  const query = values.id
    ? client.from("categories").update(payload).eq("id", values.id).select("*").single()
    : client.from("categories").insert(payload).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return mapCategory(data);
}

export async function archiveCategory(
  client: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await client
    .from("categories")
    .update({ is_archived: true })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function listTransactions(
  client: SupabaseClient<Database>,
  limit = 50
): Promise<Transaction[]> {
  const { data, error } = await client
    .from("transactions")
    .select("*")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapTransaction);
}

export async function saveTransaction(
  client: SupabaseClient<Database>,
  userId: string,
  values: TransactionFormValues
): Promise<Transaction> {
  const normalizedPayload = normalizeLedgerEntryPayload(userId, values);
  const occurredAt = normalizeLedgerDateOrThrow(values.occurredAt, "거래 날짜가 올바르지 않습니다.");
  const payload = {
    ...normalizedPayload,
    occurred_at: dayjs(occurredAt).toISOString()
  };

  const query = values.id
    ? client.from("transactions").update(payload).eq("id", values.id).select("*").single()
    : client.from("transactions").insert(payload).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return mapTransaction(data);
}

export async function deleteTransaction(
  client: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await client
    .from("transactions")
    .update({ deleted_at: dayjs().toISOString() })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function listBudgets(
  client: SupabaseClient<Database>,
  month?: string
): Promise<Budget[]> {
  let query = client.from("budgets").select("*").order("month", { ascending: false });

  if (month) {
    query = query.eq("month", month);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapBudget);
}

export async function saveBudget(
  client: SupabaseClient<Database>,
  userId: string,
  values: BudgetFormValues
): Promise<Budget> {
  const payload = {
    user_id: userId,
    category_id: values.categoryId,
    amount: parseAmountInput(values.amountInput),
    month: values.month
  };

  const query = values.id
    ? client.from("budgets").update(payload).eq("id", values.id).select("*").single()
    : client.from("budgets").insert(payload).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return mapBudget(data);
}

export async function deleteBudget(
  client: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await client.from("budgets").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function listRecurringTransactions(
  client: SupabaseClient<Database>
): Promise<RecurringTransaction[]> {
  const { data, error } = await client
    .from("recurring_transactions")
    .select("*")
    .order("next_run_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRecurringTransaction);
}

export async function saveRecurringTransaction(
  client: SupabaseClient<Database>,
  userId: string,
  values: RecurringTransactionFormValues
): Promise<RecurringTransaction> {
  const normalizedPayload = normalizeLedgerEntryPayload(userId, values);
  const nextRunAt = normalizeLedgerDateOrThrow(
    values.nextRunAt,
    "다음 실행일이 올바르지 않습니다."
  );
  const payload = {
    ...normalizedPayload,
    frequency: values.frequency,
    next_run_at: dayjs(nextRunAt).toISOString(),
    is_active: values.isActive
  };

  const query = values.id
    ? client.from("recurring_transactions").update(payload).eq("id", values.id).select("*").single()
    : client.from("recurring_transactions").insert(payload).select("*").single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return mapRecurringTransaction(data);
}

export async function deleteRecurringTransaction(
  client: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await client
    .from("recurring_transactions")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function listRecurringExecutionLogs(
  client: SupabaseClient<Database>,
  limit = 50
): Promise<RecurringExecutionLog[]> {
  const { data, error } = await client
    .from("recurring_transaction_executions")
    .select("*")
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRecurringExecutionLog);
}

export async function fetchMonthlySummary(
  client: SupabaseClient<Database>,
  baseDate?: string
): Promise<MonthlySummary> {
  const range = getMonthRange(baseDate);
  const { data, error } = await client
    .from("transactions")
    .select("type, amount")
    .is("deleted_at", null)
    .gte("occurred_at", range.start)
    .lt("occurred_at", range.end);

  if (error) {
    throw error;
  }

  let income = 0;
  let expense = 0;
  let transfer = 0;

  for (const item of data ?? []) {
    if (item.type === "income") {
      income += item.amount;
    } else if (item.type === "expense") {
      expense += item.amount;
    } else {
      transfer += item.amount;
    }
  }

  return {
    month: range.month,
    income,
    expense,
    transfer,
    balance: income - expense
  };
}

export async function fetchMonthlyStats(
  client: SupabaseClient<Database>,
  baseDate?: string
): Promise<MonthlyStats> {
  const range = getMonthRange(baseDate);
  const [summary, categories, budgets, transactions] = await Promise.all([
    fetchMonthlySummary(client, baseDate),
    listCategories(client),
    listBudgets(client, range.month),
    listTransactions(client, 500)
  ]);

  const monthTransactions = transactions.filter(
    (item) =>
      item.occurredAt >= range.start &&
      item.occurredAt < range.end &&
      item.type === "expense"
  );

  const spendByCategory = new Map<string, number>();

  for (const item of monthTransactions) {
    if (!item.categoryId) {
      continue;
    }

    spendByCategory.set(
      item.categoryId,
      (spendByCategory.get(item.categoryId) ?? 0) + item.amount
    );
  }

  const totalExpense = summary.expense || 0;
  const categoryMap = new Map(categories.map((item) => [item.id, item.name]));

  const categoryBreakdown: CategorySpendingStat[] = Array.from(spendByCategory.entries())
    .map(([categoryId, amount]) => ({
      categoryId,
      categoryName: categoryMap.get(categoryId) ?? "\uBBF8\uBD84\uB958",
      amount,
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0
    }))
    .sort((left, right) => right.amount - left.amount);

  const budgetProgress: BudgetProgress[] = budgets.map((budget) => {
    const spentAmount = spendByCategory.get(budget.categoryId) ?? 0;
    const remainingAmount = budget.amount - spentAmount;

    return {
      budgetId: budget.id,
      categoryId: budget.categoryId,
      categoryName: categoryMap.get(budget.categoryId),
      budgetAmount: budget.amount,
      spentAmount,
      remainingAmount,
      percentUsed: budget.amount > 0 ? Math.round((spentAmount / budget.amount) * 100) : 0,
      month: budget.month
    };
  });

  return {
    summary,
    categoryBreakdown,
    budgetProgress
  };
}

export async function fetchLedgerSnapshot(
  client: SupabaseClient<Database>
): Promise<LedgerSnapshot> {
  const [
    accounts,
    categories,
    budgets,
    recurringTransactions,
    recurringExecutionLogs,
    transactions,
    summary,
    monthlyStats
  ] = await Promise.all([
    listAccounts(client),
    listCategories(client),
    listBudgets(client),
    listRecurringTransactions(client),
    listRecurringExecutionLogs(client),
    listTransactions(client, 500),
    fetchMonthlySummary(client),
    fetchMonthlyStats(client)
  ]);

  const accountNameMap = new Map(accounts.map((item) => [item.id, item.name]));
  const categoryNameMap = new Map(categories.map((item) => [item.id, item.name]));

  const enrichedTransactions: LedgerTransactionItem[] = transactions.map((item) => ({
    ...item,
    accountName: accountNameMap.get(item.accountId),
    categoryName: item.categoryId ? categoryNameMap.get(item.categoryId) : undefined,
    transferAccountName: item.transferAccountId
      ? accountNameMap.get(item.transferAccountId)
      : undefined
  }));

  return {
    accounts,
    categories,
    budgets,
    recurringTransactions,
    recurringExecutionLogs,
    transactions: enrichedTransactions,
    summary,
    monthlyStats
  };
}
