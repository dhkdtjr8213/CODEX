export type CurrencyCode = "KRW";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TransactionType = "income" | "expense" | "transfer";
export type CategoryKind = "income" | "expense";
export type BudgetPeriod = "monthly";
export type RecurringFrequency = "monthly";
export type WeekStartsOn = 0 | 1;

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Profile {
  userId: string;
  displayName: string;
  defaultCurrency: CurrencyCode;
  locale: "ko-KR";
  weekStartsOn: WeekStartsOn;
  monthStartDay: number;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: "cash" | "bank" | "card" | "investment" | "other";
  currency: CurrencyCode;
  balance: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon?: string;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  occurredAt: string;
  description?: string;
  accountId: string;
  categoryId?: string;
  transferAccountId?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  period: BudgetPeriod;
  month: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  frequency: RecurringFrequency;
  nextRunAt: string;
  accountId: string;
  categoryId?: string;
  transferAccountId?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExecutionLog {
  id: string;
  recurringTransactionId: string;
  userId: string;
  scheduledFor: string;
  executedAt: string;
  transactionId: string | null;
  createdAt: string;
}

export interface BudgetProgress {
  budgetId: string;
  categoryId: string;
  categoryName?: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentUsed: number;
  month: string;
}

export interface DashboardSummary {
  month: string;
  incomeTotal: number;
  expenseTotal: number;
  transferTotal: number;
}

export interface RecentTransactionItem {
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  occurredAt: string;
}

export interface LedgerTransactionItem extends Transaction {
  accountName?: string;
  categoryName?: string;
  transferAccountName?: string;
}

export interface LedgerOverviewCounts {
  accounts: number;
  categories: number;
  transactions: number;
  budgets: number;
}

export interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
  transfer: number;
  balance: number;
}

export interface CategorySpendingStat {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
}

export interface MonthlyStats {
  summary: MonthlySummary;
  categoryBreakdown: CategorySpendingStat[];
  budgetProgress: BudgetProgress[];
}

export interface LedgerSnapshot {
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  recurringExecutionLogs: RecurringExecutionLog[];
  transactions: LedgerTransactionItem[];
  summary: MonthlySummary;
  monthlyStats: MonthlyStats;
}

export interface SupabasePublicEnv {
  url?: string;
  publishableKey?: string;
  defaultCurrency: string;
  locale: string;
}

export interface AuthSessionSnapshot {
  source: "server" | "client" | "mobile";
  hasEnv: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          default_currency: CurrencyCode;
          locale: "ko-KR";
          week_starts_on: WeekStartsOn;
          month_start_day: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          default_currency?: CurrencyCode;
          locale?: "ko-KR";
          week_starts_on?: WeekStartsOn;
          month_start_day?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string | null;
          default_currency?: CurrencyCode;
          locale?: "ko-KR";
          week_starts_on?: WeekStartsOn;
          month_start_day?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "cash" | "bank" | "card" | "investment" | "other";
          currency: CurrencyCode;
          balance: number;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "cash" | "bank" | "card" | "investment" | "other";
          currency?: CurrencyCode;
          balance?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "cash" | "bank" | "card" | "investment" | "other";
          currency?: CurrencyCode;
          balance?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          kind: CategoryKind;
          color: string;
          icon: string | null;
          is_default: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          kind: CategoryKind;
          color?: string;
          icon?: string | null;
          is_default?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          kind?: CategoryKind;
          color?: string;
          icon?: string | null;
          is_default?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: TransactionType;
          amount: number;
          currency: CurrencyCode;
          occurred_at: string;
          description: string | null;
          account_id: string;
          category_id: string | null;
          transfer_account_id: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: TransactionType;
          amount: number;
          currency?: CurrencyCode;
          occurred_at: string;
          description?: string | null;
          account_id: string;
          category_id?: string | null;
          transfer_account_id?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: TransactionType;
          amount?: number;
          currency?: CurrencyCode;
          occurred_at?: string;
          description?: string | null;
          account_id?: string;
          category_id?: string | null;
          transfer_account_id?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          amount: number;
          currency: CurrencyCode;
          period: BudgetPeriod;
          month: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          currency?: CurrencyCode;
          period?: BudgetPeriod;
          month: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          amount?: number;
          currency?: CurrencyCode;
          period?: BudgetPeriod;
          month?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: TransactionType;
          amount: number;
          currency: CurrencyCode;
          frequency: RecurringFrequency;
          next_run_at: string;
          account_id: string;
          category_id: string | null;
          transfer_account_id: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: TransactionType;
          amount: number;
          currency?: CurrencyCode;
          frequency?: RecurringFrequency;
          next_run_at: string;
          account_id: string;
          category_id?: string | null;
          transfer_account_id?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: TransactionType;
          amount?: number;
          currency?: CurrencyCode;
          frequency?: RecurringFrequency;
          next_run_at?: string;
          account_id?: string;
          category_id?: string | null;
          transfer_account_id?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_transaction_executions: {
        Row: {
          id: string;
          recurring_transaction_id: string;
          user_id: string;
          scheduled_for: string;
          executed_at: string;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recurring_transaction_id: string;
          user_id: string;
          scheduled_for: string;
          executed_at?: string;
          transaction_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recurring_transaction_id?: string;
          user_id?: string;
          scheduled_for?: string;
          executed_at?: string;
          transaction_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export * from "./forms";
