import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { syncAccountQueue } from '../jobs/queues.js';

const AccountParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function accountRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /accounts — list all connected accounts with latest balance
  app.get('/', async (request) => {
    const accounts = await app.prisma.account.findMany({
      where: { userId: request.userId, isActive: true },
      include: {
        balances: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
        },
        connectedInstitution: {
          include: { institution: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      data: accounts.map((a) => ({
        id: a.id,
        bankName: a.connectedInstitution.institution.name,
        bankLogoUrl: a.connectedInstitution.institution.logoUrl,
        accountName: a.displayName,
        accountType: a.accountType,
        currency: a.currency,
        balance: a.balances[0]
          ? Number(a.balances[0].current)
          : 0,
        availableBalance: a.balances[0]?.available
          ? Number(a.balances[0].available)
          : null,
        lastSyncedAt: a.connectedInstitution.lastSyncedAt?.toISOString() ?? null,
        connectionId: a.connectedInstitutionId,
        isActive: a.isActive,
      })),
    };
  });

  // GET /accounts/:id — single account with balance
  app.get('/:id', async (request) => {
    const { id } = AccountParamsSchema.parse(request.params);

    const account = await app.prisma.account.findFirst({
      where: { id, userId: request.userId },
      include: {
        balances: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        connectedInstitution: {
          include: { institution: true },
        },
      },
    });

    if (!account) throw new AppError(404, 'NOT_FOUND', 'Account not found');

    return {
      data: {
        id: account.id,
        bankName: account.connectedInstitution.institution.name,
        bankLogoUrl: account.connectedInstitution.institution.logoUrl,
        accountName: account.displayName,
        accountType: account.accountType,
        currency: account.currency,
        balance: account.balances[0] ? Number(account.balances[0].current) : 0,
        availableBalance: account.balances[0]?.available
          ? Number(account.balances[0].available)
          : null,
        lastSyncedAt: account.connectedInstitution.lastSyncedAt?.toISOString() ?? null,
        connectionId: account.connectedInstitutionId,
        isActive: account.isActive,
      },
    };
  });

  // POST /accounts/:id/sync — trigger a manual sync for one account
  app.post('/:id/sync', async (request) => {
    const { id } = AccountParamsSchema.parse(request.params);

    const account = await app.prisma.account.findFirst({
      where: { id, userId: request.userId, isActive: true },
      select: { id: true, connectedInstitutionId: true },
    });
    if (!account) throw new AppError(404, 'NOT_FOUND', 'Account not found');

    await syncAccountQueue.add(
      `manual-sync:${account.connectedInstitutionId}`,
      {
        connectionId: account.connectedInstitutionId,
        userId: request.userId,
        jobType: 'INCREMENTAL_SYNC',
      },
      {
        jobId: `sync:${account.connectedInstitutionId}:manual:${Date.now()}`,
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    return { data: { message: 'Sync queued', accountId: id } };
  });
}
