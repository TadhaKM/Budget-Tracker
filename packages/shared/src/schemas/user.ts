import { z } from 'zod';

export const RegisterUserSchema = z.object({
  displayName: z.string().min(1).max(100).trim().optional(),
  timezone: z.string().default('Europe/Dublin'),
  currency: z.literal('EUR').default('EUR'),
});

export const UpdateUserSchema = z.object({
  displayName: z.string().min(1).max(100).trim().optional(),
  timezone: z.string().optional(),
  currency: z.literal('EUR').optional(),
});

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  timezone: z.string(),
  currency: z.string(),
  onboardedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  stats: z.object({
    connectedBanks: z.number(),
    totalAccounts: z.number(),
    transactionCount: z.number(),
  }),
});

export type RegisterUser = z.infer<typeof RegisterUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
