import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.get('/ready', async () => {
    await app.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  });
}
