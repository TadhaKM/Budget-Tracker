import type { FastifyInstance } from 'fastify';

export async function institutionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /institutions — list available banks
  app.get('/', async () => {
    const institutions = await app.prisma.institution.findMany({
      where: { isAvailable: true },
      orderBy: { name: 'asc' },
    });
    return { data: institutions };
  });
}
