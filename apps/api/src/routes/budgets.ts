import type { FastifyInstance } from 'fastify';
import { CreateBudgetSchema, UpdateBudgetSchema } from '@clearmoney/shared';

export async function budgetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /budgets — list all active budgets with current spend
  app.get('/', async (request) => {
    const budgets = await app.prisma.budget.findMany({
      where: { userId: request.userId, isActive: true },
    });
    return { budgets };
  });

  // POST /budgets — create a new budget
  app.post('/', async (request) => {
    const data = CreateBudgetSchema.parse(request.body);
    const budget = await app.prisma.budget.create({
      data: { ...data, userId: request.userId },
    });
    return budget;
  });

  // PATCH /budgets/:id — update a budget
  app.patch('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const data = UpdateBudgetSchema.parse(request.body);
    const budget = await app.prisma.budget.update({ where: { id }, data });
    return budget;
  });

  // DELETE /budgets/:id — deactivate a budget
  app.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };
    await app.prisma.budget.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true };
  });

  // GET /budgets/:id/history — budget performance history
  app.get('/:id/history', async (request) => {
    const { id } = request.params as { id: string };
    const snapshots = await app.prisma.budgetSnapshot.findMany({
      where: { budgetId: id, userId: request.userId },
      orderBy: { periodStart: 'desc' },
      take: 12,
    });
    return { snapshots };
  });
}
