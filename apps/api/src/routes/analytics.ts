import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AnalyticsEngine } from '../services/analytics.js';

const DateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const engine = new AnalyticsEngine(app.prisma);

  // GET /analytics/dashboard — single call for the home screen
  // Returns: currentWeek, monthToDate, fixedVsFlexible, topMerchants,
  //          budgets, insights, upcomingBills
  app.get('/dashboard', async (request) => {
    const dashboard = await engine.getDashboard(request.userId);
    return { data: dashboard };
  });

  // GET /analytics/weekly — last 12 pre-computed weekly summaries
  app.get('/weekly', async (request) => {
    const summaries = await app.prisma.weeklySummary.findMany({
      where: { userId: request.userId },
      orderBy: { weekStart: 'desc' },
      take: 12,
    });
    return { data: summaries };
  });

  // GET /analytics/weekly/current — current week (live computation)
  app.get('/weekly/current', async (request) => {
    const data = await engine.computeCurrentWeek(request.userId, new Date());
    return { data };
  });

  // GET /analytics/categories — spending by category for a date range
  app.get('/categories', async (request) => {
    const { from, to } = DateRangeSchema.parse(request.query);

    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = to ? new Date(to) : now;

    const transactions = await app.prisma.transaction.findMany({
      where: {
        userId: request.userId,
        bookedAt: { gte: fromDate, lte: toDate },
        amount: { lt: 0 }, // expenses only
      },
      select: { amount: true, categoryId: true },
    });

    const categoryTotals: Record<string, { amount: number; count: number }> = {};
    let totalSpent = 0;

    for (const txn of transactions) {
      const amount = Math.abs(Number(txn.amount));
      totalSpent += amount;
      const entry = categoryTotals[txn.categoryId] ?? { amount: 0, count: 0 };
      entry.amount += amount;
      entry.count += 1;
      categoryTotals[txn.categoryId] = entry;
    }

    const categories = Object.entries(categoryTotals)
      .map(([categoryId, { amount, count }]) => ({
        categoryId,
        amount: Math.round(amount * 100) / 100,
        percent: totalSpent > 0 ? Math.round((amount / totalSpent) * 1000) / 10 : 0,
        transactionCount: count,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      data: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
        totalSpent: Math.round(totalSpent * 100) / 100,
        categories,
      },
    };
  });

  // GET /analytics/merchants — top merchants for a date range
  app.get('/merchants', async (request) => {
    const { from, to } = DateRangeSchema.parse(request.query);

    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = to ? new Date(to) : now;

    // Reuse the engine but scoped to the date range
    const transactions = await app.prisma.transaction.findMany({
      where: {
        userId: request.userId,
        bookedAt: { gte: fromDate, lte: toDate },
        amount: { lt: 0 },
        merchantId: { not: null },
      },
      select: {
        amount: true,
        merchant: { select: { name: true, logoUrl: true } },
      },
    });

    const merchantMap = new Map<string, { amount: number; count: number; logoUrl: string | null }>();

    for (const tx of transactions) {
      if (!tx.merchant) continue;
      const name = tx.merchant.name;
      const entry = merchantMap.get(name) ?? { amount: 0, count: 0, logoUrl: tx.merchant.logoUrl };
      entry.amount += Math.abs(Number(tx.amount));
      entry.count += 1;
      merchantMap.set(name, entry);
    }

    const merchants = Array.from(merchantMap.entries())
      .map(([name, data]) => ({
        name,
        amount: Math.round(data.amount * 100) / 100,
        count: data.count,
        logoUrl: data.logoUrl,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return {
      data: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
        merchants,
      },
    };
  });

  // GET /analytics/fixed-vs-flexible — current month breakdown
  app.get('/fixed-vs-flexible', async (request) => {
    const data = await engine.computeFixedVsFlexible(request.userId, new Date());
    return { data };
  });
}
