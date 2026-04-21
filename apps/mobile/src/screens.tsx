import * as React from "react";
import { Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import {
  ACCOUNT_TYPE_OPTIONS,
  CATEGORY_KIND_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
  TRANSACTION_TYPE_OPTIONS
} from "@household/config";
import type {
  AccountFormValues,
  BudgetFormValues,
  CategoryFormValues,
  LedgerSnapshot,
  LedgerTransactionItem,
  MonthlySummary,
  Profile,
  ProfileSettingsFormValues,
  RecurringTransactionFormValues,
  TransactionFormValues
} from "@household/types";
import {
  classifyRecurringFailureReason,
  colors,
  formatCurrency,
  getTodayInputValue,
  monthlyInsightCopy,
  sanitizeAmountInput
} from "@household/ui";
import { styles } from "./styles";
import {
  ActionButton,
  ChipRow,
  EmptyState,
  ManageRow,
  SummaryCard,
  TransactionRow
} from "./ui";

type RecurringExecutionLogItem = LedgerSnapshot["recurringExecutionLogs"][number];
type QuickTransactionTemplate = {
  key: string;
  type: TransactionFormValues["type"];
  amount: number;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string;
  transferAccountId: string | null;
  transferAccountName: string;
  description: string;
  usedCount: number;
};

const quickAmountPresets = [
  { label: "+1\uB9CC", amount: 10_000 },
  { label: "+5\uB9CC", amount: 50_000 },
  { label: "+10\uB9CC", amount: 100_000 }
] as const;

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <Text style={styles.fieldError}>{message}</Text>;
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickChip} onPress={onPress}>
      <Text style={styles.quickChipLabel}>{label}</Text>
    </Pressable>
  );
}

function toAmountNumber(value: string) {
  return Number(value.replaceAll(",", "")) || 0;
}

function formatExecutionDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16).replace("T", " ");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getExecutionLogDetail(item: RecurringExecutionLogItem) {
  if (typeof item.errorMessage === "string" && item.errorMessage.trim()) {
    return { label: "오류", value: item.errorMessage.trim() };
  }

  const extra = item as Partial<{
    message: string;
    error: string;
  }>;

  if (typeof extra.message === "string" && extra.message.trim()) {
    return { label: "메시지", value: extra.message };
  }

  if (typeof extra.error === "string" && extra.error.trim()) {
    return { label: "오류", value: extra.error };
  }

  return null;
}

function getRecurringExecutionStatus(item: RecurringExecutionLogItem) {
  if (item.transactionId) {
    return {
      label: "성공",
      helper: "생성 거래 있음",
      tone: "success" as const
    };
  }

  return {
    label: "실패",
    helper: "생성 거래 없음",
    tone: "failure" as const
  };
}

function getRecurringExecutionSummary(item: RecurringExecutionLogItem) {
  return `예약 ${formatExecutionDateTime(item.scheduledFor)} · 실행 ${formatExecutionDateTime(
    item.executedAt
  )}`;
}

function getRecentRecurringExecutionCounts(items: RecurringExecutionLogItem[]) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return items.reduce(
    (acc, item) => {
      const executedAt = new Date(item.executedAt).getTime();

      if (Number.isNaN(executedAt) || executedAt < sevenDaysAgo) {
        return acc;
      }

      if (item.transactionId) {
        acc.success += 1;
      } else {
        acc.failure += 1;
      }

      return acc;
    },
    { success: 0, failure: 0 }
  );
}

function getTotalRecurringExecutionCounts(items: RecurringExecutionLogItem[]) {
  return items.reduce(
    (acc, item) => {
      if (item.transactionId) {
        acc.success += 1;
      } else {
        acc.failure += 1;
      }

      return acc;
    },
    { success: 0, failure: 0 }
  );
}

const recurringExecutionLogStyles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 10
  },
  content: {
    flex: 1,
    gap: 4
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999
  },
  title: {
    flexShrink: 1,
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700"
  },
  summary: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16
  },
  detail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16
  },
  status: {
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  statusSuccess: {
    backgroundColor: "#e9f7f1"
  },
  statusFailure: {
    backgroundColor: "#fff1f0"
  },
  recentSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "#faf7f2",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  recentSummaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  recentSummaryCounts: {
    flexDirection: "column",
    alignItems: "center",
    gap: 2
  },
  recentSummaryCount: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "700"
  },
  recentSummaryCountSuccess: {
    color: colors.accent
  },
  recentSummaryCountFailure: {
    color: colors.expense
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700"
  },
  statusTextSuccess: {
    color: colors.accent
  },
  statusTextFailure: {
    color: colors.expense
  },
  statusHelper: {
    fontSize: 11,
    fontWeight: "600"
  },
  failureTypeBadge: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden"
  },
  failureTypePermission: {
    color: "#a16207",
    backgroundColor: "#fff7ed"
  },
  failureTypeNetwork: {
    color: "#0369a1",
    backgroundColor: "#f0f9ff"
  },
  failureTypeInput: {
    color: "#7c3aed",
    backgroundColor: "#f5f3ff"
  },
  failureTypeOther: {
    color: "#57534e",
    backgroundColor: "#f5f5f4"
  }
});

