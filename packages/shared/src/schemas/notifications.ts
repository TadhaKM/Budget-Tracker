import { z } from 'zod';

export const NotificationSettingsSchema = z.object({
  weeklyDigest: z.boolean(),
  budgetAlerts: z.boolean(),
  consentExpiring: z.boolean(),
  syncFailed: z.boolean(),
  insightCards: z.boolean(),
  pushEnabled: z.boolean(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
});

export const UpdateNotificationSettingsSchema = NotificationSettingsSchema.partial();

export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
export type UpdateNotificationSettings = z.infer<typeof UpdateNotificationSettingsSchema>;
