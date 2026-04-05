import type { FastifyInstance } from 'fastify';

export async function categoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /categories — list all categories
  app.get('/', async () => {
    const categories = await app.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return { data: categories };
  });
}
