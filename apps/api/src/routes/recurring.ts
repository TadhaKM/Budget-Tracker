import type { FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';

export async function recurringRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /recurring — list active recurring payments
  app.get('/', async (request) => {
    const { frequency, isActive } = request.query as {
      frequency?: string;
      isActive?: string;
    };

    const recurring = await app.prisma.recurringPayment.findMany({
      where: {
        userId: request.userId,
        isActive: isActive !== 'false',
        isDismissed: false,
        ...(frequency && { frequency }),
      },
      include: { merchant: { select: { id: true, name: true, logoUrl: true } } },
      orderBy: { averageAmount: 'desc' },
    });

    const monthlyTotal = recurring
      .filter((r) => r.frequency === 'MONTHLY')
      .reduce((sum, r) => sum + Math.abs(Number(r.averageAmount)), 0);

    const yearlyEstimate = recurring.reduce((sum, r) => {
      const multiplier =
        r.frequency === 'WEEKLY' ? 52 :
        r.frequency === 'FORTNIGHTLY' ? 26 :
        r.frequency === 'MONTHLY' ? 12 :
        r.frequency === 'QUARTERLY' ? 4 : 1;
      return sum + Math.abs(Number(r.averageAmount)) * multiplier;
    }, 0);

    return {
      data: recurring,
      summary: {
        monthlyTotal: Math.round(monthlyTotal * 100) / 100,
        yearlyEstimate: Math.round(yearlyEstimate * 100) / 100,
        activeCount: recurring.length,
      },
    };
  });

  // GET /recurring/:id — detail
  app.get('/:id', async (request) => {
    const { id } = parseIdParam(request.params);
    const recurring = await app.prisma.recurringPayment.findFirst({
      where: { id, userId: request.userId },
      include: { merchant: true },
    });
    if (!recurring) throw new AppError(404, 'NOT_FOUND', 'Recurring payment not found');
    return recurring;
  });

  // PATCH /recurring/:id/dismiss — dismiss a false positive
  app.patch('/:id/dismiss', async (request) => {
    const { id } = parseIdParam(request.params);
    const recurring = await app.prisma.recurringPayment.findFirst({
      where: { id, userId: request.userId },
    });
    if (!recurring) throw new AppError(404, 'NOT_FOUND', 'Recurring payment not found');

    await app.prisma.recurringPayment.update({
      where: { id },
      data: { isDismissed: true },
    });
    return { success: true };
  });
}
