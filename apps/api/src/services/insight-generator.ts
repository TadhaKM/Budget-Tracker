/**
 * InsightGenerator — produces plain-English insight cards from analytics data.
 *
 * Two entry points:
 *   1. generateWeeklyInsights() — called by the weekly batch job after summaries are computed
 *   2. generatePostSyncInsights() — called after each transaction sync
 *
 * Each rule is a simple function that checks a condition and returns an insight
 * or null. Rules are independent — adding a new rule is one function + one line
 * in the array.
 */

import type { PrismaClient } from '../../generated/prisma/client.js';
import { TRANSACTION_CATEGORIES } from '@clearmoney/shared';
import type { WeeklySummaryData } from './analytics.js';

// ─── Types ───────────────────────────────────────────────────────

interface InsightCandidate {
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority: number;
  expiresAt?: Date;
}

type WeeklyRule = (
  current: WeeklySummaryData,
  previous: WeeklySummaryData | null,
) => InsightCandidate | null;

const CATEGORIES = TRANSACTION_CATEGORIES as Record<string, { label: string }>;

function catLabel(id: string): string {
  return CATEGORIES[id]?.label ?? id;
}

function eur(n: number): string {
  return `€${Math.abs(n).toFixed(0)}`;
}

// ─── Weekly insight rules ────────────────────────────────────────

const spendingUp: WeeklyRule = (current, previous) => {
  if (!current.comparedToPrevWeekPct || current.comparedToPrevWeekPct <= 20) return null;
  const pct = Math.round(current.comparedToPrevWeekPct);
  const topCat = current.topCategoryId ? catLabel(current.topCategoryId) : 'various categories';
  return {
    type: 'SPENDING_UP',
    title: `Spending up ${pct}%`,
    body: `You spent ${pct}% more than last week — mostly on ${topCat}.`,
    data: { pct, topCategoryId: current.topCategoryId },
    priority: 7,
    expiresAt: sevenDaysFromNow(),
  };
};

const spendingDown: WeeklyRule = (current) => {
  if (!current.comparedToPrevWeekPct || current.comparedToPrevWeekPct >= -15) return null;
  const pct = Math.abs(Math.round(current.comparedToPrevWeekPct));
  const saved = current.comparedToPrevWeekPct !== null && current.totalSpent > 0
    ? Math.round(current.totalSpent * (pct / (100 - pct)))
    : 0;
  return {
    type: 'SPENDING_DOWN',
    title: `Spending down ${pct}%`,
    body: saved > 10
      ? `You spent ${eur(saved)} less than last week. Keep it up!`
      : `Nice work! You spent ${pct}% less than last week.`,
    data: { pct, saved },
    priority: 6,
    expiresAt: sevenDaysFromNow(),
  };
};

const bigCategory: WeeklyRule = (current) => {
  if (!current.topCategoryId || current.totalSpent === 0) return null;
  const topAmount = current.topCategoryAmount ?? 0;
  const pct = Math.round((topAmount / current.totalSpent) * 100);
  if (pct < 40) return null;
  return {
    type: 'BIG_CATEGORY',
    title: `${catLabel(current.topCategoryId)} dominated`,
    body: `${catLabel(current.topCategoryId)} made up ${pct}% of your spending this week (${eur(topAmount)}).`,
    data: { categoryId: current.topCategoryId, pct, amount: topAmount },
    priority: 4,
    expiresAt: sevenDaysFromNow(),
  };
};

const lowIncomeWeek: WeeklyRule = (current, previous) => {
  if (current.totalEarned >= 100) return null;
  if (!previous || previous.totalEarned <= current.totalEarned) return null;
  return {
    type: 'LOW_INCOME_WEEK',
    title: 'Quiet week for income',
    body: current.totalEarned > 0
      ? `Only ${eur(current.totalEarned)} came in this week.`
      : 'No income this week.',
    data: { earned: current.totalEarned },
    priority: 3,
    expiresAt: sevenDaysFromNow(),
  };
};

