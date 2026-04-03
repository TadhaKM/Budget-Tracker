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

export const MerchantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  defaultCategoryId: categoryEnum,
  isSubscription: z.boolean(),
});

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: z.number(),
  currency: z.string(),
  description: z.string(),
  merchantId: z.string().uuid().nullable(),
  merchant: MerchantSchema.nullable(),
  categoryId: categoryEnum,
  isPending: z.boolean(),
  bookedAt: z.string().datetime(),
});

export const TransactionListRequestSchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: categoryEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const TransactionListResponseSchema = z.object({
  transactions: z.array(TransactionSchema),
  nextCursor: z.string().nullable(),
});

export const UpdateTransactionCategorySchema = z.object({
  categoryId: categoryEnum,
});

export type Merchant = z.infer<typeof MerchantSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionListRequest = z.infer<typeof TransactionListRequestSchema>;
export type TransactionListResponse = z.infer<typeof TransactionListResponseSchema>;
export type UpdateTransactionCategory = z.infer<typeof UpdateTransactionCategorySchema>;
