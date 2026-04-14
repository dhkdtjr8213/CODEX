import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, SafeAreaView, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Session } from "@supabase/supabase-js";
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
  type LedgerTransactionItem,
  type MonthlySummary,
  type ProfileSettingsFormValues,
  type RecurringTransactionFormValues,
  type TransactionFormValues
} from "@household/types";
import { APP_NAME } from "@household/config";
import {
  buildMissingSupabaseEnvMessage,
  deleteTransaction,
  fetchLedgerSnapshot,
  fetchProfile,
  saveAccount,
  saveBudget,
  saveCategory,
  saveProfileSettings,
  saveRecurringTransaction,
  saveTransaction,
  signInWithGoogle,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  toAuthSessionSnapshot
} from "@household/supabase";
import { getTodayInputValue } from "@household/ui";
import { getMobileSupabaseClient } from "../lib/supabase";
import { styles } from "./styles";
import { AuthCard } from "./auth-card";
import { EntryScreen, HomeScreen, ListScreen, ManageScreen, ScreenTabs } from "./screens";

type ScreenKey = "home" | "entry" | "list" | "manage";

const emptySummary: MonthlySummary = { month: "", income: 0, expense: 0, transfer: 0, balance: 0 };
const accountDefaults: AccountFormValues = { name: "", type: "bank", balanceInput: "" };
const budgetDefaults: BudgetFormValues = { categoryId: "", amountInput: "", month: getTodayInputValue().slice(0, 7) };
const categoryDefaults: CategoryFormValues = { name: "", kind: "expense", color: "#1c7c54", icon: "" };
const profileDefaults: ProfileSettingsFormValues = { displayName: "", defaultCurrency: "KRW", weekStartsOn: 1, monthStartDay: 1 };
const recurringDefaults: RecurringTransactionFormValues = { type: "expense", amountInput: "", accountId: "", categoryId: "", transferAccountId: "", description: "", frequency: "monthly", nextRunAt: getTodayInputValue(), isActive: true };
const transactionDefaults: TransactionFormValues = { type: "expense", amountInput: "", occurredAt: getTodayInputValue(), accountId: "", categoryId: "", transferAccountId: "", description: "" };
const MOBILE_GOOGLE_REDIRECT = "household-ledger://auth/callback";
const ledgerQueryKey = (userId: string | null) => ["ledger", userId] as const;

