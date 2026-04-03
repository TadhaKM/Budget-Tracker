import { z } from 'zod';

export const InstitutionSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  logoUrl: z.string().nullable(),
  isAvailable: z.boolean(),
});

export const AccountSchema = z.object({
  id: z.string().uuid(),
  connectedInstitutionId: z.string().uuid(),
  externalAccountId: z.string(),
  accountType: z.enum(['CURRENT', 'SAVINGS', 'CREDIT_CARD']),
  displayName: z.string(),
  currency: z.string().default('EUR'),
  isActive: z.boolean(),
});

export const BalanceSchema = z.object({
  accountId: z.string().uuid(),
  current: z.number(),
  available: z.number().nullable(),
  currency: z.string(),
  fetchedAt: z.string().datetime(),
});

export const AccountWithBalanceSchema = AccountSchema.extend({
  balance: BalanceSchema.nullable(),
  institution: InstitutionSchema.nullable(),
});

export const AccountListResponseSchema = z.object({
  accounts: z.array(AccountWithBalanceSchema),
});

export type Institution = z.infer<typeof InstitutionSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Balance = z.infer<typeof BalanceSchema>;
export type AccountWithBalance = z.infer<typeof AccountWithBalanceSchema>;
export type AccountListResponse = z.infer<typeof AccountListResponseSchema>;
