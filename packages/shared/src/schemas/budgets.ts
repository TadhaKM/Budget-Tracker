import { z } from 'zod';

const budgetPeriodEnum = z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY']);

const categoryEnum = z.enum([
  'GROCERIES',
  'DINING',
  'TRANSPORT',
  'ENTERTAINMENT',
  'SHOPPING',
  'BILLS',
  'HEALTH',
  'SUBSCRIPTIONS',
  'TRANSFERS',
  'INCOME',
  'ATM',
  'OTHER',
]);

export const BudgetSchema = z.object({
  id: z.string().uuid(),
  categoryId: categoryEnum,
  limitAmount: z.number().positive(),
  period: budgetPeriodEnum,
  periodStartDay: z.number().int().min(1).max(28).default(1),
  alertAtPercent: z.number().int().min(1).max(100).default(80),
  isActive: z.boolean(),
  spentAmount: z.number().default(0),
  percentUsed: z.number().default(0),
});

export const CreateBudgetSchema = z.object({
  categoryId: categoryEnum,
  limitAmount: z.number().positive(),
  period: budgetPeriodEnum,
  periodStartDay: z.number().int().min(1).max(28).default(1),
  alertAtPercent: z.number().int().min(1).max(100).default(80),
});

export const UpdateBudgetSchema = z.object({
  limitAmount: z.number().positive().optional(),
  period: budgetPeriodEnum.optional(),
  periodStartDay: z.number().int().min(1).max(28).optional(),
  alertAtPercent: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const BudgetSnapshotSchema = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  limitAmount: z.number(),
  spentAmount: z.number(),
  transactionCount: z.number(),
  wasOverBudget: z.boolean(),
});

export type Budget = z.infer<typeof BudgetSchema>;
export type CreateBudget = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudget = z.infer<typeof UpdateBudgetSchema>;
export type BudgetSnapshot = z.infer<typeof BudgetSnapshotSchema>;
