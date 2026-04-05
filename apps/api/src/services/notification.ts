/**
 * NotificationService — manages notification creation and delivery.
 *
 * Centralises notification logic so workers and services don't need
 * to construct notifications inline.
 */

import type { PrismaClient } from '../../generated/prisma/client.js';

type NotificationType =
  | 'WEEKLY_DIGEST'
  | 'BUDGET_WARNING'
  | 'BUDGET_EXCEEDED'
  | 'CONSENT_EXPIRED'
  | 'CONSENT_EXPIRING'
  | 'SYNC_FAILED'
  | 'NEW_SUBSCRIPTION'
  | 'GENERAL';

type Channel = 'PUSH' | 'IN_APP' | 'EMAIL';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channel?: Channel;
}

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as Record<string, string>,
        channel: input.channel ?? 'PUSH',
      },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) return null;

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return count;
  }

  // ── Convenience builders ──────────────────────────────────────

  async sendBudgetWarning(userId: string, categoryLabel: string, percent: number) {
    return this.create({
      userId,
      type: 'BUDGET_WARNING',
      title: `${categoryLabel} budget at ${percent}%`,
      body: `You've used ${percent}% of your ${categoryLabel.toLowerCase()} budget this month.`,
      data: { percent },
    });
  }

  async sendBudgetExceeded(userId: string, categoryLabel: string, overAmount: number) {
    return this.create({
      userId,
      type: 'BUDGET_EXCEEDED',
      title: `${categoryLabel} budget exceeded`,
      body: `You're €${overAmount.toFixed(2)} over your ${categoryLabel.toLowerCase()} budget.`,
      data: { overAmount },
    });
  }

  async sendConsentExpiring(userId: string, bankName: string, connectionId: string, daysLeft: number) {
    return this.create({
      userId,
      type: 'CONSENT_EXPIRING',
      title: `${bankName} connection expiring`,
      body: `Your ${bankName} connection expires in ${daysLeft} days. Please re-authenticate to keep syncing.`,
      data: { connectionId, daysLeft },
    });
  }

  async sendSyncFailed(userId: string, bankName: string, errorMessage: string) {
    return this.create({
      userId,
      type: 'SYNC_FAILED',
      title: `${bankName} sync failed`,
      body: errorMessage,
      channel: 'IN_APP',
    });
  }
}
