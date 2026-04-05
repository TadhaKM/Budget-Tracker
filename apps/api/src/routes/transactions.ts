import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';

const categoryEnum = z.enum([
  'GROCERIES', 'DINING', 'TRANSPORT', 'ENTERTAINMENT', 'SHOPPING',
  'BILLS', 'HEALTH', 'SUBSCRIPTIONS', 'TRANSFERS', 'INCOME', 'ATM', 'OTHER',
]);

const TransactionQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: categoryEnum.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  isPending: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

const UpdateCategorySchema = z.object({
  categoryId: categoryEnum,
});

const SearchSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export async function transactionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /transactions — paginated, filterable feed
  app.get('/', async (request) => {
    const params = TransactionQuerySchema.parse(request.query);
    const take = params.limit;

    const where = {
      userId: request.userId,
      ...(params.accountId && { accountId: params.accountId }),
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.isPending !== undefined && { isPending: params.isPending }),
      ...((params.from || params.to) && {
        bookedAt: {
          ...(params.from && { gte: new Date(params.from) }),
          ...(params.to && { lte: new Date(params.to) }),
        },
      }),
    };

    const transactions = await app.prisma.transaction.findMany({
      where,
      include: {
        merchant: { select: { id: true, name: true, logoUrl: true } },
      },
      orderBy: [{ bookedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(params.cursor && {
        cursor: { id: params.cursor },
        skip: 1,
      }),
    });

    const hasMore = transactions.length > take;
    const data = hasMore ? transactions.slice(0, take) : transactions;

    return {
      data,
      pagination: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
      },
    };
  });

  // GET /transactions/:id — single transaction detail
  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const transaction = await app.prisma.transaction.findFirst({
      where: { id, userId: request.userId },
      include: {
        merchant: true,
        account: { select: { id: true, displayName: true, accountType: true } },
      },
    });
    if (!transaction) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    return transaction;
  });

  // PATCH /transactions/:id — re-categorise
  app.patch('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { categoryId } = UpdateCategorySchema.parse(request.body);

    // Verify ownership
    const existing = await app.prisma.transaction.findFirst({
      where: { id, userId: request.userId },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');

    const transaction = await app.prisma.transaction.update({
      where: { id },
      data: { categoryId },
      include: { merchant: { select: { id: true, name: true, logoUrl: true } } },
    });

    // Create/update merchant override for future auto-categorisation
    let merchantOverrideCreated = false;
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
      merchantOverrideCreated = true;
    }

    return { ...transaction, merchantOverrideCreated };
  });

  // GET /transactions/search — full-text search
  app.get('/search', async (request) => {
    const params = SearchSchema.parse(request.query);
    const take = params.limit;

    const transactions = await app.prisma.transaction.findMany({
      where: {
        userId: request.userId,
        OR: [
          { description: { contains: params.q, mode: 'insensitive' } },
          { merchant: { name: { contains: params.q, mode: 'insensitive' } } },
        ],
      },
      include: {
        merchant: { select: { id: true, name: true, logoUrl: true } },
      },
      orderBy: [{ bookedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(params.cursor && {
        cursor: { id: params.cursor },
        skip: 1,
      }),
    });

    const hasMore = transactions.length > take;
    const data = hasMore ? transactions.slice(0, take) : transactions;

    return {
      data,
      pagination: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
      },
    };
  });
}
