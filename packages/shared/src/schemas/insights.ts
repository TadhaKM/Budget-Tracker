import { z } from 'zod';

export const WeeklyInsightSchema = z.object({
  weekStarting: z.string().datetime(),
  totalSpent: z.number(),
  totalEarned: z.number(),
  topCategory: z.string(),
  topCategoryAmount: z.number(),
  comparedToLastWeek: z.number(),
  budgetAlerts: z.array(
    z.object({
      category: z.string(),
      limitAmount: z.number(),
      spentAmount: z.number(),
      percentUsed: z.number(),
    }),
  ),
});

export type WeeklyInsight = z.infer<typeof WeeklyInsightSchema>;
