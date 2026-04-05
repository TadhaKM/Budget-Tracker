import type { FastifyInstance } from 'fastify';

export async function syncRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /sync/status — latest sync jobs
  app.get('/status', async (request) => {
    const jobs = await app.prisma.syncJob.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const lastSuccessful = jobs.find((j) => j.status === 'COMPLETED');
    const activeSyncs = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'PENDING');

    return {
      data: jobs,
      summary: {
        lastSuccessfulSync: lastSuccessful?.completedAt?.toISOString() ?? null,
        activeSyncs: activeSyncs.length,
        hasErrors: jobs.some((j) => j.status === 'FAILED'),
      },
    };
  });
}