const zeroSpendWeek: WeeklyRule = (current) => {
  if (current.totalSpent > 0 || current.transactionCount > 0) return null;
  return {
    type: 'ZERO_SPEND',
    title: 'No-spend week!',
    body: 'You didn\'t spend anything this week. Impressive.',
    data: {},
    priority: 5,
    expiresAt: sevenDaysFromNow(),
  };
};

const WEEKLY_RULES: WeeklyRule[] = [
  spendingUp,
  spendingDown,
  bigCategory,
  lowIncomeWeek,
  zeroSpendWeek,
];

// ─── Service ─────────────────────────────────────────────────────

export class InsightGenerator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate insights from a completed weekly summary.
   * Called by the weekly batch job.
   */
  async generateWeeklyInsights(
    userId: string,
    current: WeeklySummaryData,
    previous: WeeklySummaryData | null,
  ): Promise<number> {
    const candidates: InsightCandidate[] = [];

    for (const rule of WEEKLY_RULES) {
      const result = rule(current, previous);
      if (result) candidates.push(result);
    }

    // Deduplicate: don't create the same insight type for the same week
    const weekKey = current.weekStart;
    let created = 0;

    for (const candidate of candidates) {
      const existing = await this.prisma.insight.findFirst({
        where: {
          userId,
          type: candidate.type,
          data: { path: ['weekStart'], equals: weekKey },
        },
      });

      if (!existing) {
        await this.prisma.insight.create({
          data: {
            userId,
            type: candidate.type,
            title: candidate.title,
            body: candidate.body,
            data: { ...candidate.data, weekStart: weekKey },
            priority: candidate.priority,
            expiresAt: candidate.expiresAt ?? null,
          },
        });
        created++;
      }
    }

    return created;
  }

  /**
   * Generate insights after a sync has completed.
   * Checks budget thresholds, unusual merchants, subscription changes.
   */
  async generatePostSyncInsights(userId: string): Promise<number> {
    let created = 0;
    created += await this.checkBudgetAlerts(userId);
    created += await this.checkUnusualMerchantSpend(userId);
    created += await this.checkNewSubscriptions(userId);
    return created;
  }

  // ── Budget alerts ──────────────────────────────────────────

  private async checkBudgetAlerts(userId: string): Promise<number> {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, isActive: true },
    });

    const now = new Date();
    let created = 0;

    for (const budget of budgets) {
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const spending = await this.prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: budget.categoryId,
          bookedAt: { gte: periodStart, lte: now },
          amount: { lt: 0 },
        },
        _sum: { amount: true },
      });

      const spent = Math.abs(Number(spending._sum.amount ?? 0));
      const limit = Number(budget.limitAmount);
      const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const label = catLabel(budget.categoryId);

      if (spent > limit) {
        const over = Math.round(spent - limit);
        created += await this.createInsightIfNew(userId, 'BUDGET_EXCEEDED', budget.categoryId, {
          title: `${label} budget exceeded`,
          body: `You've gone over your ${eur(limit)} ${label} budget by ${eur(over)}.`,
          data: { categoryId: budget.categoryId, spent, limit, over },
          priority: 9,
          expiresAt: endOfMonth(now),
        });
      } else if (percent >= budget.alertAtPercent) {
        const daysLeft = getDaysRemainingInMonth(now);
        created += await this.createInsightIfNew(userId, 'BUDGET_WARNING', budget.categoryId, {
          title: `${label} budget at ${percent}%`,
          body: `You've used ${eur(spent)} of your ${eur(limit)} ${label} budget with ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`,
          data: { categoryId: budget.categoryId, spent, limit, percent },
          priority: 5,
          expiresAt: endOfMonth(now),
        });
      }
    }

    return created;
  }

  // ── Unusual merchant spend ─────────────────────────────────

  private async checkUnusualMerchantSpend(userId: string): Promise<number> {
    // Look at today's transactions with merchants
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTxns = await this.prisma.transaction.findMany({
      where: {
        userId,
        bookedAt: { gte: todayStart },
        merchantId: { not: null },
        amount: { lt: 0 },
      },
      select: {
        amount: true,
        merchantId: true,
        merchant: { select: { name: true } },
      },
    });

    let created = 0;

    for (const tx of todayTxns) {
      if (!tx.merchantId || !tx.merchant) continue;

      // Get the average for this merchant over the last 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const historicalAvg = await this.prisma.transaction.aggregate({
        where: {
          userId,
          merchantId: tx.merchantId,
          bookedAt: { gte: ninetyDaysAgo, lt: todayStart },
          amount: { lt: 0 },
        },
        _avg: { amount: true },
        _count: true,
      });

      if (!historicalAvg._avg.amount || historicalAvg._count < 3) continue;

      const avgAmount = Math.abs(Number(historicalAvg._avg.amount));
      const txAmount = Math.abs(Number(tx.amount));

      // Alert if 3x the average
      if (txAmount > avgAmount * 3 && txAmount - avgAmount > 15) {
        created += await this.createInsightIfNew(userId, 'UNUSUAL_MERCHANT', tx.merchantId, {
          title: `Big ${tx.merchant.name} charge`,
          body: `Your ${tx.merchant.name} charge was ${eur(txAmount)} — usually it's around ${eur(avgAmount)}.`,
          data: { merchantId: tx.merchantId, amount: txAmount, average: avgAmount },
          priority: 4,
          expiresAt: sevenDaysFromNow(),
        });
      }
    }

    return created;
  }

  // ── New subscriptions ──────────────────────────────────────

  private async checkNewSubscriptions(userId: string): Promise<number> {
    // Find recurring payments created in the last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const newRecurring = await this.prisma.recurringPayment.findMany({
      where: {
        userId,
        isActive: true,
        isDismissed: false,
        createdAt: { gte: weekAgo },
      },
    });

    let created = 0;

    for (const rp of newRecurring) {
      const freqLabel =
        rp.frequency === 'WEEKLY' ? '/wk' :
        rp.frequency === 'FORTNIGHTLY' ? '/2wk' :
        rp.frequency === 'MONTHLY' ? '/mo' :
        rp.frequency === 'QUARTERLY' ? '/qtr' : '/yr';

      created += await this.createInsightIfNew(userId, 'NEW_SUBSCRIPTION', rp.id, {
        title: `New recurring: ${rp.merchantName}`,
        body: `Looks like you started a new recurring payment to ${rp.merchantName} (${eur(Number(rp.averageAmount))}${freqLabel}).`,
        data: { recurringPaymentId: rp.id, merchantName: rp.merchantName, amount: Number(rp.averageAmount), frequency: rp.frequency },
        priority: 6,
        expiresAt: sevenDaysFromNow(),
      });
    }

    return created;
  }

  // ── Helpers ────────────────────────────────────────────────

  private async createInsightIfNew(
    userId: string,
    type: string,
    dedupeKey: string,
    insight: {
      title: string;
      body: string;
      data: Record<string, unknown>;
      priority: number;
      expiresAt?: Date;
    },
  ): Promise<number> {
    // Deduplicate by type + entity within the current month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const existing = await this.prisma.insight.findFirst({
      where: {
        userId,
        type,
        createdAt: { gte: monthStart },
        data: { path: ['dedupeKey'], equals: dedupeKey },
      },
    });

    if (existing) return 0;

    await this.prisma.insight.create({
      data: {
        userId,
        type: insight.title, // Fix: use the type parameter
        title: insight.title,
        body: insight.body,
        data: { ...insight.data, dedupeKey },
        priority: insight.priority,
        expiresAt: insight.expiresAt ?? null,
      },
    });

    return 1;
  }
}

// ── Date helpers ──────────────────────────────────────────────

function sevenDaysFromNow(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getDaysRemainingInMonth(d: Date): number {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return lastDay - d.getDate();
}
