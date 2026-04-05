import type { FastifyInstance } from 'fastify';
import { CursorPaginationRequestSchema } from '@clearmoney/shared';
import { notFound } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';

export async function insightRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /insights — paginated insight cards for home screen
  app.get('/', async (request) => {
    const params = CursorPaginationRequestSchema.parse(request.query);
    const take = params.limit;

    const insights = await app.prisma.insight.findMany({
      where: { userId: request.userId },
      orderBy: [{ isRead: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      take: take + 1,
      ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
    });

    const hasMore = insights.length > take;
    const data = hasMore ? insights.slice(0, take) : insights;

    return {
      data,
      pagination: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
      },
    };
  });

  // PATCH /insights/:id/read — mark a single insight as read
  app.patch('/:id/read', async (request) => {
    const { id } = parseIdParam(request.params);

    const insight = await app.prisma.insight.findUnique({ where: { id } });
    if (!insight || insight.userId !== request.userId) throw notFound('Insight not found');

    await app.prisma.insight.update({
      where: { id },
      data: { isRead: true },
    });

    return { success: true };
  });

  // POST /insights/read-all — mark all insights as read
  app.post('/read-all', async (request) => {
    const { count } = await app.prisma.insight.updateMany({
      where: { userId: request.userId, isRead: false },
      data: { isRead: true },
    });

    return { updated: count };
  });
}
