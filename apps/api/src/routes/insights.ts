import type { FastifyInstance } from 'fastify';

export async function insightRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /insights/weekly — weekly spending summary
  app.get('/weekly', async (request) => {
    // TODO: Compute from transactions in the current week
    return {
      weekStarting: new Date().toISOString(),
      totalSpent: 0,
      totalEarned: 0,
      topCategory: 'OTHER',
      topCategoryAmount: 0,
      comparedToLastWeek: 0,
      budgetAlerts: [],
    };
  });
}
