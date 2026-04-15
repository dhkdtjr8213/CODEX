"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  accountFormSchema,
  budgetFormSchema,
  categoryFormSchema,
  profileSettingsFormSchema,
  recurringTransactionFormSchema,
  transactionFormSchema,
  type AccountFormValues,
  type AuthSessionSnapshot,
  type BudgetFormValues,
  type CategoryFormValues,
  type LedgerSnapshot,
  type MonthlySummary,
  type Profile,
  type ProfileSettingsFormValues,
  type TransactionType,
  type RecurringTransactionFormValues,
  type TransactionFormValues
} from "@household/types";
import {
  archiveAccount,
  archiveCategory,
  deleteBudget,
  deleteRecurringTransaction,
  deleteTransaction,
  fetchLedgerSnapshot,
  fetchProfile,
  saveAccount,
  saveBudget,
  saveCategory,
  saveProfileSettings,
  saveRecurringTransaction,
  saveTransaction,
  updateTransactionsCategory
} from "@household/supabase";
import {
  ACCOUNT_TYPE_OPTIONS,
  CATEGORY_KIND_OPTIONS,
  PERIOD_PRESET_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
} from "@household/config";
import {
  formatCurrency,
  formatDateLabel,
  getTodayInputValue
} from "@household/ui";
import { getWebSupabaseBrowserClient } from "../lib/supabase/client";
import { exportTransactionsAsCsv, exportTransactionsAsXlsx } from "./ledger-export";
import { MonthlyCalendarPanel } from "./monthly-calendar-panel";
import {
  AccountFormPanel,
  BudgetFormPanel,
  BudgetProgressPanel,
  CategoryFormPanel,
  FormSection,
  MiniStat,
  MonthlyTrendPanel,
  RecurringExecutionPanel,
  RecurringFormPanel,
  SettingsFormPanel,
  SimpleList,
  StatsPanel,
  SummaryCards,
  TransactionFormPanel
} from "./ledger-sections";

const emptySummary: MonthlySummary = {
  month: "",
  income: 0,
  expense: 0,
  transfer: 0,
  balance: 0
};

const accountDefaults: AccountFormValues = {
  name: "",
  type: "bank",
  balanceInput: ""
};

const budgetDefaults: BudgetFormValues = {
  categoryId: "",
  amountInput: "",
  month: getTodayInputValue().slice(0, 7)
};

const categoryDefaults: CategoryFormValues = {
  name: "",
  kind: "expense",
  color: "#1c7c54",
  icon: ""
};

const starterAccountTemplates: Array<Pick<AccountFormValues, "name" | "type" | "balanceInput">> = [
  { name: "현금지갑", type: "cash", balanceInput: "0" },
  { name: "생활비 통장", type: "bank", balanceInput: "0" },
  { name: "주거래 카드", type: "card", balanceInput: "0" },
  { name: "비상금 통장", type: "bank", balanceInput: "0" },
  { name: "투자 계좌", type: "investment", balanceInput: "0" }
];

const starterCategoryTemplates: Array<Pick<CategoryFormValues, "name" | "kind" | "color" | "icon">> = [
  { name: "월급", kind: "income", color: "#0f6c66", icon: "salary" },
  { name: "부수입", kind: "income", color: "#1f9d7a", icon: "bonus" },
  { name: "이자/배당", kind: "income", color: "#3ea65a", icon: "interest" },
  { name: "환급/캐시백", kind: "income", color: "#2a8f6d", icon: "cashback" },
  { name: "식비", kind: "expense", color: "#ff7d55", icon: "food" },
  { name: "카페/간식", kind: "expense", color: "#f29f63", icon: "cafe" },
  { name: "교통", kind: "expense", color: "#4c89ff", icon: "transport" },
  { name: "주거/관리비", kind: "expense", color: "#8b74ff", icon: "housing" },
  { name: "통신", kind: "expense", color: "#4b8f8c", icon: "phone" },
  { name: "쇼핑", kind: "expense", color: "#e96aa5", icon: "shopping" },
  { name: "의료/건강", kind: "expense", color: "#eb5f74", icon: "health" },
  { name: "구독", kind: "expense", color: "#7e8a9a", icon: "subscription" },
  { name: "여가/취미", kind: "expense", color: "#ff9860", icon: "hobby" },
  { name: "교육", kind: "expense", color: "#5f7cff", icon: "education" },
  { name: "경조사", kind: "expense", color: "#9c6dd9", icon: "gift" },
  { name: "기타", kind: "expense", color: "#8a8a8a", icon: "etc" }
];

const recurringDefaults: RecurringTransactionFormValues = {
  type: "expense",
  amountInput: "",
  accountId: "",
  categoryId: "",
  transferAccountId: "",
  description: "",
  frequency: "monthly",
  nextRunAt: getTodayInputValue(),
  isActive: true
};

const transactionDefaults: TransactionFormValues = {
  type: "expense",
  amountInput: "",
  occurredAt: getTodayInputValue(),
  accountId: "",
  categoryId: "",
  transferAccountId: "",
  description: ""
};

const profileDefaults: ProfileSettingsFormValues = {
  displayName: "",
  defaultCurrency: "KRW",
  weekStartsOn: 1,
  monthStartDay: 1
};

type PeriodPreset = "this_month" | "last_3_months" | "this_year" | "all" | "custom";
const PERIOD_PRESET_VALUES: PeriodPreset[] = [
  "this_month",
  "last_3_months",
  "this_year",
  "all",
  "custom"
];

function getPresetRange(preset: PeriodPreset) {
  const today = dayjs();

  if (preset === "this_month") {
    return {
      startDate: today.startOf("month").format("YYYY-MM-DD"),
      endDate: today.endOf("month").format("YYYY-MM-DD")
    };
  }

  if (preset === "last_3_months") {
    return {
      startDate: today.subtract(2, "month").startOf("month").format("YYYY-MM-DD"),
      endDate: today.endOf("month").format("YYYY-MM-DD")
    };
  }

  if (preset === "this_year") {
    return {
      startDate: today.startOf("year").format("YYYY-MM-DD"),
      endDate: today.endOf("year").format("YYYY-MM-DD")
    };
  }

  return { startDate: "", endDate: "" };
}

function toProfileFormValues(profile: Profile | null): ProfileSettingsFormValues {
  if (!profile) {
    return profileDefaults;
  }

  return {
    displayName: profile.displayName,
    defaultCurrency: profile.defaultCurrency,
    weekStartsOn: profile.weekStartsOn,
    monthStartDay: profile.monthStartDay
  };
}

function summarizeTransactions(items: LedgerSnapshot["transactions"]): MonthlySummary {
  let income = 0;
  let expense = 0;
  let transfer = 0;

  for (const item of items) {
    if (item.type === "income") income += item.amount;
    else if (item.type === "expense") expense += item.amount;
    else transfer += item.amount;
  }

  return { month: "", income, expense, transfer, balance: income - expense };
}