export function MobileLedgerApp() {
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("\uC774\uBA54\uC77C \uB85C\uADF8\uC778 \uAE30\uBC18 \uC778\uC99D \uAD6C\uC870\uAC00 \uC900\uBE44\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<AuthSessionSnapshot>({ source: "mobile", hasEnv: false, isAuthenticated: false, userId: null, email: null });

  const queryClient = useQueryClient();
  const accountForm = useForm<AccountFormValues>({ resolver: zodResolver(accountFormSchema), defaultValues: accountDefaults });
  const budgetForm = useForm<BudgetFormValues>({ resolver: zodResolver(budgetFormSchema), defaultValues: budgetDefaults });
  const categoryForm = useForm<CategoryFormValues>({ resolver: zodResolver(categoryFormSchema), defaultValues: categoryDefaults });
  const profileForm = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsFormSchema),
    defaultValues: profileDefaults
  });
  const recurringForm = useForm<RecurringTransactionFormValues>({ resolver: zodResolver(recurringTransactionFormSchema), defaultValues: recurringDefaults });
  const transactionForm = useForm<TransactionFormValues>({ resolver: zodResolver(transactionFormSchema), defaultValues: transactionDefaults });
  const transactionType = transactionForm.watch("type");
  const ledgerQuery = useQuery({
    queryKey: ledgerQueryKey(snapshot.userId),
    enabled: snapshot.isAuthenticated && Boolean(snapshot.userId),
    queryFn: async () => {
      const client = getMobileSupabaseClient();
      if (!client) {
        throw new Error(buildMissingSupabaseEnvMessage("mobile"));
      }

      const [nextLedger, nextProfile] = await Promise.all([
        fetchLedgerSnapshot(client),
        fetchProfile(client)
      ]);

      return {
        ledger: nextLedger,
        profile: nextProfile
      };
    }
  });
  const ledger = ledgerQuery.data?.ledger ?? null;
  const profile = ledgerQuery.data?.profile ?? null;
  const availableCategories = (ledger?.categories ?? []).filter((item) => transactionType !== "transfer" && item.kind === transactionType);
  const loading = ledgerQuery.isPending || ledgerQuery.isFetching;
  const ledgerError = ledgerQuery.error instanceof Error ? ledgerQuery.error.message : "";
  const displayError = error || ledgerError;

  const refreshLedger = useCallback(async () => {
    if (!snapshot.userId) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ledgerQueryKey(snapshot.userId), exact: true });
  }, [queryClient, snapshot.userId]);

  const handleOAuthCallback = useCallback(
    async (url: string) => {
      const client = getMobileSupabaseClient();
      if (!client) {
        return;
      }

      if (!url.startsWith("household-ledger://")) {
        return;
      }

      if (!url.includes("code=") && !url.includes("error=")) {
        return;
      }

      const { error: exchangeError } = await client.auth.exchangeCodeForSession(url);

      if (exchangeError) {
        setMessage(exchangeError.message);
        return;
      }

      setMessage("\uAD6C\uAE00 \uB85C\uADF8\uC778\uC5D0 \uC131\uACF5\uD588\uC2B5\uB2C8\uB2E4.");
    },
    []
  );

  useEffect(() => {
    const client = getMobileSupabaseClient();
    if (!client) return void setMessage(buildMissingSupabaseEnvMessage("mobile"));

    const syncSession = async () => {
      const [{ data: sessionData }, { data: userData }] = await Promise.all([client.auth.getSession(), client.auth.getUser()]);
      const nextSnapshot = toAuthSessionSnapshot("mobile", true, sessionData.session, userData.user);
      setSnapshot(nextSnapshot);
      setError("");
    };

    syncSession().catch((nextError: unknown) => {
      setError(nextError instanceof Error ? nextError.message : "\uC138\uC158 \uD655\uC778 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    });

    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, session: Session | null) => {
      const nextSnapshot = toAuthSessionSnapshot("mobile", true, session, session?.user ?? null);
      setSnapshot(nextSnapshot);
      setError("");
    });

    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      void handleOAuthCallback(url);
    });

    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) {
          void handleOAuthCallback(initialUrl);
        }
      })
      .catch(() => {
        // Ignore initial URL read failure for non-OAuth launches.
      });

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, [handleOAuthCallback]);

  useEffect(() => {
    const firstAccountId = ledger?.accounts[0]?.id ?? "";
    const currentAccountId = transactionForm.getValues("accountId");

    if (!currentAccountId && firstAccountId) {
      transactionForm.setValue("accountId", firstAccountId);
    }
  }, [ledger, transactionForm]);

  useEffect(() => {
    profileForm.reset({
      displayName: profile?.displayName ?? "",
      defaultCurrency: profile?.defaultCurrency ?? "KRW",
      weekStartsOn: profile?.weekStartsOn ?? 1,
      monthStartDay: profile?.monthStartDay ?? 1
    });
  }, [profile, profileForm]);

  function startAccountEdit(id: string) {
    const target = ledger?.accounts.find((item) => item.id === id);
    if (!target) return;
    accountForm.reset({ id: target.id, name: target.name, type: target.type, balanceInput: String(target.balance) });
    setScreen("manage");
  }

  function startCategoryEdit(id: string) {
    const target = ledger?.categories.find((item) => item.id === id);
    if (!target) return;
    categoryForm.reset({ id: target.id, name: target.name, kind: target.kind, color: target.color, icon: target.icon ?? "" });
    setScreen("manage");
  }

  function startBudgetEdit(id: string) {
    const target = ledger?.budgets.find((item) => item.id === id);
    if (!target) return;
    budgetForm.reset({ id: target.id, categoryId: target.categoryId, amountInput: String(target.amount), month: target.month });
    setScreen("manage");
  }

  function startRecurringEdit(id: string) {
    const target = ledger?.recurringTransactions.find((item) => item.id === id);
    if (!target) return;
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
    setScreen("manage");
  }

  function startTransactionEdit(item: LedgerTransactionItem) {
    transactionForm.reset({ id: item.id, type: item.type, amountInput: String(item.amount), occurredAt: item.occurredAt.slice(0, 10), accountId: item.accountId, categoryId: item.categoryId ?? "", transferAccountId: item.transferAccountId ?? "", description: item.description ?? "" });
    setScreen("entry");
  }

  const summary = ledger?.summary ?? emptySummary;
  const recentTransactions = ledger?.transactions.slice(0, 5) ?? [];
  const recentRecurringExecutionLogs = ledger?.recurringExecutionLogs ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{"\uBE60\uB978 \uAE30\uB85D \uC911\uC2EC MVP"}</Text>
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.subtitle}>{"\uD55C \uC190\uC73C\uB85C \uBE60\uB974\uAC8C \uC785\uB825\uD558\uACE0, \uC6F9\uACFC \uAC19\uC740 \uB370\uC774\uD130\uB97C \uBC14\uB85C \uD655\uC778\uD560 \uC218 \uC788\uAC8C \uAD6C\uC131\uD588\uC2B5\uB2C8\uB2E4."}</Text>
        </View>

        <AuthCard email={email} password={password} displayName={displayName} message={message} snapshot={snapshot} onChangeEmail={setEmail} onChangePassword={setPassword} onChangeDisplayName={setDisplayName} onLogin={async () => {
          const client = getMobileSupabaseClient();
          if (!client) return setMessage(buildMissingSupabaseEnvMessage("mobile"));
          const { error: nextError } = await signInWithEmail(client, email, password);
          setMessage(nextError ? nextError.message : "\uB85C\uADF8\uC778\uC5D0 \uC131\uACF5\uD588\uC2B5\uB2C8\uB2E4.");
        }} onGoogleLogin={async () => {
          const client = getMobileSupabaseClient();
          if (!client) return setMessage(buildMissingSupabaseEnvMessage("mobile"));
          const { data, error: nextError } = await signInWithGoogle(client, MOBILE_GOOGLE_REDIRECT, true);
          if (nextError) {
            setMessage(nextError.message);
            return;
          }
          if (data?.url) {
            await Linking.openURL(data.url);
            setMessage("\uAD6C\uAE00 \uB85C\uADF8\uC778 \uCC3D\uC73C\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4.");
            return;
          }
          setMessage("\uAD6C\uAE00 \uB85C\uADF8\uC778 URL\uC744 \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
        }} onLogout={async () => {
          const client = getMobileSupabaseClient();
          if (!client) return setMessage(buildMissingSupabaseEnvMessage("mobile"));
          const { error: nextError } = await signOut(client);
          setMessage(nextError ? nextError.message : "\uB85C\uADF8\uC544\uC6C3\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        }} onSignUp={async () => {
          const client = getMobileSupabaseClient();
          if (!client) return setMessage(buildMissingSupabaseEnvMessage("mobile"));
          const { error: nextError } = await signUpWithEmail(client, email, password, displayName);
          setMessage(nextError ? nextError.message : "\uD68C\uC6D0\uAC00\uC785 \uC694\uCCAD\uC744 \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4.");
        }} />

        {snapshot.isAuthenticated ? <ScreenTabs screen={screen} onChange={setScreen} /> : null}
        {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}
        {loading ? <ActivityIndicator color="#1c7c54" size="small" /> : null}

        {snapshot.isAuthenticated && screen === "home" ? <HomeScreen summary={summary} transactions={recentTransactions} budgetProgress={ledger?.monthlyStats.budgetProgress ?? []} recurringTransactions={ledger?.recurringTransactions ?? []} recurringExecutionLogs={recentRecurringExecutionLogs} onGoEntry={() => setScreen("entry")} onGoList={() => setScreen("list")} onEditTransaction={startTransactionEdit} /> : null}
        {snapshot.isAuthenticated && screen === "entry" ? <EntryScreen accounts={ledger?.accounts ?? []} categories={availableCategories} form={transactionForm} transactionType={transactionType} onSubmit={async (values) => {
          const client = getMobileSupabaseClient();
          if (!client || !snapshot.userId) return;
          await saveTransaction(client, snapshot.userId, values);
          transactionForm.reset({ ...transactionDefaults, accountId: transactionForm.getValues("accountId") || ledger?.accounts[0]?.id || "" });
          setScreen("home");
          await refreshLedger();
        }} /> : null}
        {snapshot.isAuthenticated && screen === "list" ? <ListScreen transactions={ledger?.transactions ?? []} onEdit={startTransactionEdit} onDelete={async (id) => {
          const client = getMobileSupabaseClient();
          if (!client) return;
          await deleteTransaction(client, id);
          await refreshLedger();
        }} /> : null}
        {snapshot.isAuthenticated && screen === "manage" ? <ManageScreen accountForm={accountForm} categoryForm={categoryForm} profileForm={profileForm} profile={profile} accounts={ledger?.accounts ?? []} categories={ledger?.categories ?? []} onSaveAccount={async (values) => {
          const client = getMobileSupabaseClient();
          if (!client || !snapshot.userId) return;
          await saveAccount(client, snapshot.userId, values);
          accountForm.reset(accountDefaults);
          await refreshLedger();
        }} budgetForm={budgetForm} budgets={ledger?.budgets ?? []} onSaveBudget={async (values) => {
          const client = getMobileSupabaseClient();
          if (!client || !snapshot.userId) return;
          await saveBudget(client, snapshot.userId, values);
          budgetForm.reset(budgetDefaults);
          await refreshLedger();
        }} recurringForm={recurringForm} recurringTransactions={ledger?.recurringTransactions ?? []} onSaveRecurring={async (values) => {
          const client = getMobileSupabaseClient();
          if (!client || !snapshot.userId) return;
          await saveRecurringTransaction(client, snapshot.userId, values);
          recurringForm.reset(recurringDefaults);
          await refreshLedger();
        }} onSaveProfile={async (values) => {
          const client = getMobileSupabaseClient();
          if (!client || !snapshot.userId) return;
          await saveProfileSettings(client, snapshot.userId, values);
          await refreshLedger();
        }} onSaveCategory={async (values) => {
          const client = getMobileSupabaseClient();
          if (!client || !snapshot.userId) return;
          await saveCategory(client, snapshot.userId, values);
          categoryForm.reset(categoryDefaults);
          await refreshLedger();
        }} onEditAccount={startAccountEdit} onEditBudget={startBudgetEdit} onEditCategory={startCategoryEdit} onEditRecurring={startRecurringEdit} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}


