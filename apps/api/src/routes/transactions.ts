import type { FastifyInstance } from 'fastify';
import { TransactionListRequestSchema } from '@clearmoney/shared';

export async function transactionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /transactions — paginated, filterable transaction list
  app.get('/', async (request) => {
    const params = TransactionListRequestSchema.parse(request.query);

    const transactions = await app.prisma.transaction.findMany({
      where: {
        account: { userId: request.userId },
        ...(params.accountId && { accountId: params.accountId }),
        ...(params.category && { category: params.category }),
      },
      orderBy: { timestamp: 'desc' },
      take: params.limit,
    });

    return { transactions, nextCursor: null };
  });

  // PATCH /transactions/:id/category — re-categorise a transaction
  app.patch('/:id/category', async (request) => {
    const { id } = request.params as { id: string };
    const { category } = request.body as { category: string };

    const transaction = await app.prisma.transaction.update({
      where: { id },
      data: { category },
    });

    return transaction;
  });
}
