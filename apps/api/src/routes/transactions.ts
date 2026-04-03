import type { FastifyInstance } from 'fastify';
import { TransactionListRequestSchema } from '@clearmoney/shared';

export async function transactionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /transactions — paginated, filterable transaction feed
  app.get('/', async (request) => {
    const params = TransactionListRequestSchema.parse(request.query);

    const transactions = await app.prisma.transaction.findMany({
      where: {
        userId: request.userId,
        ...(params.accountId && { accountId: params.accountId }),
        ...(params.categoryId && { categoryId: params.categoryId }),
      },
      include: {
        merchant: true,
      },
      orderBy: { bookedAt: 'desc' },
      take: params.limit,
    });

    return { transactions, nextCursor: null };
  });

  // PATCH /transactions/:id/category — re-categorise a transaction
  app.patch('/:id/category', async (request) => {
    const { id } = request.params as { id: string };
    const { categoryId } = request.body as { categoryId: string };

    const transaction = await app.prisma.transaction.update({
      where: { id },
      data: { categoryId },
    });

    // If merchant is known, create/update a merchant override for this user
    if (transaction.merchantId) {
      await app.prisma.merchantOverride.upsert({
        where: {
          userId_merchantId: {
            userId: request.userId,
            merchantId: transaction.merchantId,
          },
        },
        create: {
          userId: request.userId,
          merchantId: transaction.merchantId,
          categoryId,
        },
        update: { categoryId },
      });
    }

    return transaction;
  });
}
