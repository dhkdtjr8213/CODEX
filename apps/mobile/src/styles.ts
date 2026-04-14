import { StyleSheet } from "react-native";
import { colors } from "@household/ui";

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    padding: 20,
    gap: 16
  },
  hero: {
    backgroundColor: colors.accent,
    borderRadius: 28,
    padding: 20
  },
  eyebrow: {
    color: "#d9f5ea",
    fontSize: 12,
    fontWeight: "700"
  },
  title: {
    color: "white",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 10
  },
  subtitle: {
    color: "white",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    gap: 12
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "700"
  },
  statusText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  input: {
    backgroundColor: "white",
    borderRadius: 18,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground
  },
  fieldGroup: {
    gap: 8
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  fieldError: {
    color: "#c44536",
    fontSize: 12,
    lineHeight: 16
  },
  amountInput: {
    backgroundColor: "white",
    borderRadius: 18,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "800"
  },
  quickChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  quickChipLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600"
  },
  row: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap"
  },
  tabRow: {
    flexDirection: "row",
    gap: 8
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    alignItems: "center"
  },
  tabButtonActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground
  },
  tabLabel: {
    color: colors.foreground,
    fontWeight: "600"
  },
  tabLabelActive: {
    color: "white"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  chipActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground
  },
  chipLabel: {
    color: colors.foreground,
    fontWeight: "600"
  },
  chipLabelActive: {
    color: "white"
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 13
  },
  cardValue: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 10
  },
  netValue: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 10
  },
  buttonBase: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 12
  },
  listTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600"
  },
  listSubTitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4
  },
  listAmount: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700"
  },
  rightActions: {
    alignItems: "flex-end",
    gap: 8
  },
  emptyBox: {
    backgroundColor: "#f2eee8",
    borderRadius: 18,
    padding: 16
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  errorText: {
    color: "#c44536",
    backgroundColor: "#fff1f0",
    borderRadius: 16,
    padding: 14
  }
});
