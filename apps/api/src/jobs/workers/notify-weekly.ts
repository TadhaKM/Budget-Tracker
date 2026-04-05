/**
 * Weekly summary batch worker.
 *
 * Runs every Monday at 03:00 UTC. For each active user:
 *   1. Compute the previous week's summary (Mon–Sun)
 *   2. Store in weekly_summaries table
 *   3. Generate plain-English insight cards
 *   4. Create a WEEKLY_DIGEST notification
 */

import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { AnalyticsEngine, type WeeklySummaryData } from '../../services/analytics.js';
import { InsightGenerator } from '../../services/insight-generator.js';

interface NotifyWeeklyJob {
  userId: string;
  /** ISO date string for the Monday of the week to summarise */
  weekStart?: string;
}

export function createNotifyWeeklyWorker(redisUrl: string) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const prisma = new PrismaClient();
  const analytics = new AnalyticsEngine(prisma);
  const insights = new InsightGenerator(prisma);

  return new Worker<NotifyWeeklyJob>(
    'notify:weekly',
    async (job: Job<NotifyWeeklyJob>) => {
      const { userId } = job.data;

      // Default: previous week (Monday to Sunday)
      const now = new Date();
      let weekStart: Date;
      if (job.data.weekStart) {
        weekStart = new Date(job.data.weekStart);
      } else {
        weekStart = getMonday(now);
        weekStart.setDate(weekStart.getDate() - 7); // previous Monday
      }

      job.log(`Computing weekly summary for user ${userId}, week of ${weekStart.toISOString().split('T')[0]}`);

      // 1. Compute and store the summary
      await analytics.computeAndStoreWeeklySummary(userId, weekStart);

      // 2. Load current and previous summaries for insight generation
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);

      const [current, previous] = await Promise.all([
        prisma.weeklySummary.findUnique({
          where: { userId_weekStart: { userId, weekStart } },
        }),
        prisma.weeklySummary.findUnique({
          where: { userId_weekStart: { userId, weekStart: prevWeekStart } },
        }),
      ]);

      if (!current) {
        job.log('No summary data — skipping insights');
        return;
      }

      // Map DB row to WeeklySummaryData
      const currentData = mapToSummaryData(current);
      const previousData = previous ? mapToSummaryData(previous) : null;

      // 3. Generate insight cards
      const insightCount = await insights.generateWeeklyInsights(userId, currentData, previousData);
      job.log(`Generated ${insightCount} insight(s)`);

      // 4. Create digest notification
      const spent = Number(current.totalSpent);
      const earned = Number(current.totalEarned);
      const changeText = current.comparedToPrevWeekPct
        ? ` (${Number(current.comparedToPrevWeekPct) > 0 ? '+' : ''}${Number(current.comparedToPrevWeekPct)}% vs last week)`
        : '';

      await prisma.notification.create({
        data: {
          userId,
          type: 'WEEKLY_DIGEST',
          title: 'Your weekly summary is ready',
          body: `You spent €${spent.toFixed(0)} and earned €${earned.toFixed(0)} this week${changeText}.`,
          data: {
            weekStart: weekStart.toISOString().split('T')[0],
            totalSpent: spent,
            totalEarned: earned,
          },
          channel: 'PUSH',
        },
      });

      job.log('Weekly digest complete');
    },
    {
      connection,
      concurrency: 3,
    },
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function mapToSummaryData(row: {
  weekStart: Date;
  weekEnd: Date;
  totalSpent: unknown;
  totalEarned: unknown;
  netFlow: unknown;
  transactionCount: number;
  topCategoryId: string | null;
  topCategoryAmount: unknown;
  categoryBreakdown: unknown;
  comparedToPrevWeekPct: unknown;
}): WeeklySummaryData {
  return {
    weekStart: row.weekStart.toISOString().split('T')[0],
    weekEnd: row.weekEnd.toISOString().split('T')[0],
    totalSpent: Number(row.totalSpent),
    totalEarned: Number(row.totalEarned),
    netFlow: Number(row.netFlow),
    transactionCount: row.transactionCount,
    topCategoryId: row.topCategoryId,
    topCategoryAmount: row.topCategoryAmount ? Number(row.topCategoryAmount) : null,
    categoryBreakdown: (row.categoryBreakdown ?? {}) as Record<string, number>,
    comparedToPrevWeekPct: row.comparedToPrevWeekPct ? Number(row.comparedToPrevWeekPct) : null,
  };
}
