import { z } from 'zod';

export const WeeklySummarySchema = z.object({
  id: z.string().uuid(),
  weekStart: z.string(),
  weekEnd: z.string(),
  totalSpent: z.number(),
  totalEarned: z.number(),
  netFlow: z.number(),
  transactionCount: z.number(),
  topCategoryId: z.string().nullable(),
  topCategoryAmount: z.number().nullable(),
  categoryBreakdown: z.record(z.string(), z.number()),
  comparedToPrevWeekPct: z.number().nullable(),
});

export const InsightSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'WEEKLY_DIGEST',
    'BUDGET_WARNING',
    'UNUSUAL_SPEND',
    'SUBSCRIPTION_NEW',
    'SUBSCRIPTION_INCREASE',
  ]),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()),
  priority: z.number(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
});

export const RecurringPaymentSchema = z.object({
  id: z.string().uuid(),
  merchantName: z.string(),
  merchantId: z.string().uuid().nullable(),
  averageAmount: z.number(),
  currency: z.string(),
  frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  categoryId: z.string(),
  occurrenceCount: z.number(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  nextExpectedAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
  isDismissed: z.boolean(),
});

export const SyncJobSchema = z.object({
  id: z.string().uuid(),
  jobType: z.enum([
    'INITIAL_SYNC',
    'INCREMENTAL_SYNC',
    'WEBHOOK_SYNC',
    'TOKEN_REFRESH',
    'BALANCE_UPDATE',
  ]),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING']),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
  transactionsSynced: z.number(),
  createdAt: z.string().datetime(),
});

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'WEEKLY_DIGEST',
    'BUDGET_ALERT',
    'CONSENT_EXPIRING',
    'SYNC_FAILED',
    'INSIGHT',
  ]),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()),
  channel: z.enum(['PUSH', 'IN_APP', 'EMAIL']),
  sentAt: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type WeeklySummary = z.infer<typeof WeeklySummarySchema>;
export type Insight = z.infer<typeof InsightSchema>;
export type RecurringPayment = z.infer<typeof RecurringPaymentSchema>;
export type SyncJob = z.infer<typeof SyncJobSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
