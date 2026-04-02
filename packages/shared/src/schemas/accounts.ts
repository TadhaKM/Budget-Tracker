import { z } from 'zod';

export const AccountSchema = z.object({
  id: z.string().uuid(),
  truelayerAccountId: z.string(),
  bankName: z.string(),
  accountType: z.enum(['CURRENT', 'SAVINGS', 'CREDIT_CARD']),
  balance: z.number(),
  currency: z.literal('EUR'),
  lastSynced: z.string().datetime().nullable(),
});

export const AccountListResponseSchema = z.object({
  accounts: z.array(AccountSchema),
});

export type Account = z.infer<typeof AccountSchema>;
export type AccountListResponse = z.infer<typeof AccountListResponseSchema>;
