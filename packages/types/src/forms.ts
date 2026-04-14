import { z } from "zod";

const amountInputSchema = z
  .string()
  .min(1, "\uAE08\uC561\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.")
  .refine(
    (value) => Number(value.replaceAll(",", "")) > 0,
    "\uAE08\uC561\uC740 0\uBCF4\uB2E4 \uCEE4\uC57C \uD569\uB2C8\uB2E4."
  );

export const accountFormSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1, "\uACC4\uC815 \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.")
    .max(30, "\uACC4\uC815 \uC774\uB984\uC774 \uB108\uBB34 \uAE41\uC2B5\uB2C8\uB2E4."),
  type: z.enum(["cash", "bank", "card", "investment", "other"]),
  balanceInput: amountInputSchema.default("0")
});

export const categoryFormSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1, "\uCE74\uD14C\uACE0\uB9AC \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.")
    .max(30, "\uCE74\uD14C\uACE0\uB9AC \uC774\uB984\uC774 \uB108\uBB34 \uAE41\uC2B5\uB2C8\uB2E4."),
  kind: z.enum(["income", "expense"]),
  color: z.string().min(4).max(20).default("#1c7c54"),
  icon: z.string().optional().default("")
});

export const transactionFormSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["income", "expense", "transfer"]),
    amountInput: amountInputSchema,
    occurredAt: z.string().min(1, "\uB0A0\uC9DC\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694."),
    accountId: z.string().min(1, "\uACC4\uC815\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694."),
    categoryId: z.string().optional().default(""),
    transferAccountId: z.string().optional().default(""),
    description: z.string().optional().default("")
  })
  .superRefine((value, ctx) => {
    if (value.type === "transfer") {
      if (!value.transferAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transferAccountId"],
          message: "\uC774\uCCB4 \uB300\uC0C1 \uACC4\uC815\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694."
        });
      }

      if (value.transferAccountId && value.transferAccountId === value.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transferAccountId"],
          message:
            "\uCD9C\uAE08 \uACC4\uC815\uACFC \uB2E4\uB978 \uACC4\uC815\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694."
        });
      }
    }

    if (value.type !== "transfer" && !value.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "\uCE74\uD14C\uACE0\uB9AC\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694."
      });
    }
  });

export const budgetFormSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1, "\uCE74\uD14C\uACE0\uB9AC\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694."),
  amountInput: amountInputSchema,
  month: z.string().min(7, "\uC608\uC0B0 \uC6D4\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.")
});

export const recurringTransactionFormSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["expense", "income", "transfer"]).default("expense"),
    amountInput: amountInputSchema,
    accountId: z.string().min(1, "\uACC4\uC815\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694."),
    categoryId: z.string().optional().default(""),
    transferAccountId: z.string().optional().default(""),
    description: z.string().optional().default(""),
    frequency: z.enum(["monthly"]).default("monthly"),
    nextRunAt: z.string().min(1, "\uB2E4\uC74C \uC2E4\uD589\uC77C\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694."),
    isActive: z.boolean().default(true)
  })
  .superRefine((value, ctx) => {
    if (value.type === "transfer") {
      if (!value.transferAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transferAccountId"],
          message: "\uC774\uCCB4 \uB300\uC0C1 \uACC4\uC815\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694."
        });
      }
    } else if (!value.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "\uCE74\uD14C\uACE0\uB9AC\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694."
      });
    }
  });

export const profileSettingsFormSchema = z.object({
  displayName: z.string().max(40, "\uC774\uB984\uC740 40\uC790 \uC774\uB0B4\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694.").default(""),
  defaultCurrency: z.enum(["KRW"]).default("KRW"),
  weekStartsOn: z.coerce
    .number()
    .int()
    .refine((value) => value === 0 || value === 1, {
      message: "\uC2DC\uC791 \uC694\uC77C\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694."
    }),
  monthStartDay: z.coerce
    .number()
    .int()
    .min(1, "\uC6D4 \uC2DC\uC791\uC77C\uC740 1\uC77C \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.")
    .max(28, "\uC6D4 \uC2DC\uC791\uC77C\uC740 28\uC77C \uC774\uD558\uB85C \uC124\uC815\uD574\uC8FC\uC138\uC694.")
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
export type RecurringTransactionFormValues = z.infer<typeof recurringTransactionFormSchema>;
export type ProfileSettingsFormValues = z.infer<typeof profileSettingsFormSchema>;
