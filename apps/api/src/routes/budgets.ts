import type { FastifyInstance } from 'fastify';
import { CreateBudgetSchema, UpdateBudgetSchema } from '@clearmoney/shared';
import { notFound } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';

export async function budgetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /budgets — list all active budgets with current spend
  app.get('/', async (request) => {
    const budgets = await app.prisma.budget.findMany({
      where: { userId: request.userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return { data: budgets };
  });

  // POST /budgets — create a new budget
  app.post('/', async (request) => {
    const data = CreateBudgetSchema.parse(request.body);
    const budget = await app.prisma.budget.create({
      data: { ...data, userId: request.userId },
    });
    return { data: budget };
  });

  // GET /budgets/:id — single budget detail
  app.get('/:id', async (request) => {
    const { id } = parseIdParam(request.params);
    const budget = await app.prisma.budget.findUnique({ where: { id } });
    if (!budget || budget.userId !== request.userId) throw notFound('Budget not found');
    return { data: budget };
  });

  // PATCH /budgets/:id — update a budget
  app.patch('/:id', async (request) => {
    const { id } = parseIdParam(request.params);
    const existing = await app.prisma.budget.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.userId) throw notFound('Budget not found');

    const data = UpdateBudgetSchema.parse(request.body);
    const budget = await app.prisma.budget.update({ where: { id }, data });
    return { data: budget };
  });

  // DELETE /budgets/:id — deactivate a budget (soft delete)
  app.delete('/:id', async (request) => {
    const { id } = parseIdParam(request.params);
    const existing = await app.prisma.budget.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.userId) throw notFound('Budget not found');

    await app.prisma.budget.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true };
  });

  // GET /budgets/:id/history — budget performance snapshots
  app.get('/:id/history', async (request) => {
    const { id } = parseIdParam(request.params);
    const budget = await app.prisma.budget.findUnique({ where: { id } });
    if (!budget || budget.userId !== request.userId) throw notFound('Budget not found');

    const snapshots = await app.prisma.budgetSnapshot.findMany({
      where: { budgetId: id },
      orderBy: { periodStart: 'desc' },
      take: 12,
    });
    return { data: snapshots };
  });
}
