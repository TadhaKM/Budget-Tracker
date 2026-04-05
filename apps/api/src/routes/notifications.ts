import type { FastifyInstance } from 'fastify';
import { UpdateNotificationSettingsSchema } from '@clearmoney/shared';
import { AppError } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /notifications — notification history
  app.get('/', async (request) => {
    const { isRead, type, limit, cursor } = request.query as {
      isRead?: string;
      type?: string;
      limit?: string;
      cursor?: string;
    };

    const take = Math.min(Math.max(parseInt(limit ?? '20', 10) || 20, 1), 100);

    const notifications = await app.prisma.notification.findMany({
      where: {
        userId: request.userId,
        ...(isRead !== undefined && { readAt: isRead === 'true' ? { not: null } : null }),
        ...(type && { type }),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1, // fetch one extra to determine hasMore
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const hasMore = notifications.length > take;
    const data = hasMore ? notifications.slice(0, take) : notifications;

    return {
      data,
      pagination: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
      },
    };
  });

  // PATCH /notifications/:id/read — mark one as read
  app.patch('/:id/read', async (request) => {
    const { id } = parseIdParam(request.params);
    const notification = await app.prisma.notification.findFirst({
      where: { id, userId: request.userId },
    });
    if (!notification) throw new AppError(404, 'NOT_FOUND', 'Notification not found');

    await app.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { success: true };
  });

  // POST /notifications/read-all — mark all as read
  app.post('/read-all', async (request) => {
    const { count } = await app.prisma.notification.updateMany({
      where: { userId: request.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, markedRead: count };
  });

  // GET /notifications/settings — get notification preferences
  app.get('/settings', async (request) => {
    // TODO: Store in a notification_settings table or as JSONB on users
    // For now, return defaults
    return {
      weeklyDigest: true,
      budgetAlerts: true,
      consentExpiring: true,
      syncFailed: false,
      insightCards: true,
      pushEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };
  });

  // PATCH /notifications/settings — update preferences
  app.patch('/settings', async (request) => {
    const _input = UpdateNotificationSettingsSchema.parse(request.body);
    // TODO: Persist to notification_settings table or user JSONB
    return {
      weeklyDigest: true,
      budgetAlerts: true,
      consentExpiring: true,
      syncFailed: false,
      insightCards: true,
      pushEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };
  });
}
