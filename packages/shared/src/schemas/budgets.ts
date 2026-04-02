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
  category: categoryEnum,
  limitAmount: z.number().positive(),
  period: budgetPeriodEnum,
  spentAmount: z.number().default(0),
});

export const CreateBudgetSchema = z.object({
  category: categoryEnum,
  limitAmount: z.number().positive(),
  period: budgetPeriodEnum,
});

export const UpdateBudgetSchema = CreateBudgetSchema.partial();

export type Budget = z.infer<typeof BudgetSchema>;
export type CreateBudget = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudget = z.infer<typeof UpdateBudgetSchema>;
