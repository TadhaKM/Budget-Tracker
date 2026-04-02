import { z } from 'zod';

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

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: z.number(),
  currency: z.string(),
  description: z.string(),
  merchantName: z.string().nullable(),
  category: categoryEnum,
  timestamp: z.string().datetime(),
});

export const TransactionListRequestSchema = z.object({
  accountId: z.string().uuid().optional(),
  category: categoryEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const TransactionListResponseSchema = z.object({
  transactions: z.array(TransactionSchema),
  nextCursor: z.string().nullable(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionListRequest = z.infer<typeof TransactionListRequestSchema>;
export type TransactionListResponse = z.infer<typeof TransactionListResponseSchema>;
