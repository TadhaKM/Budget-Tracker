import type { FastifyInstance } from 'fastify';

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
    });

    return {
      accounts: accounts.map((a) => ({
        ...a,
        balance: a.balances[0] ?? null,
        institution: a.connectedInstitution.institution,
        balances: undefined,
        connectedInstitution: undefined,
      })),
    };
  });

  // POST /accounts/:id/sync — trigger a manual sync for one account
  app.post('/:id/sync', async (request) => {
    const { id } = request.params as { id: string };
    // TODO: Enqueue sync:account job via BullMQ
    return { message: 'Sync queued', accountId: id };
  });
}
