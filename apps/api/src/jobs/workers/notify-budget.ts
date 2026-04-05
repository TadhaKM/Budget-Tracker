/**
 * Budget alert worker.
 *
 * Two trigger modes:
 *   1. After each sync — check if any budgets crossed their alert threshold
 *   2. Daily at 02:00 — snapshot budgets whose period just ended
 *
 * Creates insight cards and push notifications when thresholds are hit.
 */

import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { InsightGenerator } from '../../services/insight-generator.js';

interface NotifyBudgetJob {
  userId: string;
  /** If set, only check this category. Otherwise check all budgets. */
  categoryId?: string;
  /** If 'SNAPSHOT', close out ended periods */
  mode?: 'CHECK' | 'SNAPSHOT';
}

export function createNotifyBudgetWorker(redisUrl: string) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const prisma = new PrismaClient();
  const insightGen = new InsightGenerator(prisma);

  return new Worker<NotifyBudgetJob>(
    'notify:budget',
    async (job: Job<NotifyBudgetJob>) => {
      const { userId, mode = 'CHECK' } = job.data;

      if (mode === 'SNAPSHOT') {
        await snapshotEndedPeriods(prisma, userId);
        job.log('Budget period snapshots complete');
      }

      // Always run post-sync insight checks
      const insightCount = await insightGen.generatePostSyncInsights(userId);
      job.log(`Generated ${insightCount} post-sync insight(s)`);
    },
    {
      connection,
      concurrency: 3,
    },
  );
}

/**
 * For each active budget, if the current period has ended since the last
 * snapshot, create a BudgetSnapshot row to freeze the historical data.
 */
async function snapshotEndedPeriods(prisma: PrismaClient, userId: string): Promise<void> {
  const budgets = await prisma.budget.findMany({
    where: { userId, isActive: true },
  });

  const now = new Date();

  for (const budget of budgets) {
    // Get the previous period dates
    const prevPeriod = getPreviousPeriod(budget.period, budget.periodStartDay, now);

    // Check if we already have a snapshot for this period
    const existing = await prisma.budgetSnapshot.findFirst({
      where: {
        budgetId: budget.id,
        periodStart: prevPeriod.start,
      },
    });

    if (existing) continue;

    // Compute spending for the ended period
    const spending = await prisma.transaction.aggregate({
      where: {
        userId,
        categoryId: budget.categoryId,
        bookedAt: { gte: prevPeriod.start, lte: prevPeriod.end },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
      _count: true,
    });

    const spentAmount = Math.abs(Number(spending._sum.amount ?? 0));
    const limitAmount = Number(budget.limitAmount);

    await prisma.budgetSnapshot.create({
      data: {
        budgetId: budget.id,
        userId,
        periodStart: prevPeriod.start,
        periodEnd: prevPeriod.end,
        limitAmount,
        spentAmount,
        transactionCount: spending._count,
        wasOverBudget: spentAmount > limitAmount,
      },
    });
  }
}

function getPreviousPeriod(
  period: string,
  periodStartDay: number,
  now: Date,
): { start: Date; end: Date } {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === 'MONTHLY') {
    // Previous calendar month (using periodStartDay)
    const startDay = Math.min(periodStartDay, 28);
    const prevMonthStart = new Date(year, month - 1, startDay, 0, 0, 0, 0);
    const prevMonthEnd = new Date(year, month, startDay, 0, 0, 0, 0);
    prevMonthEnd.setMilliseconds(-1);
    return { start: prevMonthStart, end: prevMonthEnd };
  }

  if (period === 'WEEKLY') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    const prevSunday = new Date(monday);
    prevSunday.setMilliseconds(-1);
    return { start: prevMonday, end: prevSunday };
  }

  // Default: previous calendar month
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}
