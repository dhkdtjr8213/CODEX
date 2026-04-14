import { Pressable, Text, View } from "react-native";
import { formatCurrency, formatDateLabel } from "@household/ui";
import type { LedgerTransactionItem } from "@household/types";
import { styles } from "./styles";

export function ActionButton({
  label,
  onPress,
  variant
}: {
  label: string;
  onPress: () => void;
  variant: "primary" | "secondary" | "ghost" | "ghostSmall" | "dangerSmall";
}) {
  const backgroundColor =
    variant === "primary" ? "#1f1a17" : variant === "dangerSmall" ? "#fff5f5" : "#ffffff";
  const borderColor =
    variant === "primary" ? "#1f1a17" : variant === "dangerSmall" ? "#ef9a9a" : "#e9dfd2";
  const textColor =
    variant === "primary" ? "#ffffff" : variant === "dangerSmall" ? "#c44536" : "#1f1a17";

  return (
    <Pressable style={[styles.buttonBase, { backgroundColor, borderColor, borderWidth: 1 }]} onPress={onPress}>
      <Text style={{ color: textColor, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({
  items,
  selected,
  onSelect
}: {
  items: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <Pressable
          key={item.value}
          style={[styles.chip, selected === item.value ? styles.chipActive : null]}
          onPress={() => onSelect(item.value)}
        >
          <Text style={[styles.chipLabel, selected === item.value ? styles.chipLabelActive : null]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{formatCurrency(value)}</Text>
    </View>
  );
}

export function TransactionRow({
  item,
  onEdit
}: {
  item: LedgerTransactionItem;
  onEdit: () => void;
}) {
  return (
    <Pressable style={styles.listItem} onPress={onEdit}>
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{item.description || item.categoryName || "설명 없음"}</Text>
        <Text style={styles.listSubTitle}>
          {formatDateLabel(item.occurredAt)} · {item.accountName ?? "계정 없음"}
        </Text>
      </View>
      <Text style={styles.listAmount}>{formatCurrency(item.amount)}</Text>
    </Pressable>
  );
}

export function ManageRow({
  title,
  subtitle,
  onEdit
}: {
  title: string;
  subtitle: string;
  onEdit: () => void;
}) {
  return (
    <View style={styles.listItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listSubTitle}>{subtitle}</Text>
      </View>
      <ActionButton label="수정" onPress={onEdit} variant="ghostSmall" />
    </View>
  );
}