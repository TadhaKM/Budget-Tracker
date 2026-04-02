import type { FastifyInstance } from 'fastify';
import { CreateBudgetSchema, UpdateBudgetSchema } from '@clearmoney/shared';

export async function budgetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /budgets — list all budgets for the user
  app.get('/', async (request) => {
    const budgets = await app.prisma.budget.findMany({
      where: { userId: request.userId },
    });
    return { budgets };
  });

  // POST /budgets — create a new budget
  app.post('/', async (request) => {
    const data = CreateBudgetSchema.parse(request.body);
    const budget = await app.prisma.budget.create({
      data: { ...data, userId: request.userId, limitAmount: data.limitAmount },
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

  // DELETE /budgets/:id — remove a budget
  app.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };
    await app.prisma.budget.delete({ where: { id } });
    return { success: true };
  });
}
