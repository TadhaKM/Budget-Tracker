import type { FastifyInstance } from 'fastify';

export async function insightRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /insights/weekly — current and recent weekly summaries
  app.get('/weekly', async (request) => {
    const summaries = await app.prisma.weeklySummary.findMany({
      where: { userId: request.userId },
      orderBy: { weekStart: 'desc' },
      take: 12,
    });
    return { summaries };
  });

  // GET /insights/cards — unread insight cards for home screen
  app.get('/cards', async (request) => {
    const insights = await app.prisma.insight.findMany({
      where: { userId: request.userId, isRead: false },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    });
    return { insights };
  });

  // PATCH /insights/:id/read — mark an insight as read
  app.patch('/:id/read', async (request) => {
    const { id } = request.params as { id: string };
    await app.prisma.insight.update({
      where: { id },
      data: { isRead: true },
    });
    return { success: true };
  });

  // GET /insights/recurring — active recurring payments
  app.get('/recurring', async (request) => {
    const recurring = await app.prisma.recurringPayment.findMany({
      where: {
        userId: request.userId,
        isActive: true,
        isDismissed: false,
      },
      orderBy: { averageAmount: 'desc' },
    });

    const monthlyTotal = recurring
      .filter((r) => r.frequency === 'MONTHLY')
      .reduce((sum, r) => sum + Number(r.averageAmount), 0);

    return { recurring, monthlyTotal };
  });

  // PATCH /insights/recurring/:id/dismiss — dismiss a false positive
  app.patch('/recurring/:id/dismiss', async (request) => {
    const { id } = request.params as { id: string };
    await app.prisma.recurringPayment.update({
      where: { id },
      data: { isDismissed: true },
    });
    return { success: true };
  });

  // GET /insights/sync-status — latest sync info
  app.get('/sync-status', async (request) => {
    const latestJobs = await app.prisma.syncJob.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return { syncJobs: latestJobs };
  });

  // GET /insights/notifications — notification history
  app.get('/notifications', async (request) => {
    const notifications = await app.prisma.notification.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { notifications };
  });
}
