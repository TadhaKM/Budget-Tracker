import type { FastifyInstance } from 'fastify';

export async function accountRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /accounts — list all connected accounts
  app.get('/', async (request) => {
    const accounts = await app.prisma.account.findMany({
      where: { userId: request.userId },
    });
    return { accounts };
  });

  // POST /accounts/:id/sync — trigger a manual sync for one account
  app.post('/:id/sync', async (request) => {
    const { id } = request.params as { id: string };
    // TODO: Enqueue sync:account job via BullMQ
    return { message: 'Sync queued', accountId: id };
  });
}