function normalizeTemplateName(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

type MonthlyTrendPoint = {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
};

type FilterLinkNotice = {
  kind: "success" | "error";
  text: string;
};
type TransactionSort = "occurredAt" | "amount" | "type";
type SortDirection = "desc" | "asc";
type TransactionDisplayMode = "card" | "table";
type ManageSection = "transaction" | "account" | "category" | "budget" | "recurring" | "logs";
type TransactionTableColumn = "account_category" | "memo";
type DashboardWidget = "stats" | "budget" | "trend";
type ToastNotice = { kind: "success" | "error"; text: string };
const TRANSACTION_PAGE_SIZE = 20;
const dashboardOrderStorageKey = "web-dashboard-order-v1";
const collapsedWidgetsStorageKey = "web-dashboard-collapsed-v1";

type WorkspaceView = "calendar" | "dashboard" | "transactions" | "manage" | "settings";
const WORKSPACE_VIEW_VALUES: WorkspaceView[] = [
  "calendar",
  "dashboard",
  "transactions",
  "manage",
  "settings"
];
type SavedFilterPreset = "salary_day" | "fixed_cost" | "meal_expense";
type QuickTransactionTemplate = {
  key: string;
  type: TransactionType;
  amount: number;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string;
  description: string;
  transferAccountId: string | null;
  transferAccountName: string;
  usedCount: number;
};

export function LedgerWorkspace({
  initialSnapshot
}: {
  initialSnapshot: AuthSessionSnapshot;
}) {
  const [authSnapshot, setAuthSnapshot] = useState(initialSnapshot);
  const [actionError, setActionError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [filterLinkNotice, setFilterLinkNotice] = useState<FilterLinkNotice | null>(null);
  const [toastNotice, setToastNotice] = useState<ToastNotice | null>(null);
  const [isCopyingFilterLink, setIsCopyingFilterLink] = useState(false);
  const [isRefreshingLedger, setIsRefreshingLedger] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>("calendar");
  const [searchInput, setSearchInput] = useState("");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this_month");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [accountFilter, setAccountFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [transactionSort, setTransactionSort] = useState<TransactionSort>("occurredAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [transactionDisplayMode, setTransactionDisplayMode] = useState<TransactionDisplayMode>("card");
  const [visibleTableColumns, setVisibleTableColumns] = useState<TransactionTableColumn[]>([
    "account_category",
    "memo"
  ]);
  const [selectedBulkCategoryId, setSelectedBulkCategoryId] = useState("");
  const [transactionPageSize, setTransactionPageSize] = useState(TRANSACTION_PAGE_SIZE);
  const [transactionPage, setTransactionPage] = useState(1);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [manageSection, setManageSection] = useState<ManageSection>("transaction");
  const [dashboardOrder, setDashboardOrder] = useState<DashboardWidget[]>([
    "stats",
    "budget",
    "trend"
  ]);
  const [collapsedWidgets, setCollapsedWidgets] = useState<DashboardWidget[]>([]);
  const [startDate, setStartDate] = useState(getPresetRange("this_month").startDate);
  const [endDate, setEndDate] = useState(getPresetRange("this_month").endDate);
  const [isUrlHydrated, setIsUrlHydrated] = useState(false);
  const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase());
  const queryClient = useQueryClient();
  const copyLockRef = useRef(false);
  const refreshLockRef = useRef(false);
  const starterAutoApplyUserRef = useRef<string | null>(null);

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: accountDefaults
  });
  const budgetForm = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: budgetDefaults
  });
  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: categoryDefaults
  });
  const recurringForm = useForm<RecurringTransactionFormValues>({
    resolver: zodResolver(recurringTransactionFormSchema),
    defaultValues: recurringDefaults
  });
  const transactionForm = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: transactionDefaults
  });
  const profileForm = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsFormSchema),
    defaultValues: profileDefaults
  });

  const transactionType = transactionForm.watch("type");

  const webClient = getWebSupabaseBrowserClient();
  const ledgerQueryKey = useMemo(
    () => ["web-ledger", authSnapshot.userId ?? "guest"] as const,
    [authSnapshot.userId]
  );
  const ledgerQuery = useQuery({
    queryKey: ledgerQueryKey,
    queryFn: async () => {
      if (!webClient) {
        throw new Error("웹용 Supabase 환경변수가 없어서 데이터를 불러오지 못합니다.");
      }
      const [nextLedger, nextProfile] = await Promise.all([
        fetchLedgerSnapshot(webClient),
        fetchProfile(webClient)
      ]);
      return { ledger: nextLedger, profile: nextProfile };
    },
    enabled: authSnapshot.isAuthenticated && Boolean(webClient)
  });

  const ledger = ledgerQuery.data?.ledger ?? null;
  const profile = ledgerQuery.data?.profile ?? null;
  const loading = ledgerQuery.isPending || ledgerQuery.isFetching;
  const recurringExecutionLoading = loading;
  const recurringExecutionError = "";
  const queryError = ledgerQuery.error instanceof Error ? ledgerQuery.error.message : "";
  const error = actionError || queryError;
  const accounts = useMemo(() => ledger?.accounts ?? [], [ledger?.accounts]);
  const allCategories = useMemo(() => ledger?.categories ?? [], [ledger?.categories]);
  const categories = allCategories.filter(
    (item) => transactionType !== "transfer" && item.kind === transactionType
  );
  const missingStarterAccounts = useMemo(() => {
    const existing = new Set(accounts.map((item) => normalizeTemplateName(item.name)));
    return starterAccountTemplates.filter(
      (item) => !existing.has(normalizeTemplateName(item.name))
    );
  }, [accounts]);
  const missingStarterCategories = useMemo(() => {
    const existing = new Set(
      allCategories.map(
        (item) => `${item.kind}:${normalizeTemplateName(item.name)}`
      )
    );
    return starterCategoryTemplates.filter(
      (item) => !existing.has(`${item.kind}:${normalizeTemplateName(item.name)}`)
    );
  }, [allCategories]);
  const defaultFilterRange = getPresetRange("this_month");
  const hasResettableFilters =
    searchInput !== "" ||
    periodPreset !== "this_month" ||
    typeFilter !== "all" ||
    accountFilter !== "" ||
    categoryFilter !== "" ||
    startDate !== defaultFilterRange.startDate ||
    endDate !== defaultFilterRange.endDate;

  const refreshLedger = useCallback(async () => {
    setActionError("");
    await queryClient.invalidateQueries({ queryKey: ledgerQueryKey });
  }, [ledgerQueryKey, queryClient]);
  const showToast = useCallback((kind: "success" | "error", text: string) => {
    setToastNotice({ kind, text });
  }, []);

  const resetFilters = useCallback(() => {
    setSearchInput("");
    setPeriodPreset("this_month");
    setTypeFilter("all");
    setAccountFilter("");
    setCategoryFilter("");
    setTransactionSort("occurredAt");
    setSortDirection("desc");
    setTransactionDisplayMode("card");
    setTransactionPageSize(20);
    setTransactionPage(1);
    const range = getPresetRange("this_month");
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }, []);

  const copyCurrentFilterUrl = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (copyLockRef.current) {
      return;
    }

    copyLockRef.current = true;
    setIsCopyingFilterLink(true);

    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setFilterLinkNotice({
        kind: "success",
        text: "필터 링크를 복사했습니다."
      });
    } catch {
      setFilterLinkNotice({
        kind: "error",
        text: "링크 복사에 실패했습니다. 주소창을 직접 복사해주세요."
      });
    } finally {
      copyLockRef.current = false;
      setIsCopyingFilterLink(false);
    }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    if (refreshLockRef.current) {
      return;
    }

    refreshLockRef.current = true;
    setIsRefreshingLedger(true);

    try {
      await refreshLedger();
    } finally {
      refreshLockRef.current = false;
      setIsRefreshingLedger(false);
    }
  }, [refreshLedger]);

  const saveTransactionMutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      if (!webClient || !authSnapshot.userId) {
        throw new Error("로그인 상태를 확인해주세요.");
      }
      return saveTransaction(webClient, authSnapshot.userId, values);
    },
    onSuccess: async () => {
      showToast("success", "거래를 저장했습니다.");
      await refreshLedger();
    }
  });

  const saveAccountMutation = useMutation({
    mutationFn: async (values: AccountFormValues) => {
      if (!webClient || !authSnapshot.userId) {
        throw new Error("로그인 상태를 확인해주세요.");
      }
      return saveAccount(webClient, authSnapshot.userId, values);
    },
    onSuccess: async () => {
      showToast("success", "계정을 저장했습니다.");
      await refreshLedger();
    }
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      if (!webClient || !authSnapshot.userId) {
        throw new Error("로그인 상태를 확인해주세요.");
      }
      return saveCategory(webClient, authSnapshot.userId, values);
    },
    onSuccess: async () => {
      showToast("success", "카테고리를 저장했습니다.");
      await refreshLedger();
    }
  });

  const applyStarterPackMutation = useMutation({
    mutationFn: async () => {
      if (!webClient || !authSnapshot.userId) {
        throw new Error("로그인 상태를 확인해주세요.");
      }

      for (const account of missingStarterAccounts) {
        await saveAccount(webClient, authSnapshot.userId, account);
      }

      for (const category of missingStarterCategories) {
        await saveCategory(webClient, authSnapshot.userId, category);
      }
    },
    onSuccess: async () => {
      const createdAccountCount = missingStarterAccounts.length;
      const createdCategoryCount = missingStarterCategories.length;
      showToast(
        "success",
        `스타터 팩 적용 완료: 계정 ${createdAccountCount}개, 카테고리 ${createdCategoryCount}개`
      );
      await refreshLedger();
    }
  });

  useEffect(() => {
    if (!authSnapshot.isAuthenticated || !authSnapshot.userId) {
      return;
    }

    if (!webClient || !ledger) {
      return;
    }

    if (accounts.length > 0 || allCategories.length > 0) {
      return;
    }

    if (
      applyStarterPackMutation.isPending ||
      starterAutoApplyUserRef.current === authSnapshot.userId
    ) {
      return;
    }

    starterAutoApplyUserRef.current = authSnapshot.userId;
    void applyStarterPackMutation.mutateAsync();
  }, [
    accounts.length,
    allCategories.length,
    applyStarterPackMutation,
    authSnapshot.isAuthenticated,
    authSnapshot.userId,
    ledger,
    webClient
  ]);

  const saveBudgetMutation = useMutation({
    mutationFn: async (values: BudgetFormValues) => {
      if (!webClient || !authSnapshot.userId) {
        throw new Error("로그인 상태를 확인해주세요.");
      }
      return saveBudget(webClient, authSnapshot.userId, values);
    },
    onSuccess: async () => {
      showToast("success", "예산을 저장했습니다.");
      await refreshLedger();
    }
  });

  const saveRecurringMutation = useMutation({
    mutationFn: async (values: RecurringTransactionFormValues) => {
      if (!webClient || !authSnapshot.userId) {
        throw new Error("로그인 상태를 확인해주세요.");
      }
      return saveRecurringTransaction(webClient, authSnapshot.userId, values);
    },
    onSuccess: async () => {
      showToast("success", "반복거래를 저장했습니다.");
      await refreshLedger();
    }
  });

  const archiveAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!webClient) {
        throw new Error("웹용 Supabase 환경변수를 확인해 주세요.");
      }
      await archiveAccount(webClient, id);
    },
    onSuccess: async () => {
      showToast("success", "계정을 보관했습니다.");
      await refreshLedger();
    }
  });

  const archiveCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!webClient) {
        throw new Error("웹용 Supabase 환경변수를 확인해 주세요.");
      }
      await archiveCategory(webClient, id);
    },
    onSuccess: async () => {
      showToast("success", "카테고리를 보관했습니다.");
      await refreshLedger();
    }
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!webClient) {
        throw new Error("웹용 Supabase 환경변수를 확인해 주세요.");
      }
      await deleteBudget(webClient, id);
    },
    onSuccess: async () => {
      showToast("success", "예산을 삭제했습니다.");
      await refreshLedger();
    }
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!webClient) {
        throw new Error("웹용 Supabase 환경변수를 확인해 주세요.");
      }
      await deleteRecurringTransaction(webClient, id);
    },
    onSuccess: async () => {
      showToast("success", "반복거래를 삭제했습니다.");
      await refreshLedger();
    }
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!webClient) {
        throw new Error("웹용 Supabase 환경변수를 확인해주세요.");
      }
      await deleteTransaction(webClient, id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ledgerQueryKey });
      const previous = queryClient.getQueryData<{
        ledger: LedgerSnapshot;
        profile: Profile | null;
      }>(ledgerQueryKey);

      if (previous) {
        queryClient.setQueryData(ledgerQueryKey, {
          ...previous,
          ledger: {
            ...previous.ledger,
            transactions: previous.ledger.transactions.filter((item) => item.id !== id)
          }
        });
      }

      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ledgerQueryKey, context.previous);
      }
    },
    onSettled: async () => {
      await refreshLedger();
    }
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (values: ProfileSettingsFormValues) => {
      if (!webClient || !authSnapshot.userId) {
        throw new Error("로그인 상태를 확인해주세요.");
      }
      return saveProfileSettings(webClient, authSnapshot.userId, values);
    },
    onMutate: async (values: ProfileSettingsFormValues) => {
      await queryClient.cancelQueries({ queryKey: ledgerQueryKey });
      const previous = queryClient.getQueryData<{
        ledger: LedgerSnapshot;
        profile: Profile | null;
      }>(ledgerQueryKey);

      if (previous?.profile) {
        queryClient.setQueryData(ledgerQueryKey, {
          ...previous,
          profile: {
            ...previous.profile,
            displayName: values.displayName,
            defaultCurrency: values.defaultCurrency,
            weekStartsOn: values.weekStartsOn,
            monthStartDay: values.monthStartDay
          }
        });
      }

      return { previous };
    },
    onError: (_error, _values, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ledgerQueryKey, context.previous);
      }
    },
    onSuccess: async () => {
      setSettingsMessage("기본 설정을 저장했습니다.");
      showToast("success", "기본 설정을 저장했습니다.");
      await refreshLedger();
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    const nextView: WorkspaceView = WORKSPACE_VIEW_VALUES.includes(viewParam as WorkspaceView)
      ? (viewParam as WorkspaceView)
      : "calendar";
    const nextSearch = params.get("q") ?? "";
    const presetParam = params.get("preset");
    const nextPreset: PeriodPreset = PERIOD_PRESET_VALUES.includes(
      presetParam as PeriodPreset
    )
      ? (presetParam as PeriodPreset)
      : "this_month";
    const typeParam = params.get("type");
    const nextTypeFilter: "all" | TransactionType =
      typeParam === "income" || typeParam === "expense" || typeParam === "transfer"
        ? typeParam
        : "all";
    const nextAccount = params.get("account") ?? "";
    const nextCategory = params.get("category") ?? "";
    const sortParam = params.get("tsort");
    const dirParam = params.get("tdir");
    const displayParam = params.get("tview");
    const pageSizeParam = params.get("tsize");
    const columnsParam = params.get("tcols");
    const manageParam = params.get("mtab");
    const nextSort: TransactionSort =
      sortParam === "amount" || sortParam === "type" ? sortParam : "occurredAt";
    const nextDir: SortDirection = dirParam === "asc" ? "asc" : "desc";
    const nextDisplay: TransactionDisplayMode = displayParam === "table" ? "table" : "card";
    const nextPageSize =
      pageSizeParam === "50" || pageSizeParam === "100" ? Number(pageSizeParam) : 20;
    const parsedColumns = (columnsParam ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is TransactionTableColumn =>
        value === "account_category" || value === "memo"
      );
    const nextVisibleColumns: TransactionTableColumn[] =
      parsedColumns.length > 0 ? parsedColumns : ["account_category", "memo"];
    const nextManageSection: ManageSection =
      manageParam === "account" ||
      manageParam === "category" ||
      manageParam === "budget" ||
      manageParam === "recurring" ||
      manageParam === "logs"
        ? manageParam
        : "transaction";
    const nextStartDate = params.get("start") ?? "";
    const nextEndDate = params.get("end") ?? "";

    setActiveView(nextView);
    setSearchInput(nextSearch);
    setPeriodPreset(nextPreset);
    setTypeFilter(nextTypeFilter);
    setAccountFilter(nextAccount);
    setCategoryFilter(nextCategory);
    setTransactionSort(nextSort);
    setSortDirection(nextDir);
    setTransactionDisplayMode(nextDisplay);
    setTransactionPageSize(nextPageSize);
    setVisibleTableColumns(nextVisibleColumns);
    setManageSection(nextManageSection);

    if (nextPreset === "custom") {
      setStartDate(nextStartDate);
      setEndDate(nextEndDate);
    } else if (nextStartDate || nextEndDate) {
      setStartDate(nextStartDate);
      setEndDate(nextEndDate);
    }

    setIsUrlHydrated(true);
  }, []);

  useEffect(() => {
    if (!isUrlHydrated || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string, defaultValue = "") => {
      if (!value || value === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    };

    setOrDelete("view", activeView, "calendar");
    setOrDelete("q", searchInput);
    setOrDelete("preset", periodPreset, "this_month");
    setOrDelete("type", typeFilter, "all");
    setOrDelete("account", accountFilter);
    setOrDelete("category", categoryFilter);
    setOrDelete("tsort", transactionSort, "occurredAt");
    setOrDelete("tdir", sortDirection, "desc");
    setOrDelete("tview", transactionDisplayMode, "card");
    setOrDelete("tsize", String(transactionPageSize), "20");
    setOrDelete(
      "tcols",
      visibleTableColumns.join(","),
      "account_category,memo"
    );
    setOrDelete("mtab", manageSection, "transaction");
    setOrDelete("start", startDate);
    setOrDelete("end", endDate);

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [
    activeView,
    accountFilter,
    categoryFilter,
    endDate,
    isUrlHydrated,
    manageSection,
    periodPreset,
    searchInput,
    sortDirection,
    startDate,
    transactionDisplayMode,
    transactionPageSize,
    transactionSort,
    typeFilter,
    visibleTableColumns
  ]);

  useEffect(() => {
    if (periodPreset === "custom") {
      return;
    }

    const range = getPresetRange(periodPreset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }, [periodPreset]);

  useEffect(() => {
    if (!filterLinkNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFilterLinkNotice(null);
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [filterLinkNotice]);

  useEffect(() => {
    if (!toastNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToastNotice(null);
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [toastNotice]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(dashboardOrderStorageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as string[];
      const valid: DashboardWidget[] = ["stats", "budget", "trend"];
      const next = parsed.filter((item): item is DashboardWidget =>
        valid.includes(item as DashboardWidget)
      );

      if (next.length === valid.length) {
        setDashboardOrder(next);
      }
    } catch {
      // ignore storage parse errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(dashboardOrderStorageKey, JSON.stringify(dashboardOrder));
    } catch {
      // ignore storage write errors
    }
  }, [dashboardOrder]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(collapsedWidgetsStorageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as string[];
      const valid: DashboardWidget[] = ["stats", "budget", "trend"];
      const next = parsed.filter((item): item is DashboardWidget =>
        valid.includes(item as DashboardWidget)
      );
      setCollapsedWidgets(next);
    } catch {
      // ignore storage parse errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        collapsedWidgetsStorageKey,
        JSON.stringify(collapsedWidgets)
      );
    } catch {
      // ignore storage write errors
    }
  }, [collapsedWidgets]);

  useEffect(() => {
    const client = getWebSupabaseBrowserClient();

    if (!client) {
      setActionError(
        "웹용 Supabase 환경변수가 없어서 데이터를 불러오지 못합니다."
      );
      return;
    }

    const sync = async () => {
      const {
        data: { session }
      } = await client.auth.getSession();

      setAuthSnapshot({
        source: "client",
        hasEnv: true,
        isAuthenticated: Boolean(session?.user),
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null
      });

      if (session?.user) {
        await refreshLedger();
      } else {
        setSettingsMessage("");
        setActionError("");
      }
    };

    sync().catch((nextError: unknown) => {
      setActionError(
        nextError instanceof Error
          ? nextError.message
          : "데이터 준비 중 오류가 발생했습니다."
      );
    });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange(async (_event, session) => {
      setAuthSnapshot({
        source: "client",
        hasEnv: true,
        isAuthenticated: Boolean(session?.user),
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null
      });

      if (session?.user) {
        await refreshLedger();
      } else {
        setSettingsMessage("");
        setActionError("");
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshLedger]);

  useEffect(() => {
    if (!ledger) {
      return;
    }

    if (!transactionForm.getValues("accountId") && ledger.accounts[0]) {
      transactionForm.setValue("accountId", ledger.accounts[0].id);
    }
  }, [ledger, transactionForm]);

  useEffect(() => {
    profileForm.reset(toProfileFormValues(profile));
  }, [profile, profileForm]);

  const filteredTransactions = (ledger?.transactions ?? []).filter((item) => {
    const occurredAt = dayjs(item.occurredAt);

    if (typeFilter !== "all" && item.type !== typeFilter) {
      return false;
    }

    if (accountFilter && item.accountId !== accountFilter) {
      return false;
    }

    if (categoryFilter && item.categoryId !== categoryFilter) {
      return false;
    }

    if (startDate && occurredAt.isBefore(dayjs(startDate), "day")) {
      return false;
    }

    if (endDate && occurredAt.isAfter(dayjs(endDate), "day")) {
      return false;
    }

    if (deferredSearch) {
      const target = [
        item.description ?? "",
        item.accountName ?? "",
        item.categoryName ?? "",
        item.transferAccountName ?? ""
      ]
        .join(" ")
        .toLowerCase();

      if (!target.includes(deferredSearch)) {
        return false;
      }
    }

    return true;
  });

  const filteredSummary = summarizeTransactions(filteredTransactions);
  const sortedTransactions = useMemo(() => {
    const copied = [...filteredTransactions];
    const direction = sortDirection === "asc" ? 1 : -1;

    copied.sort((left, right) => {
      if (transactionSort === "amount") {
        return (left.amount - right.amount) * direction;
      }

      if (transactionSort === "type") {
        return left.type.localeCompare(right.type, "ko") * direction;
      }

      return (
        (dayjs(left.occurredAt).valueOf() - dayjs(right.occurredAt).valueOf()) * direction
      );
    });

    return copied;
  }, [filteredTransactions, sortDirection, transactionSort]);
  const toggleTransactionSort = useCallback((nextSort: TransactionSort) => {
    if (transactionSort === nextSort) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }

    setTransactionSort(nextSort);
    setSortDirection("desc");
  }, [transactionSort]);
  const toggleTableColumn = useCallback((column: TransactionTableColumn) => {
    setVisibleTableColumns((prev) => {
      const hasColumn = prev.includes(column);

      if (hasColumn) {
        const next = prev.filter((value) => value !== column);
        return next.length ? next : prev;
      }

      return [...prev, column];
    });
  }, []);
  const moveDashboardWidget = useCallback((widget: DashboardWidget, direction: -1 | 1) => {
    setDashboardOrder((prev) => {
      const index = prev.indexOf(widget);
      if (index < 0) {
        return prev;
      }

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const copied = [...prev];
      const [target] = copied.splice(index, 1);
      copied.splice(nextIndex, 0, target);
      return copied;
    });
  }, []);
  const hasAccountCategoryColumn = visibleTableColumns.includes("account_category");
  const hasMemoColumn = visibleTableColumns.includes("memo");
  const toggleTransactionSelection = useCallback((id: string) => {
    setSelectedTransactionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);
  const selectedTransactions = useMemo(
    () => sortedTransactions.filter((item) => selectedTransactionIds.includes(item.id)),
    [selectedTransactionIds, sortedTransactions]
  );
  const bulkAssignableCategories = useMemo(
    () => (ledger?.categories ?? []).filter((item) => item.kind === "expense" || item.kind === "income"),
    [ledger?.categories]
  );
  const applySavedFilterPreset = useCallback((preset: SavedFilterPreset) => {
    const thisMonth = getPresetRange("this_month");
    setPeriodPreset("this_month");
    setStartDate(thisMonth.startDate);
    setEndDate(thisMonth.endDate);
    setAccountFilter("");
    setCategoryFilter("");
    setSortDirection("desc");
    setTransactionSort("occurredAt");
    setTransactionPage(1);

    if (preset === "salary_day") {
      setTypeFilter("income");
      setSearchInput("월급");
      return;
    }

    if (preset === "fixed_cost") {
      setTypeFilter("expense");
      setSearchInput("고정");
      return;
    }

    const mealCategory = (ledger?.categories ?? []).find(
      (item) => item.kind === "expense" && item.name.includes("식비")
    );
    setTypeFilter("expense");
    setSearchInput(mealCategory ? "" : "식비");
    setCategoryFilter(mealCategory?.id ?? "");
  }, [ledger?.categories]);
  const bulkDeleteSelectedTransactions = useCallback(async () => {
    if (!selectedTransactions.length) {
      return;
    }

    if (!webClient) {
      showToast("error", "웹용 Supabase 환경변수를 확인해주세요.");
      return;
    }

    try {
      setActionError("");
      for (const item of selectedTransactions) {
        await deleteTransaction(webClient, item.id);
      }
      setSelectedTransactionIds([]);
      showToast("success", `${selectedTransactions.length}건을 삭제했습니다.`);
      await refreshLedger();
    } catch (nextError) {
      showToast("error", "선택 거래 삭제 중 오류가 발생했습니다.");
      setActionError(
        nextError instanceof Error
          ? nextError.message
          : "선택 거래 삭제 중 오류가 발생했습니다."
      );
    }
  }, [refreshLedger, selectedTransactions, showToast, webClient]);
  const bulkUpdateSelectedTransactionCategory = useCallback(async () => {
    if (!selectedTransactions.length) {
      showToast("error", "먼저 거래를 선택해주세요.");
      return;
    }

    if (!selectedBulkCategoryId) {
      showToast("error", "일괄 적용할 카테고리를 선택해주세요.");
      return;
    }

    if (!webClient) {
      showToast("error", "웹용 Supabase 환경변수를 확인해주세요.");
      return;
    }

    const category = (ledger?.categories ?? []).find((item) => item.id === selectedBulkCategoryId);
    if (!category) {
      showToast("error", "선택한 카테고리를 찾을 수 없습니다.");
      return;
    }

    const applicableIds = selectedTransactions
      .filter((item) => (item.type === "income" || item.type === "expense") && item.type === category.kind)
      .map((item) => item.id);
    const skippedCount = selectedTransactions.length - applicableIds.length;

    if (!applicableIds.length) {
      showToast("error", "선택한 거래와 카테고리 유형이 맞지 않습니다.");
      return;
    }

    try {
      setActionError("");
      const updatedCount = await updateTransactionsCategory(
        webClient,
        applicableIds,
        selectedBulkCategoryId
      );
      setSelectedTransactionIds((prev) => prev.filter((id) => !applicableIds.includes(id)));
      showToast(
        "success",
        `${updatedCount}건 카테고리를 변경했습니다.${skippedCount > 0 ? ` (${skippedCount}건 제외)` : ""}`
      );
      await refreshLedger();
    } catch (nextError) {
      showToast("error", "일괄 카테고리 변경 중 오류가 발생했습니다.");
      setActionError(
        nextError instanceof Error
          ? nextError.message
          : "일괄 카테고리 변경 중 오류가 발생했습니다."
      );
    }
  }, [ledger?.categories, refreshLedger, selectedBulkCategoryId, selectedTransactions, showToast, webClient]);
  const toggleWidgetCollapsed = useCallback((widget: DashboardWidget) => {
    setCollapsedWidgets((prev) =>
      prev.includes(widget) ? prev.filter((item) => item !== widget) : [...prev, widget]
    );
  }, []);
  const totalTransactionPages = Math.max(
    1,
    Math.ceil(sortedTransactions.length / transactionPageSize)
  );
  const pagedTransactions = useMemo(() => {
    const startIndex = (transactionPage - 1) * transactionPageSize;
    return sortedTransactions.slice(startIndex, startIndex + transactionPageSize);
  }, [sortedTransactions, transactionPage, transactionPageSize]);
  const allPagedSelected =
    pagedTransactions.length > 0 &&
    pagedTransactions.every((item) => selectedTransactionIds.includes(item.id));
  const toggleSelectAllPaged = useCallback(() => {
    setSelectedTransactionIds((prev) => {
      if (allPagedSelected) {
        const pageIdSet = new Set(pagedTransactions.map((item) => item.id));
        return prev.filter((id) => !pageIdSet.has(id));
      }

      const next = new Set(prev);
      for (const item of pagedTransactions) {
        next.add(item.id);
      }
      return [...next];
    });
  }, [allPagedSelected, pagedTransactions]);
  useEffect(() => {
    if (transactionPage > totalTransactionPages) {
      setTransactionPage(totalTransactionPages);
      return;
    }

    if (transactionPage < 1) {
      setTransactionPage(1);
    }
  }, [totalTransactionPages, transactionPage]);
  useEffect(() => {
    const validIds = new Set(sortedTransactions.map((item) => item.id));
    setSelectedTransactionIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [sortedTransactions]);
  const monthlyTrend = useMemo<MonthlyTrendPoint[]>(() => {
    const transactions = ledger?.transactions ?? [];
    const monthKeys = Array.from({ length: 6 }, (_, index) =>
      dayjs().subtract(5 - index, "month").format("YYYY-MM")
    );
    const points = new Map<string, MonthlyTrendPoint>(
      monthKeys.map((monthKey) => [
        monthKey,
        {
          monthKey,
          label: dayjs(`${monthKey}-01`).format("YYYY.MM"),
          income: 0,
          expense: 0,
          balance: 0
        }
      ])
    );

    for (const item of transactions) {
      const monthKey = dayjs(item.occurredAt).format("YYYY-MM");
      const target = points.get(monthKey);

      if (!target) {
        continue;
      }

      if (item.type === "income") {
        target.income += item.amount;
      } else if (item.type === "expense") {
        target.expense += item.amount;
      }

      target.balance = target.income - target.expense;
    }

    return monthKeys.map((monthKey) => {
      const point = points.get(monthKey);

      if (!point) {
        return {
          monthKey,
          label: dayjs(`${monthKey}-01`).format("YYYY.MM"),
          income: 0,
          expense: 0,
          balance: 0
        };
      }

      return point;
    });
  }, [ledger?.transactions]);
  const budgetInsightItems = useMemo(() => {
    const budgetRows = ledger?.monthlyStats.budgetProgress ?? [];
    return budgetRows
      .filter((item) => item.percentUsed > 100)
      .sort((left, right) => right.percentUsed - left.percentUsed)
      .slice(0, 3)
      .map((item) => ({
        categoryName: item.categoryName ?? "카테고리",
        percentUsed: item.percentUsed,
        overAmount: Math.max(0, item.spentAmount - item.budgetAmount)
      }));
  }, [ledger?.monthlyStats.budgetProgress]);
  const topExpenseCategoryItems = useMemo(() => {
    return (ledger?.monthlyStats.categoryBreakdown ?? []).slice(0, 3);
  }, [ledger?.monthlyStats.categoryBreakdown]);
  const quickTransactionTemplates = useMemo<QuickTransactionTemplate[]>(() => {
    const source = ledger?.transactions ?? [];
    const map = new Map<string, QuickTransactionTemplate>();

    for (const item of source) {
      const normalizedDescription = (item.description ?? "").trim();
      const signature = [
        item.type,
        item.accountId,
        item.categoryId ?? "",
        item.transferAccountId ?? "",
        normalizedDescription
      ].join("|");
      const current = map.get(signature);

      if (!current) {
        map.set(signature, {
          key: signature,
          type: item.type,
          amount: item.amount,
          accountId: item.accountId,
          accountName: item.accountName ?? "계정",
          categoryId: item.categoryId ?? null,
          categoryName: item.categoryName ?? "",
          description: normalizedDescription,
          transferAccountId: item.transferAccountId ?? null,
          transferAccountName: item.transferAccountName ?? "",
          usedCount: 1
        });
        continue;
      }

      current.usedCount += 1;
      current.amount = item.amount;
      current.accountName = item.accountName ?? current.accountName;
      current.categoryName = item.categoryName ?? current.categoryName;
      current.transferAccountName = item.transferAccountName ?? current.transferAccountName;
    }

    return [...map.values()]
      .sort((left, right) => {
        if (right.usedCount !== left.usedCount) {
          return right.usedCount - left.usedCount;
        }
        return right.amount - left.amount;
      })
      .slice(0, 5);
  }, [ledger?.transactions]);

  const workspaceViews: Array<{
    value: WorkspaceView;
    label: string;
    description: string;
  }> = [
    { value: "calendar", label: "월별 달력", description: "달력으로 입출금 한눈에 보기" },
    { value: "dashboard", label: "대시보드", description: "월간 통계와 지출 비중" },
    { value: "transactions", label: "거래 검토", description: "검색/필터/내보내기" },
    { value: "manage", label: "관리", description: "계정/카테고리/예산/반복거래" },
    { value: "settings", label: "설정", description: "표시 및 기본 환경" }
  ];
  const manageSections: Array<{
    key: ManageSection;
    label: string;
    description: string;
  }> = [
    { key: "transaction", label: "빠른 입력", description: "오늘 거래 빠르게 등록" },
    { key: "account", label: "계정", description: "계좌/지갑 목록 관리" },
    { key: "category", label: "카테고리", description: "수입/지출 분류 관리" },
    { key: "budget", label: "예산", description: "월별 카테고리 예산 관리" },
    { key: "recurring", label: "반복거래", description: "정기 거래 자동 반영 준비" },
    { key: "logs", label: "실행로그", description: "반복 배치 실행 상태 확인" }
  ];
  const manageSectionMeta =
    manageSections.find((item) => item.key === manageSection) ?? manageSections[0];
  const activeViewMeta =
    workspaceViews.find((view) => view.value === activeView) ?? workspaceViews[0];

  const prefillTransactionForm = useCallback((id: string) => {
    const target = filteredTransactions.find((item) => item.id === id);
    if (!target) {
      return;
    }

    transactionForm.reset({
      id: target.id,
      type: target.type,
      amountInput: String(target.amount),
      occurredAt: target.occurredAt.slice(0, 10),
      accountId: target.accountId,
      categoryId: target.categoryId ?? "",
      transferAccountId: target.transferAccountId ?? "",
      description: target.description ?? ""
    });
    setActiveView("manage");
    setManageSection("transaction");
  }, [filteredTransactions, transactionForm]);
  const openQuickAddForDate = useCallback((dateKey: string) => {
    const current = transactionForm.getValues();
    transactionForm.reset({
      ...current,
      id: undefined,
      occurredAt: dateKey
    });
    setActiveView("manage");
    setManageSection("transaction");
    showToast("success", "선택 날짜로 빠른 입력 화면을 열었습니다.");
  }, [showToast, transactionForm]);

  const deleteTransactionById = useCallback(async (id: string) => {
    try {
      setActionError("");
      await deleteTransactionMutation.mutateAsync(id);
      showToast("success", "거래를 삭제했습니다.");
    } catch (nextError) {
      showToast("error", "거래 삭제에 실패했습니다.");
      setActionError(
        nextError instanceof Error
          ? nextError.message
          : "거래 삭제 중 오류가 발생했습니다."
      );
    }
  }, [deleteTransactionMutation, showToast]);

  if (!authSnapshot.isAuthenticated) {
    return (
      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card-strong)] p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-xl font-semibold">
          {"거래 관리"}
        </h2>
        <p className="mt-3 text-sm text-stone-600">
          {
            "로그인 후 계정, 카테고리, 거래를 실제 데이터로 관리할 수 있습니다."
          }
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-strong)] p-4 shadow-[var(--shadow-soft)] lg:sticky lg:top-6 lg:h-fit">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
          {"Workspace"}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {workspaceViews.map((view) => (
            <button
              key={view.value}
              className={`rounded-2xl px-4 py-3 text-left transition ${
                activeView === view.value
                  ? "bg-[color:var(--point)] text-white shadow-[0_10px_24px_rgba(21,93,73,0.26)]"
                  : "bg-[var(--card-strong)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-soft)]"
              }`}
              onClick={() => setActiveView(view.value)}
              type="button"
            >
              <p className="text-sm font-semibold">{view.label}</p>
              <p
                className={`mt-1 text-xs ${
                  activeView === view.value ? "text-white/80" : "text-[color:var(--muted-foreground)]"
                }`}
              >
                {view.description}
              </p>
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
            {"Quick Action"}
          </p>
          <div className="mt-2 grid gap-2">
            <button
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-left text-sm"
              onClick={() => {
                setActiveView("manage");
                setManageSection("transaction");
              }}
              type="button"
            >
              {"빠른 입력 열기"}
            </button>
            <button
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-left text-sm"
              onClick={() => setActiveView("transactions")}
              type="button"
            >
              {"거래 검토 이동"}
            </button>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            {`현재 화면: ${activeViewMeta.label}`}
          </p>
        </div>
      </aside>

      <div className="flex flex-col gap-6">
        <div className="overflow-x-auto lg:hidden">
          <div className="flex min-w-max gap-2">
            {workspaceViews.map((view) => (
              <button
                key={`mobile-${view.value}`}
                className={`rounded-full px-4 py-2 text-sm ${
                  activeView === view.value
                    ? "bg-[color:var(--point)] text-white"
                    : "border border-[color:var(--border)] bg-white text-[color:var(--foreground)]"
                }`}
                onClick={() => setActiveView(view.value)}
                type="button"
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

      <section className={`grid gap-6 ${activeView === "manage" ? "lg:grid-cols-[1.25fr_0.95fr]" : ""} ${activeView === "settings" ? "hidden" : ""}`}>
      <div className="flex flex-col gap-6">
        <div id="web-dashboard" />
        <div className={activeView === "dashboard" ? "" : "hidden"}>
          <SummaryCards summary={ledger?.summary ?? emptySummary} loading={loading} />
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
                {"Monthly Insight"}
              </p>
              <h3 className="mt-2 text-base font-semibold text-[var(--foreground)]">
                {"예산 초과 카테고리 Top 3"}
              </h3>
              {!budgetInsightItems.length ? (
                <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted-foreground)]">
                  {"이번 달 예산 초과 카테고리가 없습니다. 좋은 흐름이에요."}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {budgetInsightItems.map((item) => (
                    <div key={`budget-insight-${item.categoryName}`} className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-3">
                      <p className="text-sm font-semibold text-rose-700">{item.categoryName}</p>
                      <p className="mt-1 text-xs text-rose-700">
                        {`사용률 ${item.percentUsed.toFixed(1)}% · 초과 ${formatCurrency(item.overAmount)}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
                {"Spending Focus"}
              </p>
              <h3 className="mt-2 text-base font-semibold text-[var(--foreground)]">
                {"지출 비중 상위 카테고리"}
              </h3>
              {!topExpenseCategoryItems.length ? (
                <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted-foreground)]">
                  {"지출 데이터가 쌓이면 핵심 카테고리 분석이 표시됩니다."}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {topExpenseCategoryItems.map((item) => (
                    <div key={`expense-top-${item.categoryId}`} className="rounded-xl border border-[var(--border)] bg-white px-3 py-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{item.categoryName}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {`${item.percentage.toFixed(1)}% · ${formatCurrency(item.amount)}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
            <p className="text-sm font-medium text-stone-700">{"위젯 순서"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {dashboardOrder.map((widget, index) => {
                const label =
                  widget === "stats"
                    ? "소비 비중"
                    : widget === "budget"
                      ? "예산 진행률"
                      : "최근 6개월 추이";

                return (
                  <div
                    key={`order-${widget}`}
                    className="flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs"
                  >
                    <span>{label}</span>
                    <button
                      className="rounded-full border border-[var(--border)] px-2 py-0.5 disabled:opacity-40"
                      disabled={index === 0}
                      onClick={() => moveDashboardWidget(widget, -1)}
                      type="button"
                    >
                      {"↑"}
                    </button>
                    <button
                      className="rounded-full border border-[var(--border)] px-2 py-0.5 disabled:opacity-40"
                      disabled={index === dashboardOrder.length - 1}
                      onClick={() => moveDashboardWidget(widget, 1)}
                      type="button"
                    >
                      {"↓"}
                    </button>
                    <button
                      className="rounded-full border border-[var(--border)] px-2 py-0.5"
                      onClick={() => toggleWidgetCollapsed(widget)}
                      type="button"
                    >
                      {collapsedWidgets.includes(widget) ? "열기" : "접기"}
                    </button>
                    <button
                      className="rounded-full border border-[var(--border)] px-2 py-0.5"
                      onClick={() => void handleManualRefresh()}
                      type="button"
                    >
                      {"새로고침"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <section className="mt-6 grid gap-4 xl:grid-cols-3">
            {dashboardOrder.map((widget) => {
              if (collapsedWidgets.includes(widget)) {
                const compactLabel =
                  widget === "stats"
                    ? "소비 비중"
                    : widget === "budget"
                      ? "예산 진행률"
                      : "최근 6개월 추이";

                return (
                  <article
                    key={`widget-collapsed-${widget}`}
                    className="rounded-[24px] border border-[var(--border)] bg-[var(--card-strong)] shadow-[var(--shadow-soft)] px-5 py-4 text-sm text-stone-600"
                  >
                    {`${compactLabel} 위젯이 접혀 있습니다.`}
                  </article>
                );
              }

              if (widget === "stats") {
                return <StatsPanel key="widget-stats" ledger={ledger} />;
              }

              if (widget === "budget") {
                return <BudgetProgressPanel key="widget-budget" ledger={ledger} />;
              }

              return (
                <MonthlyTrendPanel
                  key="widget-trend"
                  data={monthlyTrend}
                  loading={loading}
                />
              );
            })}
          </section>
        </div>

        <section className={`rounded-[24px] border border-[var(--border)] bg-[var(--card-strong)] p-6 shadow-[var(--shadow-soft)] ${activeView === "transactions" || activeView === "calendar" ? "" : "hidden"}`} id="web-transactions">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {activeView === "calendar" ? "월별 달력 입출금" : "거래 검토 및 필터"}
            </h2>
            {activeView === "transactions" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isCopyingFilterLink}
                  onClick={() => void copyCurrentFilterUrl()}
                  type="button"
                >
                  {isCopyingFilterLink ? "복사 중..." : "링크 복사"}
                </button>
                <button
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!hasResettableFilters}
                  onClick={resetFilters}
                  type="button"
                >
                  {"필터 초기화"}
                </button>
                <button
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => exportTransactionsAsCsv(filteredTransactions)}
                  type="button"
                >
                  {"CSV Export"}
                </button>
                <button
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => exportTransactionsAsXlsx(filteredTransactions)}
                  type="button"
                >
                  {"XLSX Export"}
                </button>
                <button
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading || isRefreshingLedger}
                  onClick={() => void handleManualRefresh()}
                  type="button"
                >
                  {loading || isRefreshingLedger ? "새로고침 중..." : "새로고침"}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
                  onClick={() => {
                    setPeriodPreset("this_month");
                    const range = getPresetRange("this_month");
                    setStartDate(range.startDate);
                    setEndDate(range.endDate);
                    setTransactionSort("occurredAt");
                    setSortDirection("desc");
                  }}
                  type="button"
                >
                  {"이번 달 기준"}
                </button>
                <button
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
                  onClick={() => {
                    setActiveView("manage");
                    setManageSection("transaction");
                  }}
                  type="button"
                >
                  {"빠른 입력 열기"}
                </button>
              </div>
            )}
          </div>

          {filterLinkNotice ? (
            <p
              className={`mt-3 rounded-2xl px-4 py-3 text-sm ${
                filterLinkNotice.kind === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {filterLinkNotice.text}
            </p>
          ) : null}

          <div className={`mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] shadow-[var(--shadow-soft)] px-3 py-3 ${activeView === "transactions" ? "" : "hidden"}`}>
            <p className="text-xs font-medium text-stone-600">{"저장 필터 프리셋"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs"
                onClick={() => applySavedFilterPreset("salary_day")}
                type="button"
              >
                {"월급일"}
              </button>
              <button
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs"
                onClick={() => applySavedFilterPreset("fixed_cost")}
                type="button"
              >
                {"고정비"}
              </button>
              <button
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs"
                onClick={() => applySavedFilterPreset("meal_expense")}
                type="button"
              >
                {"식비"}
              </button>
            </div>
          </div>

          <div className={`mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${activeView === "transactions" ? "" : "hidden"}`}>
            <input
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="메모, 계정, 카테고리 검색"
              value={searchInput}
            />
            <select
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
              onChange={(event) => setPeriodPreset(event.target.value as PeriodPreset)}
              value={periodPreset}
            >
              {PERIOD_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
              onChange={(event) =>
                setTypeFilter(event.target.value as "all" | TransactionType)
              }
              value={typeFilter}
            >
              <option value="all">{"전체 유형"}</option>
              {TRANSACTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
              onChange={(event) => setAccountFilter(event.target.value)}
              value={accountFilter}
            >
              <option value="">{"전체 계정"}</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
              onChange={(event) => setCategoryFilter(event.target.value)}
              value={categoryFilter}
            >
              <option value="">{"전체 카테고리"}</option>
              {(ledger?.categories ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3 xl:col-span-3">
              <input
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
                onChange={(event) => {
                  setPeriodPreset("custom");
                  setStartDate(event.target.value);
                }}
                type="date"
                value={startDate}
              />
              <input
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
                onChange={(event) => {
                  setPeriodPreset("custom");
                  setEndDate(event.target.value);
                }}
                type="date"
                value={endDate}
              />
            </div>
            <select
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
              onChange={(event) => setTransactionSort(event.target.value as TransactionSort)}
              value={transactionSort}
            >
              <option value="occurredAt">{"정렬: 날짜"}</option>
              <option value="amount">{"정렬: 금액"}</option>
              <option value="type">{"정렬: 유형"}</option>
            </select>
            <select
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
              onChange={(event) => setSortDirection(event.target.value as SortDirection)}
              value={sortDirection}
            >
              <option value="desc">{"내림차순"}</option>
              <option value="asc">{"오름차순"}</option>
            </select>
            <select
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
              onChange={(event) =>
                setTransactionDisplayMode(event.target.value as TransactionDisplayMode)
              }
              value={transactionDisplayMode}
            >
              <option value="card">{"표시: 카드"}</option>
              <option value="table">{"표시: 테이블"}</option>
            </select>
            <select
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,108,102,0.15)]"
              onChange={(event) => {
                setTransactionPageSize(Number(event.target.value));
                setTransactionPage(1);
              }}
              value={transactionPageSize}
            >
              <option value={20}>{"페이지: 20건"}</option>
              <option value={50}>{"페이지: 50건"}</option>
              <option value={100}>{"페이지: 100건"}</option>
            </select>
          </div>

          <div className={`mt-4 grid gap-3 md:grid-cols-4 ${activeView === "transactions" ? "" : "hidden"}`}>
            <MiniStat label="거래 건수" value={`${filteredTransactions.length}건`} />
            <MiniStat label="수입" value={formatCurrency(filteredSummary.income)} />
            <MiniStat label="지출" value={formatCurrency(filteredSummary.expense)} />
            <MiniStat label="잔액" value={formatCurrency(filteredSummary.balance)} />
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {activeView === "calendar" ? (
            <div className="mt-4">
              <div className="mb-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-stone-700">
                {"달력 화면은 월 흐름 확인에 집중하고, 상세 검색/대량 작업은 거래 검토 탭에서 진행하세요."}
              </div>
              <MonthlyCalendarPanel
                categories={ledger?.categories ?? []}
                loading={loading}
                onDelete={(id) => void deleteTransactionById(id)}
                onEdit={prefillTransactionForm}
                onQuickAdd={openQuickAddForDate}
                transactions={sortedTransactions}
              />
            </div>
          ) : null}

          {activeView === "transactions" && loading ? (
            <p className="mt-4 text-sm text-stone-500">
              {"데이터를 불러오는 중입니다."}
            </p>
          ) : null}

          {activeView === "transactions" && !loading && !sortedTransactions.length ? (
            <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
              {
                "조건에 맞는 거래가 없습니다. 필터 조건을 조정하거나 오른쪽 폼에서 거래를 입력해보세요."
              }
            </p>
          ) : null}

          <div className={`${activeView === "transactions" ? "" : "hidden"}`}>
            {transactionDisplayMode === "card" ? (
              <div className="mt-4 flex flex-col gap-3">
                {pagedTransactions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] shadow-[var(--shadow-soft)] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          {item.description ||
                            item.categoryName ||
                            "설명 없음"}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {formatDateLabel(item.occurredAt)}
                          {" · "}
                          {item.accountName ?? "계정 없음"}
                          {item.type !== "transfer" && item.categoryName
                            ? ` · ${item.categoryName}`
                            : ""}
                          {item.type === "transfer" && item.transferAccountName
                            ? ` · ${item.transferAccountName}`
                            : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-stone-400">
                          {
                            TRANSACTION_TYPE_OPTIONS.find(
                              (option) => option.value === item.type
                            )?.label
                          }
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {formatCurrency(item.amount)}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs"
                            onClick={() => prefillTransactionForm(item.id)}
                            type="button"
                          >
                            {"수정"}
                          </button>
                          <button
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={deleteTransactionMutation.isPending}
                            onClick={() => void deleteTransactionById(item.id)}
                            type="button"
                          >
                            {"삭제"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] shadow-[var(--shadow-soft)] px-3 py-2 text-xs text-stone-600">
                  <span className="font-medium">{"컬럼 표시"}</span>
                  <button
                    className={`rounded-full px-3 py-1 ${
                      hasAccountCategoryColumn
                        ? "bg-[color:var(--point-soft)] text-[color:var(--point-strong)]"
                        : "border border-[var(--border)] bg-white"
                    }`}
                    onClick={() => toggleTableColumn("account_category")}
                    type="button"
                  >
                    {"계정/카테고리"}
                  </button>
                  <button
                    className={`rounded-full px-3 py-1 ${
                      hasMemoColumn
                        ? "bg-[color:var(--point-soft)] text-[color:var(--point-strong)]"
                        : "border border-[var(--border)] bg-white"
                    }`}
                    onClick={() => toggleTableColumn("memo")}
                    type="button"
                  >
                    {"메모"}
                  </button>
                  <span className="ml-auto text-stone-500">{`선택 ${selectedTransactionIds.length}건`}</span>
                  <select
                    className="rounded-full border border-[var(--border)] px-3 py-1"
                    onChange={(event) => setSelectedBulkCategoryId(event.target.value)}
                    value={selectedBulkCategoryId}
                  >
                    <option value="">{"카테고리 일괄 변경"}</option>
                    {bulkAssignableCategories.map((item) => (
                      <option key={`bulk-category-${item.id}`} value={item.id}>
                        {`${item.kind === "income" ? "수입" : "지출"} · ${item.name}`}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-full border border-[var(--border)] px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!selectedTransactions.length || !selectedBulkCategoryId}
                    onClick={() => void bulkUpdateSelectedTransactionCategory()}
                    type="button"
                  >
                    {"일괄 카테고리 변경"}
                  </button>
                  <button
                    className="rounded-full border border-[var(--border)] px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!selectedTransactions.length}
                    onClick={() => exportTransactionsAsCsv(selectedTransactions)}
                    type="button"
                  >
                    {"선택 CSV"}
                  </button>
                  <button
                    className="rounded-full border border-[var(--border)] px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!selectedTransactions.length}
                    onClick={() => exportTransactionsAsXlsx(selectedTransactions)}
                    type="button"
                  >
                    {"선택 XLSX"}
                  </button>
                  <button
                    className="rounded-full border border-rose-300 px-3 py-1 text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!selectedTransactions.length}
                    onClick={() => void bulkDeleteSelectedTransactions()}
                    type="button"
                  >
                    {"선택 삭제"}
                  </button>
                </div>
              <div className="max-h-[560px] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] shadow-[var(--shadow-soft)]">
                <table className="min-w-[860px] w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-stone-50 text-stone-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        <input
                          aria-label="현재 페이지 전체 선택"
                          checked={allPagedSelected}
                          className="h-4 w-4 accent-[color:var(--point)]"
                          onChange={() => toggleSelectAllPaged()}
                          type="checkbox"
                        />
                      </th>
                      <th className="px-4 py-3 font-medium">
                        <button
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleTransactionSort("occurredAt")}
                          type="button"
                        >
                          {"일시"}
                          {transactionSort === "occurredAt"
                            ? sortDirection === "desc"
                              ? "▼"
                              : "▲"
                            : ""}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-medium">
                        <button
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleTransactionSort("type")}
                          type="button"
                        >
                          {"유형"}
                          {transactionSort === "type"
                            ? sortDirection === "desc"
                              ? "▼"
                              : "▲"
                            : ""}
                        </button>
                      </th>
                      {hasAccountCategoryColumn ? (
                        <th className="px-4 py-3 font-medium">{"계정/카테고리"}</th>
                      ) : null}
                      {hasMemoColumn ? (
                        <th className="px-4 py-3 font-medium">{"메모"}</th>
                      ) : null}
                      <th className="px-4 py-3 font-medium text-right">
                        <button
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleTransactionSort("amount")}
                          type="button"
                        >
                          {"금액"}
                          {transactionSort === "amount"
                            ? sortDirection === "desc"
                              ? "▼"
                              : "▲"
                            : ""}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-medium text-right">{"작업"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTransactions.map((item) => (
                      <tr key={`table-${item.id}`} className="border-t border-stone-100">
                        <td className="px-4 py-3">
                          <input
                            aria-label={`${item.description || "거래"} 선택`}
                            checked={selectedTransactionIds.includes(item.id)}
                            className="h-4 w-4 accent-[color:var(--point)]"
                            onChange={() => toggleTransactionSelection(item.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-4 py-3 text-stone-600">{formatDateLabel(item.occurredAt)}</td>
                        <td className="px-4 py-3">
                          {TRANSACTION_TYPE_OPTIONS.find((option) => option.value === item.type)?.label}
                        </td>
                        {hasAccountCategoryColumn ? (
                          <td className="px-4 py-3 text-stone-600">
                            {item.accountName ?? "계정 없음"}
                            {item.type !== "transfer" && item.categoryName
                              ? ` · ${item.categoryName}`
                              : ""}
                            {item.type === "transfer" && item.transferAccountName
                              ? ` · ${item.transferAccountName}`
                              : ""}
                          </td>
                        ) : null}
                        {hasMemoColumn ? (
                          <td className="px-4 py-3">{item.description || "설명 없음"}</td>
                        ) : null}
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.amount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs"
                              onClick={() => prefillTransactionForm(item.id)}
                              type="button"
                            >
                              {"수정"}
                            </button>
                            <button
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={deleteTransactionMutation.isPending}
                              onClick={() => void deleteTransactionById(item.id)}
                              type="button"
                            >
                              {"삭제"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            )}
          </div>
          {activeView === "transactions" && sortedTransactions.length > 0 ? (
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] shadow-[var(--shadow-soft)] px-4 py-3 text-sm">
              <p className="text-stone-600">
                {`${(transactionPage - 1) * transactionPageSize + 1}-${Math.min(
                  transactionPage * transactionPageSize,
                  sortedTransactions.length
                )} / ${sortedTransactions.length}건`}
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-[var(--border)] px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={transactionPage <= 1}
                  onClick={() => setTransactionPage((prev) => Math.max(prev - 1, 1))}
                  type="button"
                >
                  {"이전"}
                </button>
                <button
                  className="rounded-full border border-[var(--border)] px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={transactionPage >= totalTransactionPages}
                  onClick={() =>
                    setTransactionPage((prev) => Math.min(prev + 1, totalTransactionPages))
                  }
                  type="button"
                >
                  {"다음"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className={`flex flex-col gap-6 ${activeView === "manage" ? "" : "hidden"}`} id="web-manage">
        {loading ? (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
            {"관리 데이터를 불러오는 중입니다."}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 lg:sticky lg:top-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
              {"관리 메뉴"}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {manageSections.map((item) => (
                <button
                  key={`manage-aside-${item.key}`}
                  className={`rounded-xl px-3 py-2 text-left text-sm transition ${
                    manageSection === item.key
                      ? "bg-[color:var(--point)] text-white shadow-[0_8px_18px_rgba(21,93,73,0.2)]"
                      : "border border-[var(--border)] bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                  onClick={() => setManageSection(item.key)}
                  type="button"
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className={`mt-0.5 text-xs ${manageSection === item.key ? "text-white/80" : "text-stone-500"}`}>
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-stone-700">
              <span className="font-semibold">{manageSectionMeta.label}</span>
              {` · ${manageSectionMeta.description}`}
            </div>

        <div className={manageSection === "transaction" ? "" : "hidden"}>
        <FormSection title="빠른 거래 입력">
          <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {"최근 사용 거래 템플릿"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {"자주 입력하는 거래를 원탭으로 불러와서 빠르게 등록할 수 있습니다."}
            </p>
            {!quickTransactionTemplates.length ? (
              <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted-foreground)]">
                {"아직 템플릿으로 만들 최근 거래가 없습니다. 거래를 2~3건만 입력하면 자동 추천됩니다."}
              </p>
            ) : (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {quickTransactionTemplates.map((template) => (
                  <button
                    key={`quick-template-${template.key}`}
                    className="rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
                    onClick={() => {
                      transactionForm.reset({
                        ...transactionDefaults,
                        type: template.type,
                        amountInput: String(template.amount),
                        accountId: template.accountId,
                        categoryId: template.categoryId ?? "",
                        transferAccountId: template.transferAccountId ?? "",
                        description: template.description,
                        occurredAt: getTodayInputValue()
                      });
                      showToast("success", "거래 템플릿을 불러왔습니다.");
                    }}
                    type="button"
                  >
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {template.description || (template.type === "transfer" ? "이체 템플릿" : "빠른 입력 템플릿")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {`${template.type === "income" ? "수입" : template.type === "expense" ? "지출" : "이체"} · ${template.accountName}${
                        template.type === "transfer" && template.transferAccountName ? ` → ${template.transferAccountName}` : ""
                      }${template.categoryName ? ` · ${template.categoryName}` : ""}`}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--point-strong)]">
                      {formatCurrency(template.amount)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {"추천 스타터 팩 (상위 가계부 앱 공통 구조)"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {`기본 계정 ${missingStarterAccounts.length}개, 카테고리 ${missingStarterCategories.length}개를 한 번에 추가할 수 있습니다.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {missingStarterAccounts.slice(0, 3).map((item) => (
                <span key={`starter-account-${item.name}`} className="rounded-full border border-[var(--border)] bg-white px-3 py-1">
                  {`계정 · ${item.name}`}
                </span>
              ))}
              {missingStarterCategories.slice(0, 5).map((item) => (
                <span key={`starter-category-${item.kind}-${item.name}`} className="rounded-full border border-[var(--border)] bg-white px-3 py-1">
                  {`${item.kind === "income" ? "수입" : "지출"} · ${item.name}`}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-full bg-[var(--point)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,108,102,0.24)] transition hover:bg-[var(--point-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  applyStarterPackMutation.isPending ||
                  (missingStarterAccounts.length === 0 && missingStarterCategories.length === 0)
                }
                onClick={() => void applyStarterPackMutation.mutateAsync()}
                type="button"
              >
                {applyStarterPackMutation.isPending ? "적용 중..." : "스타터 팩 자동 추가"}
              </button>
              <button
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={applyStarterPackMutation.isPending}
                onClick={() => {
                  setManageSection("account");
                }}
                type="button"
              >
                {"계정 직접 관리"}
              </button>
              <button
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={applyStarterPackMutation.isPending}
                onClick={() => {
                  setManageSection("category");
                }}
                type="button"
              >
                {"카테고리 직접 관리"}
              </button>
            </div>
          </div>
          <TransactionFormPanel
            accounts={accounts}
            categories={categories}
            form={transactionForm}
            disabled={saveTransactionMutation.isPending}
            onSubmit={async (values) => {
              try {
                setActionError("");
                await saveTransactionMutation.mutateAsync(values);
                transactionForm.reset({
                  ...transactionDefaults,
                  accountId:
                    transactionForm.getValues("accountId") ||
                    ledger?.accounts[0]?.id ||
                    ""
                });
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "거래 저장 중 오류가 발생했습니다."
                );
              }
            }}
            transactionType={transactionType}
          />
        </FormSection>
        </div>

        <div className={manageSection === "account" ? "" : "hidden"}>
        <FormSection title="계정 관리">
          <AccountFormPanel
            form={accountForm}
            disabled={saveAccountMutation.isPending}
            onSubmit={async (values) => {
              try {
                setActionError("");
                await saveAccountMutation.mutateAsync(values);
                accountForm.reset(accountDefaults);
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "계정 저장 중 오류가 발생했습니다."
                );
              }
            }}
          />
          <SimpleList
            deleteLabel="보관"
            deletingId={
              archiveAccountMutation.isPending
                ? (archiveAccountMutation.variables ?? null)
                : null
            }
            emptyLabel="아직 계정이 없습니다."
            items={
              ledger?.accounts.map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `${
                  ACCOUNT_TYPE_OPTIONS.find((option) => option.value === item.type)
                    ?.label ?? item.type
                } · ${formatCurrency(item.balance)}`
              })) ?? []
            }
            onEdit={(id) => {
              const target = ledger?.accounts.find((item) => item.id === id);

              if (!target) {
                return;
              }

              accountForm.reset({
                id: target.id,
                name: target.name,
                type: target.type,
                balanceInput: String(target.balance)
              });
            }}
            onDelete={async (id) => {
              try {
                setActionError("");
                await archiveAccountMutation.mutateAsync(id);
                const editingId = accountForm.getValues("id");
                if (editingId === id) {
                  accountForm.reset(accountDefaults);
                }
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "계정 보관 중 오류가 발생했습니다."
                );
              }
            }}
          />
        </FormSection>
        </div>

        <div className={manageSection === "category" ? "" : "hidden"}>
        <FormSection title="카테고리 관리">
          <CategoryFormPanel
            form={categoryForm}
            disabled={saveCategoryMutation.isPending}
            onSubmit={async (values) => {
              try {
                setActionError("");
                await saveCategoryMutation.mutateAsync(values);
                categoryForm.reset(categoryDefaults);
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "카테고리 저장 중 오류가 발생했습니다."
                );
              }
            }}
          />
          <SimpleList
            deleteLabel="보관"
            deletingId={
              archiveCategoryMutation.isPending
                ? (archiveCategoryMutation.variables ?? null)
                : null
            }
            emptyLabel="아직 카테고리가 없습니다."
            items={
              ledger?.categories.map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `${
                  CATEGORY_KIND_OPTIONS.find((option) => option.value === item.kind)
                    ?.label ?? item.kind
                } · ${item.color}`
              })) ?? []
            }
            onEdit={(id) => {
              const target = ledger?.categories.find((item) => item.id === id);

              if (!target) {
                return;
              }

              categoryForm.reset({
                id: target.id,
                name: target.name,
                kind: target.kind,
                color: target.color,
                icon: target.icon ?? ""
              });
            }}
            onDelete={async (id) => {
              try {
                setActionError("");
                await archiveCategoryMutation.mutateAsync(id);
                const editingId = categoryForm.getValues("id");
                if (editingId === id) {
                  categoryForm.reset(categoryDefaults);
                }
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "카테고리 보관 중 오류가 발생했습니다."
                );
              }
            }}
          />
        </FormSection>
        </div>

        <div className={manageSection === "budget" ? "" : "hidden"}>
        <FormSection title="예산 관리">
          <BudgetFormPanel
            categories={ledger?.categories ?? []}
            form={budgetForm}
            disabled={saveBudgetMutation.isPending}
            onSubmit={async (values) => {
              try {
                setActionError("");
                await saveBudgetMutation.mutateAsync(values);
                budgetForm.reset(budgetDefaults);
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "예산 저장 중 오류가 발생했습니다."
                );
              }
            }}
          />
          <SimpleList
            deletingId={
              deleteBudgetMutation.isPending
                ? (deleteBudgetMutation.variables ?? null)
                : null
            }
            emptyLabel="아직 예산이 없습니다."
            items={
              ledger?.budgets.map((item) => ({
                id: item.id,
                title: `${item.month} · ${
                  ledger?.categories.find(
                    (category) => category.id === item.categoryId
                  )?.name ?? "카테고리"
                }`,
                subtitle: formatCurrency(item.amount)
              })) ?? []
            }
            onEdit={(id) => {
              const target = ledger?.budgets.find((item) => item.id === id);

              if (!target) {
                return;
              }

              budgetForm.reset({
                id: target.id,
                categoryId: target.categoryId,
                amountInput: String(target.amount),
                month: target.month
              });
            }}
            onDelete={async (id) => {
              try {
                setActionError("");
                await deleteBudgetMutation.mutateAsync(id);
                const editingId = budgetForm.getValues("id");
                if (editingId === id) {
                  budgetForm.reset(budgetDefaults);
                }
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "예산 삭제 중 오류가 발생했습니다."
                );
              }
            }}
          />
        </FormSection>
        </div>

        <div className={manageSection === "recurring" ? "" : "hidden"}>
        <FormSection title="반복지출 관리">
          <RecurringFormPanel
            accounts={ledger?.accounts ?? []}
            categories={ledger?.categories ?? []}
            form={recurringForm}
            disabled={saveRecurringMutation.isPending}
            onSubmit={async (values) => {
              try {
                setActionError("");
                await saveRecurringMutation.mutateAsync(values);
                recurringForm.reset(recurringDefaults);
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "반복지출 저장 중 오류가 발생했습니다."
                );
              }
            }}
          />
          <SimpleList
            deletingId={
              deleteRecurringMutation.isPending
                ? (deleteRecurringMutation.variables ?? null)
                : null
            }
            emptyLabel="아직 반복지출이 없습니다."
            items={
              ledger?.recurringTransactions.map((item) => ({
                id: item.id,
                title: item.description || "반복 지출",
                subtitle: `${item.nextRunAt.slice(0, 10)} · ${
                  RECURRING_FREQUENCY_OPTIONS.find(
                    (option) => option.value === item.frequency
                  )?.label ?? item.frequency
                }`
              })) ?? []
            }
            onEdit={(id) => {
              const target = ledger?.recurringTransactions.find(
                (item) => item.id === id
              );

              if (!target) {
                return;
              }

              recurringForm.reset({
                id: target.id,
                type: target.type,
                amountInput: String(target.amount),
                accountId: target.accountId,
                categoryId: target.categoryId ?? "",
                transferAccountId: target.transferAccountId ?? "",
                description: target.description ?? "",
                frequency: target.frequency,
                nextRunAt: target.nextRunAt.slice(0, 10),
                isActive: target.isActive
              });
            }}
            onDelete={async (id) => {
              try {
                setActionError("");
                await deleteRecurringMutation.mutateAsync(id);
                const editingId = recurringForm.getValues("id");
                if (editingId === id) {
                  recurringForm.reset(recurringDefaults);
                }
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "반복거래 삭제 중 오류가 발생했습니다."
                );
              }
            }}
          />
        </FormSection>
        </div>

        <div className={manageSection === "logs" ? "" : "hidden"}>
        <RecurringExecutionPanel
          error={recurringExecutionError}
          items={ledger?.recurringExecutionLogs ?? []}
          loading={recurringExecutionLoading}
        />
        </div>
          </div>
        </div>
      </div>
      </section>

      <section className={`grid gap-6 lg:grid-cols-[0.9fr_1.1fr] ${activeView === "settings" ? "" : "hidden"}`} id="web-settings">
        <FormSection title="사용자 기본 설정">
          <SettingsFormPanel
            form={profileForm}
            disabled={saveProfileMutation.isPending}
            onSubmit={async (values) => {
              try {
                setActionError("");
                await saveProfileMutation.mutateAsync(values);
              } catch (nextError) {
                setActionError(
                  nextError instanceof Error
                    ? nextError.message
                    : "설정 저장 중 오류가 발생했습니다."
                );
              }
            }}
          />
          {settingsMessage ? (
            <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {settingsMessage}
            </p>
          ) : null}
        </FormSection>

        <FormSection title="설정 적용 메모">
          <div className="grid gap-3 text-sm text-stone-700">
            <MiniStat
              label="표시 이름"
              value={profile?.displayName || "미설정"}
            />
            <MiniStat
              label="주 시작"
              value={profile?.weekStartsOn === 0 ? "일요일" : "월요일"}
            />
            <MiniStat
              label="월 시작일"
              value={`${profile?.monthStartDay ?? 1}일`}
            />
            <MiniStat
              label="기본 통화"
              value={profile?.defaultCurrency ?? "KRW"}
            />
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm text-stone-700">
            {
              "현재 필터 결과를 CSV와 XLSX 형식으로 바로 내보낼 수 있으며, 향후 보고서 형식으로도 확장 가능한 구조입니다."
            }
          </div>
        </FormSection>
      </section>

      {toastNotice ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50">
          <div
            className={`rounded-2xl px-4 py-3 text-sm font-medium shadow-[0_18px_40px_rgba(28,24,20,0.18)] ${
              toastNotice.kind === "success"
                ? "bg-emerald-600 text-white"
                : "bg-rose-600 text-white"
            }`}
          >
            {toastNotice.text}
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
}