export function ScreenTabs({
  screen,
  onChange
}: {
  screen: "home" | "entry" | "list" | "manage";
  onChange: (value: "home" | "entry" | "list" | "manage") => void;
}) {
  const items = [
    { key: "home" as const, label: "\uD648" },
    { key: "entry" as const, label: "\uC785\uB825" },
    { key: "list" as const, label: "\uBAA9\uB85D" },
    { key: "manage" as const, label: "\uAD00\uB9AC" }
  ];

  return (
    <View style={styles.tabRow}>
      {items.map((item) => (
        <View key={item.key} style={{ flex: 1 }}>
          <ActionButton
            label={item.label}
            onPress={() => onChange(item.key)}
            variant={screen === item.key ? "primary" : "secondary"}
          />
        </View>
      ))}
    </View>
  );
}

export function HomeScreen(props: {
  summary: MonthlySummary;
  transactions: LedgerTransactionItem[];
  budgetProgress: LedgerSnapshot["monthlyStats"]["budgetProgress"];
  topExpenseCategories: LedgerSnapshot["monthlyStats"]["categoryBreakdown"];
  recurringTransactions: LedgerSnapshot["recurringTransactions"];
  recurringExecutionLogs: LedgerSnapshot["recurringExecutionLogs"];
  missingStarterAccountsCount: number;
  missingStarterCategoriesCount: number;
  starterPackApplying: boolean;
  onApplyStarterPack: () => void;
  onGoManage: () => void;
  onGoEntry: () => void;
  onGoList: () => void;
  onEditTransaction: (item: LedgerTransactionItem) => void;
}) {
  const [selectedExecutionLog, setSelectedExecutionLog] = React.useState<RecurringExecutionLogItem | null>(null);
  const [showExtendedHomeSections, setShowExtendedHomeSections] = React.useState(false);
  const recentRecurringExecutionLogs = props.recurringExecutionLogs.slice(0, 3);
  const recentRecurringExecutionCounts = getRecentRecurringExecutionCounts(
    props.recurringExecutionLogs
  );
  const totalRecurringExecutionCounts = getTotalRecurringExecutionCounts(
    props.recurringExecutionLogs
  );
  const hasStarterPackGaps =
    props.missingStarterAccountsCount + props.missingStarterCategoriesCount > 0;

  return (
    <>
      <View style={styles.summaryRow}>
        <SummaryCard label="\uC774\uBC88 \uB2EC \uC218\uC785" value={props.summary.income} />
        <SummaryCard label="\uC774\uBC88 \uB2EC \uC9C0\uCD9C" value={props.summary.expense} />
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"핵심 정보"}</Text>
        <Text style={styles.helperText}>{"이번 달 돈 흐름을 먼저 확인하고 바로 입력으로 이동하세요."}</Text>
        <Text style={styles.cardLabel}>{"\uC774\uBC88 \uB2EC \uC794\uC561"}</Text>
        <Text style={styles.netValue}>{formatCurrency(props.summary.balance)}</Text>
        <View style={styles.row}>
          <ActionButton
            label="\uBE60\uB978 \uC785\uB825"
            onPress={props.onGoEntry}
            variant="primary"
          />
          <ActionButton
            label="\uC804\uCCB4 \uBAA9\uB85D"
            onPress={props.onGoList}
            variant="secondary"
          />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"스타터 팩"}</Text>
        <Text style={styles.helperText}>
          {`초기 설정을 빠르게 마치려면 계정 ${props.missingStarterAccountsCount}개, 카테고리 ${props.missingStarterCategoriesCount}개를 한 번에 추가하세요.`}
        </Text>
        <View style={styles.row}>
          <ActionButton
            label={
              props.starterPackApplying
                ? "적용 중..."
                : !hasStarterPackGaps
                  ? "이미 적용 완료"
                  : "스타터 팩 적용"
            }
            onPress={props.onApplyStarterPack}
            variant="primary"
            disabled={
              props.starterPackApplying ||
              !hasStarterPackGaps
            }
          />
          <ActionButton
            label="관리 화면 열기"
            onPress={props.onGoManage}
            variant="secondary"
          />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{monthlyInsightCopy.sectionTitle}</Text>
        {!props.topExpenseCategories.length ? (
          <EmptyState text={monthlyInsightCopy.topExpenseEmpty} />
        ) : null}
        {props.topExpenseCategories.slice(0, 3).map((item) => (
          <View key={item.categoryId} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{item.categoryName}</Text>
              <Text style={styles.listSubTitle}>{`${item.percentage.toFixed(1)}%`}</Text>
            </View>
            <Text style={styles.listAmount}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"\uCD5C\uADFC \uAC70\uB798\uB0B4\uC5ED"}</Text>
        {!props.transactions.length ? (
          <EmptyState
            text={
              "\uC544\uC9C1 \uAC70\uB798\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uCCAB \uAC70\uB798\uB97C \uBC14\uB85C \uC785\uB825\uD574\uBCF4\uC138\uC694."
            }
          />
        ) : null}
        {props.transactions.map((item) => (
          <TransactionRow
            key={item.id}
            item={item}
            onEdit={() => props.onEditTransaction(item)}
          />
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"운영 상세"}</Text>
        <Text style={styles.helperText}>
          {"예산 진행률과 반복 실행 로그는 필요할 때만 펼쳐서 확인하세요."}
        </Text>
        <ActionButton
          label={showExtendedHomeSections ? "상세 접기" : "상세 보기"}
          onPress={() => setShowExtendedHomeSections((prev) => !prev)}
          variant="secondary"
        />
      </View>
      {showExtendedHomeSections ? (
        <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"\uC608\uC0B0 \uC694\uC57D"}</Text>
        {!props.budgetProgress.length ? <EmptyState text="\uC124\uC815\uB41C \uC608\uC0B0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." /> : null}
        {props.budgetProgress.slice(0, 3).map((item) => (
          <View key={item.budgetId} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{item.categoryName ?? "\uCE74\uD14C\uACE0\uB9AC"}</Text>
              <Text style={styles.listSubTitle}>
                {formatCurrency(item.spentAmount)} / {formatCurrency(item.budgetAmount)}
              </Text>
            </View>
            <Text style={styles.listAmount}>{item.percentUsed}%</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"\uBC18\uBCF5\uC9C0\uCD9C \uC694\uC57D"}</Text>
        {!props.recurringTransactions.length ? <EmptyState text="\uB4F1\uB85D\uB41C \uBC18\uBCF5\uC9C0\uCD9C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." /> : null}
        {props.recurringTransactions.slice(0, 3).map((item) => (
          <View key={item.id} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{item.description || "\uBC18\uBCF5 \uC9C0\uCD9C"}</Text>
              <Text style={styles.listSubTitle}>{item.nextRunAt.slice(0, 10)}</Text>
            </View>
            <Text style={styles.listAmount}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"\uBC18\uBCF5\uAC70\uB798 \uC2E4\uD589 \uB85C\uADF8"}</Text>
        <View style={recurringExecutionLogStyles.recentSummaryRow}>
          <Text style={recurringExecutionLogStyles.recentSummaryLabel}>{"실행 요약"}</Text>
          <View style={recurringExecutionLogStyles.recentSummaryCounts}>
            <Text style={recurringExecutionLogStyles.recentSummaryCount}>
              {"최근 7일 "}
              <Text style={recurringExecutionLogStyles.recentSummaryCountSuccess}>
                {`성공 ${recentRecurringExecutionCounts.success}`}
              </Text>
              {" · "}
              <Text style={recurringExecutionLogStyles.recentSummaryCountFailure}>
                {`실패 ${recentRecurringExecutionCounts.failure}`}
              </Text>
            </Text>
            <Text style={recurringExecutionLogStyles.recentSummaryCount}>
              {"총 누적 "}
              <Text style={recurringExecutionLogStyles.recentSummaryCountSuccess}>
                {`성공 ${totalRecurringExecutionCounts.success}`}
              </Text>
              {" · "}
              <Text style={recurringExecutionLogStyles.recentSummaryCountFailure}>
                {`실패 ${totalRecurringExecutionCounts.failure}`}
              </Text>
            </Text>
          </View>
        </View>
        {!recentRecurringExecutionLogs.length ? (
          <EmptyState text="\uC544\uC9C1 \uBC18\uBCF5\uAC70\uB798 \uC2E4\uD589 \uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." />
        ) : null}
        {recentRecurringExecutionLogs.map((item) => {
          const status = getRecurringExecutionStatus(item);
          const detail = getExecutionLogDetail(item);
          const failureKind =
            status.tone === "failure"
              ? classifyRecurringFailureReason(detail?.value)
              : null;

          return (
            <Pressable
              key={item.id}
              onPress={() => setSelectedExecutionLog(item)}
              style={recurringExecutionLogStyles.item}
            >
              <View style={recurringExecutionLogStyles.content}>
                <View style={recurringExecutionLogStyles.titleRow}>
                  <View
                    style={[
                      recurringExecutionLogStyles.statusDot,
                      { backgroundColor: status.tone === "success" ? colors.accent : colors.expense }
                    ]}
                  />
                  <Text style={recurringExecutionLogStyles.title}>{"반복거래 실행"}</Text>
                </View>
                <Text style={recurringExecutionLogStyles.summary}>
                  {getRecurringExecutionSummary(item)}
                </Text>
                {detail ? (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={recurringExecutionLogStyles.detail}
                  >
                    {detail.label}: {detail.value}
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  recurringExecutionLogStyles.status,
                  status.tone === "success"
                    ? recurringExecutionLogStyles.statusSuccess
                    : recurringExecutionLogStyles.statusFailure
                ]}
              >
                <Text
                  style={[
                    recurringExecutionLogStyles.statusText,
                    status.tone === "success"
                      ? recurringExecutionLogStyles.statusTextSuccess
                      : recurringExecutionLogStyles.statusTextFailure
                  ]}
                >
                  {status.label}
                </Text>
                <Text
                  style={[
                    recurringExecutionLogStyles.statusHelper,
                    status.tone === "success"
                      ? recurringExecutionLogStyles.statusTextSuccess
                      : recurringExecutionLogStyles.statusTextFailure
                  ]}
                >
                  {status.helper}
                </Text>
                {failureKind ? (
                  <Text
                    style={[
                      recurringExecutionLogStyles.failureTypeBadge,
                      failureKind.kind === "permission"
                        ? recurringExecutionLogStyles.failureTypePermission
                        : failureKind.kind === "network"
                          ? recurringExecutionLogStyles.failureTypeNetwork
                          : failureKind.kind === "input"
                            ? recurringExecutionLogStyles.failureTypeInput
                            : recurringExecutionLogStyles.failureTypeOther
                    ]}
                  >
                    {failureKind.label}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        <Modal
          animationType="slide"
          onRequestClose={() => setSelectedExecutionLog(null)}
          transparent
          visible={Boolean(selectedExecutionLog)}
        >
          <Pressable
            onPress={() => setSelectedExecutionLog(null)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.3)",
              justifyContent: "flex-end"
            }}
          >
            <Pressable
              onPress={() => {
                // Prevent close when tapping modal content.
              }}
              style={{
                backgroundColor: "#ffffff",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingHorizontal: 20,
                paddingTop: 18,
                paddingBottom: 24,
                gap: 10
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
                {"반복거래 실행 상세"}
              </Text>
              {selectedExecutionLog ? (
                <>
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    {getRecurringExecutionSummary(selectedExecutionLog)}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.foreground }}>
                    {"상태: "}
                    {getRecurringExecutionStatus(selectedExecutionLog).label}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.foreground }}>
                    {"사유: "}
                    {getExecutionLogDetail(selectedExecutionLog)?.value ?? "사유 없음"}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.foreground }}>
                    {"유형: "}
                    {getRecurringExecutionStatus(selectedExecutionLog).tone === "failure"
                      ? classifyRecurringFailureReason(getExecutionLogDetail(selectedExecutionLog)?.value).label
                      : "-"}
                  </Text>
                </>
              ) : null}
              <ActionButton
                label="사유 공유"
                onPress={() => {
                  if (!selectedExecutionLog) {
                    return;
                  }

                  const reason = getExecutionLogDetail(selectedExecutionLog)?.value ?? "사유 없음";
                  const failureKind = classifyRecurringFailureReason(reason).label;
                  void Share.share({
                    message: [
                      "반복거래 실행 상세",
                      `로그 ID: ${selectedExecutionLog.id}`,
                      `예약: ${formatExecutionDateTime(selectedExecutionLog.scheduledFor)}`,
                      `실행: ${formatExecutionDateTime(selectedExecutionLog.executedAt)}`,
                      `상태: ${getRecurringExecutionStatus(selectedExecutionLog).label}`,
                      `유형: ${failureKind}`,
                      `사유: ${reason}`
                    ].join("\n")
                  });
                }}
                variant="secondary"
              />
              <ActionButton
                label="닫기"
                onPress={() => setSelectedExecutionLog(null)}
                variant="secondary"
              />
            </Pressable>
          </Pressable>
        </Modal>
      </View>
      </>
      ) : null}
    </>
  );
}

export function EntryScreen(props: {
  accounts: LedgerSnapshot["accounts"];
  categories: LedgerSnapshot["categories"];
  quickTransactionTemplates: QuickTransactionTemplate[];
  pinnedTemplateKeys: string[];
  onToggleTemplatePin: (templateKey: string) => void;
  onApplyQuickTemplate: (template: QuickTransactionTemplate) => void;
  form: UseFormReturn<TransactionFormValues>;
  transactionType: TransactionFormValues["type"];
  onSubmit: (values: TransactionFormValues) => Promise<void>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{"\uAC70\uB798 \uC785\uB825"}</Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{"최근 사용 템플릿"}</Text>
        {!props.quickTransactionTemplates.length ? (
          <EmptyState text="아직 데이터가 없어요. 거래를 2~3건 입력하면 템플릿이 자동 추천됩니다." />
        ) : (
          <View style={styles.quickChipRow}>
            {props.quickTransactionTemplates.map((template) => (
              <View key={`mobile-quick-template-${template.key}`} style={{ minWidth: 130, flex: 1 }}>
                <Pressable
                  onLongPress={() => props.onToggleTemplatePin(template.key)}
                  onPress={() => props.onApplyQuickTemplate(template)}
                  style={[
                    styles.quickChip,
                    {
                      borderRadius: 14,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderColor: props.pinnedTemplateKeys.includes(template.key) ? colors.accent : colors.border,
                      backgroundColor: props.pinnedTemplateKeys.includes(template.key) ? "#eef8f3" : "#ffffff"
                    }
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <Text style={[styles.quickChipLabel, { fontSize: 11, fontWeight: "700", flex: 1 }]}>
                      {template.description || (template.type === "transfer" ? "이체 템플릿" : "빠른 템플릿")}
                    </Text>
                    <Text style={[styles.quickChipLabel, { fontSize: 10, color: props.pinnedTemplateKeys.includes(template.key) ? colors.accent : colors.muted }]}>
                      {props.pinnedTemplateKeys.includes(template.key) ? "고정됨" : "길게 눌러 고정"}
                    </Text>
                  </View>
                  <Text style={[styles.quickChipLabel, { marginTop: 4, fontSize: 11 }]}>
                    {formatCurrency(template.amount)}
                  </Text>
                  <Text style={[styles.quickChipLabel, { marginTop: 3, fontSize: 10, opacity: 0.9 }]}>
                    {`${template.type === "income" ? "수입" : template.type === "expense" ? "지출" : "이체"} · ${template.accountName}${
                      template.type === "transfer" && template.transferAccountName
                        ? ` → ${template.transferAccountName}`
                        : ""
                    }${template.categoryName ? ` · ${template.categoryName}` : ""}`}
                  </Text>
                  <Text style={[styles.quickChipLabel, { marginTop: 2, fontSize: 10, opacity: 0.8 }]}>
                    {`${template.usedCount}회`}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
      <Controller
        control={props.form.control}
        name="type"
        render={({ field }) => (
          <ChipRow
            items={TRANSACTION_TYPE_OPTIONS.map((item) => ({
              value: item.value,
              label: item.label
            }))}
            selected={field.value}
            onSelect={(value) => {
              field.onChange(value);
              if (value === "transfer") {
                props.form.setValue("categoryId", "");
              } else {
                props.form.setValue("transferAccountId", "");
              }
            }}
          />
        )}
      />
      <Controller
        control={props.form.control}
        name="amountInput"
        render={({ field, fieldState }) => (
          <View style={styles.fieldGroup}>
            <TextInput
              keyboardType="number-pad"
              placeholder="\uAE08\uC561"
              placeholderTextColor="#6a5f58"
              style={styles.amountInput}
              value={field.value}
              onChangeText={(value) => field.onChange(sanitizeAmountInput(value))}
            />
            <View style={styles.quickChipRow}>
              {quickAmountPresets.map((preset) => (
                <QuickChip
                  key={preset.label}
                  label={preset.label}
                  onPress={() => {
                    const nextAmount = toAmountNumber(field.value) + preset.amount;
                    field.onChange(sanitizeAmountInput(String(nextAmount)));
                  }}
                />
              ))}
              <QuickChip
                label="\uCD08\uAE30\uD654"
                onPress={() => {
                  field.onChange("");
                }}
              />
            </View>
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />
      <Controller
        control={props.form.control}
        name="occurredAt"
        render={({ field, fieldState }) => (
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>{"\uAC70\uB798 \uB0A0\uC9DC"}</Text>
              <QuickChip
                label="\uC624\uB298"
                onPress={() => {
                  field.onChange(getTodayInputValue());
                }}
              />
            </View>
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
            />
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />
      <Controller
        control={props.form.control}
        name="accountId"
        render={({ field, fieldState }) => (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{"\uACC4\uC815 \uC120\uD0DD"}</Text>
            <ChipRow
              items={props.accounts.map((item) => ({
                value: item.id,
                label: item.name
              }))}
              selected={field.value}
              onSelect={field.onChange}
            />
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />
      <Controller
        control={props.form.control}
        name={props.transactionType === "transfer" ? "transferAccountId" : "categoryId"}
        render={({ field, fieldState }) =>
          props.transactionType === "transfer" ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{"\uBC1B\uB294 \uACC4\uC815"}</Text>
              <ChipRow
                items={props.accounts.map((item) => ({
                  value: item.id,
                  label: item.name
                }))}
                selected={field.value}
                onSelect={field.onChange}
              />
              <FieldError message={fieldState.error?.message} />
            </View>
          ) : (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{"\uCE74\uD14C\uACE0\uB9AC"}</Text>
              <ChipRow
                items={props.categories.map((item) => ({
                  value: item.id,
                  label: item.name
                }))}
                selected={field.value}
                onSelect={field.onChange}
              />
              <FieldError message={fieldState.error?.message} />
            </View>
          )
        }
      />
      <Controller
        control={props.form.control}
        name="description"
        render={({ field }) => (
          <TextInput
            placeholder="\uBA54\uBAA8"
            placeholderTextColor="#6a5f58"
            style={styles.input}
            value={field.value}
            onChangeText={field.onChange}
          />
        )}
      />
      <ActionButton
        label="\uAC70\uB798 \uC800\uC7A5"
        onPress={props.form.handleSubmit((values) => void props.onSubmit(values))}
        variant="primary"
      />
    </View>
  );
}

export function ListScreen(props: {
  transactions: LedgerTransactionItem[];
  onEdit: (item: LedgerTransactionItem) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{"\uAC70\uB798 \uBAA9\uB85D"}</Text>
      {!props.transactions.length ? (
        <EmptyState text="\uAC70\uB798 \uBAA9\uB85D\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4." />
      ) : null}
      {props.transactions.map((item) => (
        <View key={item.id} style={styles.listItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle}>
              {item.description || item.categoryName || "\uC124\uBA85 \uC5C6\uC74C"}
            </Text>
            <Text style={styles.listSubTitle}>{item.accountName ?? "\uACC4\uC815 \uC5C6\uC74C"}</Text>
          </View>
          <View style={styles.rightActions}>
            <Text style={styles.listAmount}>{formatCurrency(item.amount)}</Text>
            <View style={styles.row}>
              <ActionButton
                label="\uC218\uC815"
                onPress={() => props.onEdit(item)}
                variant="ghostSmall"
              />
              <ActionButton
                label="\uC0AD\uC81C"
                onPress={() => void props.onDelete(item.id)}
                variant="dangerSmall"
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ManageScreen(props: {
  accountForm: UseFormReturn<AccountFormValues>;
  budgetForm: UseFormReturn<BudgetFormValues>;
  categoryForm: UseFormReturn<CategoryFormValues>;
  profileForm: UseFormReturn<ProfileSettingsFormValues>;
  recurringForm: UseFormReturn<RecurringTransactionFormValues>;
  accounts: LedgerSnapshot["accounts"];
  budgets: LedgerSnapshot["budgets"];
  categories: LedgerSnapshot["categories"];
  profile: Profile | null;
  recurringTransactions: LedgerSnapshot["recurringTransactions"];
  onSaveAccount: (values: AccountFormValues) => Promise<void>;
  onSaveBudget: (values: BudgetFormValues) => Promise<void>;
  onSaveCategory: (values: CategoryFormValues) => Promise<void>;
  onSaveProfile: (values: ProfileSettingsFormValues) => Promise<void>;
  onSaveRecurring: (values: RecurringTransactionFormValues) => Promise<void>;
  onEditAccount: (id: string) => void;
  onEditBudget: (id: string) => void;
  onEditCategory: (id: string) => void;
  onEditRecurring: (id: string) => void;
}) {
  const recurringType = props.recurringForm.watch("type");

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"프로필 설정"}</Text>
        <Controller
          control={props.profileForm.control}
          name="displayName"
          render={({ field, fieldState }) => (
            <View style={styles.fieldGroup}>
              <TextInput
                placeholder="표시 이름"
                placeholderTextColor="#6a5f58"
                style={styles.input}
                value={field.value}
                onChangeText={field.onChange}
              />
              <FieldError message={fieldState.error?.message} />
            </View>
          )}
        />
        <Controller
          control={props.profileForm.control}
          name="weekStartsOn"
          render={({ field, fieldState }) => (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{"주 시작일"}</Text>
              <ChipRow
                items={[
                  { value: "1", label: "월요일 시작" },
                  { value: "0", label: "일요일 시작" }
                ]}
                selected={String(field.value)}
                onSelect={(value) => field.onChange(Number(value))}
              />
              <FieldError message={fieldState.error?.message} />
            </View>
          )}
        />
        <Controller
          control={props.profileForm.control}
          name="monthStartDay"
          render={({ field, fieldState }) => (
            <View style={styles.fieldGroup}>
              <TextInput
                keyboardType="number-pad"
                placeholder="월 시작일 (1-28)"
                placeholderTextColor="#6a5f58"
                style={styles.input}
                value={String(field.value ?? "")}
                onChangeText={(value) => field.onChange(Number(value) || 1)}
              />
              <FieldError message={fieldState.error?.message} />
            </View>
          )}
        />
        <ActionButton
          label="프로필 저장"
          onPress={props.profileForm.handleSubmit((values) => void props.onSaveProfile(values))}
          variant="primary"
        />
        <Text style={styles.listSubTitle}>
          {`현재: ${props.profile?.displayName || "미설정"} · ${
            props.profile?.weekStartsOn === 0 ? "일요일 시작" : "월요일 시작"
          } · 월 시작일 ${props.profile?.monthStartDay ?? 1}일`}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"\uACC4\uC815 \uAD00\uB9AC"}</Text>
        <Controller
          control={props.accountForm.control}
          name="name"
          render={({ field }) => (
            <TextInput
              placeholder="\uACC4\uC815 \uC774\uB984"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={props.accountForm.control}
          name="type"
          render={({ field }) => (
            <ChipRow
              items={ACCOUNT_TYPE_OPTIONS.map((item) => ({
                value: item.value,
                label: item.label
              }))}
              selected={field.value}
              onSelect={field.onChange}
            />
          )}
        />
        <Controller
          control={props.accountForm.control}
          name="balanceInput"
          render={({ field }) => (
            <TextInput
              keyboardType="number-pad"
              placeholder="\uC794\uC561"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={(value) => field.onChange(sanitizeAmountInput(value))}
            />
          )}
        />
        <ActionButton
          label="\uACC4\uC815 \uC800\uC7A5"
          onPress={props.accountForm.handleSubmit((values) => void props.onSaveAccount(values))}
          variant="primary"
        />
        {!props.accounts.length ? (
          <EmptyState text="\uC544\uC9C1 \uACC4\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." />
        ) : null}
        {props.accounts.map((item) => (
          <ManageRow
            key={item.id}
            title={item.name}
            subtitle={`${ACCOUNT_TYPE_OPTIONS.find((option) => option.value === item.type)?.label ?? item.type} · ${formatCurrency(item.balance)}`}
            onEdit={() => props.onEditAccount(item.id)}
          />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"\uCE74\uD14C\uACE0\uB9AC \uAD00\uB9AC"}</Text>
        <Controller
          control={props.categoryForm.control}
          name="name"
          render={({ field }) => (
            <TextInput
              placeholder="\uCE74\uD14C\uACE0\uB9AC \uC774\uB984"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={props.categoryForm.control}
          name="kind"
          render={({ field }) => (
            <ChipRow
              items={CATEGORY_KIND_OPTIONS.map((item) => ({
                value: item.value,
                label: item.label
              }))}
              selected={field.value}
              onSelect={field.onChange}
            />
          )}
        />
        <Controller
          control={props.categoryForm.control}
          name="color"
          render={({ field }) => (
            <TextInput
              placeholder="#1c7c54"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <ActionButton
          label="\uCE74\uD14C\uACE0\uB9AC \uC800\uC7A5"
          onPress={props.categoryForm.handleSubmit((values) => void props.onSaveCategory(values))}
          variant="primary"
        />
        {!props.categories.length ? (
          <EmptyState text="\uC544\uC9C1 \uCE74\uD14C\uACE0\uB9AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." />
        ) : null}
        {props.categories.map((item) => (
          <ManageRow
            key={item.id}
            title={item.name}
            subtitle={`${CATEGORY_KIND_OPTIONS.find((option) => option.value === item.kind)?.label ?? item.kind} · ${item.color}`}
            onEdit={() => props.onEditCategory(item.id)}
          />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"\uC608\uC0B0 \uAD00\uB9AC"}</Text>
        <Controller
          control={props.budgetForm.control}
          name="month"
          render={({ field }) => (
            <TextInput
              placeholder="YYYY-MM"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={props.budgetForm.control}
          name="categoryId"
          render={({ field }) => (
            <ChipRow
              items={props.categories.filter((item) => item.kind === "expense").map((item) => ({
                value: item.id,
                label: item.name
              }))}
              selected={field.value}
              onSelect={field.onChange}
            />
          )}
        />
        <Controller
          control={props.budgetForm.control}
          name="amountInput"
          render={({ field }) => (
            <TextInput
              keyboardType="number-pad"
              placeholder="\uC608\uC0B0 \uAE08\uC561"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={(value) => field.onChange(sanitizeAmountInput(value))}
            />
          )}
        />
        <ActionButton
          label="\uC608\uC0B0 \uC800\uC7A5"
          onPress={props.budgetForm.handleSubmit((values) => void props.onSaveBudget(values))}
          variant="primary"
        />
        {!props.budgets.length ? (
          <EmptyState text="\uC544\uC9C1 \uC608\uC0B0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." />
        ) : null}
        {props.budgets.map((item) => (
          <ManageRow
            key={item.id}
            title={`${item.month} · ${props.categories.find((category) => category.id === item.categoryId)?.name ?? "카테고리"}`}
            subtitle={formatCurrency(item.amount)}
            onEdit={() => props.onEditBudget(item.id)}
          />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{"\uBC18\uBCF5\uC9C0\uCD9C \uAD00\uB9AC"}</Text>
        <Controller
          control={props.recurringForm.control}
          name="type"
          render={({ field }) => (
            <ChipRow
              items={TRANSACTION_TYPE_OPTIONS.map((item) => ({
                value: item.value,
                label: item.label
              }))}
              selected={field.value}
              onSelect={field.onChange}
            />
          )}
        />
        <Controller
          control={props.recurringForm.control}
          name="amountInput"
          render={({ field }) => (
            <TextInput
              keyboardType="number-pad"
              placeholder="\uBC18\uBCF5 \uAE08\uC561"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={(value) => field.onChange(sanitizeAmountInput(value))}
            />
          )}
        />
        <Controller
          control={props.recurringForm.control}
          name="accountId"
          render={({ field }) => (
            <ChipRow
              items={props.accounts.map((item) => ({ value: item.id, label: item.name }))}
              selected={field.value}
              onSelect={field.onChange}
            />
          )}
        />
        {recurringType === "transfer" ? (
          <Controller
            control={props.recurringForm.control}
            name="transferAccountId"
            render={({ field }) => (
              <ChipRow
                items={props.accounts.map((item) => ({ value: item.id, label: item.name }))}
                selected={field.value}
                onSelect={field.onChange}
              />
            )}
          />
        ) : (
          <Controller
            control={props.recurringForm.control}
            name="categoryId"
            render={({ field }) => (
              <ChipRow
                items={props.categories.filter((item) => item.kind === recurringType).map((item) => ({
                  value: item.id,
                  label: item.name
                }))}
                selected={field.value}
                onSelect={field.onChange}
              />
            )}
          />
        )}
        <Controller
          control={props.recurringForm.control}
          name="frequency"
          render={({ field }) => (
            <ChipRow
              items={RECURRING_FREQUENCY_OPTIONS.map((item) => ({
                value: item.value,
                label: item.label
              }))}
              selected={field.value}
              onSelect={field.onChange}
            />
          )}
        />
        <Controller
          control={props.recurringForm.control}
          name="nextRunAt"
          render={({ field }) => (
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={props.recurringForm.control}
          name="description"
          render={({ field }) => (
            <TextInput
              placeholder="\uBC18\uBCF5 \uC124\uBA85"
              placeholderTextColor="#6a5f58"
              style={styles.input}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={props.recurringForm.control}
          name="isActive"
          render={({ field }) => (
            <ChipRow
              items={[
                { value: "active", label: "\uD65C\uC131" },
                { value: "inactive", label: "\uBE44\uD65C\uC131" }
              ]}
              selected={field.value ? "active" : "inactive"}
              onSelect={(value) => field.onChange(value === "active")}
            />
          )}
        />
        <ActionButton
          label="\uBC18\uBCF5\uC9C0\uCD9C \uC800\uC7A5"
          onPress={props.recurringForm.handleSubmit((values) => void props.onSaveRecurring(values))}
          variant="primary"
        />
        {!props.recurringTransactions.length ? (
          <EmptyState text="\uC544\uC9C1 \uBC18\uBCF5\uC9C0\uCD9C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." />
        ) : null}
        {props.recurringTransactions.map((item) => (
          <ManageRow
            key={item.id}
            title={item.description || "\uBC18\uBCF5 \uC9C0\uCD9C"}
            subtitle={`${item.nextRunAt.slice(0, 10)} · ${RECURRING_FREQUENCY_OPTIONS.find((option) => option.value === item.frequency)?.label ?? item.frequency} · ${item.isActive ? "\uD65C\uC131" : "\uBE44\uD65C\uC131"} · ${formatCurrency(item.amount)}`}
            onEdit={() => props.onEditRecurring(item.id)}
          />
        ))}
      </View>
    </>
  );
}







