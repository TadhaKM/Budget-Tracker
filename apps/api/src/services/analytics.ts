/**
 * AnalyticsEngine — computes all financial metrics for a single user.
 *
 * Two modes:
 *   - Live queries: current week, month-to-date, category breakdown, budgets
 *   - Batch computation: weekly summaries (pre-computed on Monday for the past week)
 *
 * All monetary calculations use Math.round(x * 100) / 100 to avoid floating
 * point drift. The source data is DECIMAL(12,2) from Prisma.
 */

import type { PrismaClient } from '../../generated/prisma/client.js';
import { TRANSACTION_CATEGORIES } from '@clearmoney/shared';

// ─── Types ───────────────────────────────────────────────────────

export interface WeeklySummaryData {
  weekStart: string; // ISO date
  weekEnd: string;
  totalSpent: number;
  totalEarned: number;
  netFlow: number;
  transactionCount: number;
  topCategoryId: string | null;
  topCategoryAmount: number | null;
  categoryBreakdown: Record<string, number>;
  comparedToPrevWeekPct: number | null;
}

export interface MonthToDate {
  totalSpent: number;
  totalEarned: number;
  netFlow: number;
  daysRemaining: number;
}

export interface FixedVsFlexible {
  fixed: number;
  flexible: number;
  fixedItems: number;
}

export interface TopMerchant {
  name: string;
  amount: number;
  count: number;
  logoUrl: string | null;
}

export interface BudgetProgress {
  budgetId: string;
  categoryId: string;
  label: string;
  color: string;
  limit: number;
  spent: number;
  percent: number;
}

export interface UpcomingBill {
  name: string;
  amount: number;
  dueDate: string;
  frequency: string;
}

export interface DashboardData {
  currentWeek: WeeklySummaryData & { topCategory: { id: string; label: string; amount: number; color: string } | null };
  monthToDate: MonthToDate;
  fixedVsFlexible: FixedVsFlexible;
  topMerchants: TopMerchant[];
  budgets: BudgetProgress[];
  insights: Array<{ id: string; type: string; title: string; body: string; priority: number; isRead: boolean }>;
  upcomingBills: UpcomingBill[];
}

// ─── Helpers ─────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSunday(monday: Date): Date {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function getDaysRemaining(d: Date): number {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return lastDay - d.getDate();
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

const CATEGORIES = TRANSACTION_CATEGORIES as Record<string, { label: string; color: string }>;

// ─── Service ─────────────────────────────────────────────────────

export class AnalyticsEngine {
  constructor(private prisma: PrismaClient) {}

  // ── Dashboard (single call for home screen) ─────────────────

  async getDashboard(userId: string): Promise<DashboardData> {
    const now = new Date();

    const [currentWeek, monthToDate, fixedVsFlexible, topMerchants, budgets, insights, upcomingBills] =
      await Promise.all([
        this.computeCurrentWeek(userId, now),
        this.computeMonthToDate(userId, now),
        this.computeFixedVsFlexible(userId, now),
        this.computeTopMerchants(userId, now),
        this.computeBudgetProgress(userId, now),
        this.getUnreadInsights(userId),
        this.getUpcomingBills(userId, now),
      ]);

    const topCat = currentWeek.topCategoryId
      ? {
          id: currentWeek.topCategoryId,
          label: CATEGORIES[currentWeek.topCategoryId]?.label ?? currentWeek.topCategoryId,
          amount: currentWeek.topCategoryAmount ?? 0,
          color: CATEGORIES[currentWeek.topCategoryId]?.color ?? '#94a3b8',
        }
      : null;

    return {
      currentWeek: { ...currentWeek, topCategory: topCat },
      monthToDate,
      fixedVsFlexible,
      topMerchants,
      budgets,
      insights,
      upcomingBills,
    };
  }

  // ── Current week (live) ─────────────────────────────────────

  async computeCurrentWeek(userId: string, now: Date): Promise<WeeklySummaryData> {
    const weekStart = getMonday(now);
    const weekEnd = getSunday(weekStart);

    const transactions = await this.prisma.transaction.findMany({
      where: { userId, bookedAt: { gte: weekStart, lte: weekEnd } },
      select: { amount: true, categoryId: true },
    });

    let totalSpent = 0;
    let totalEarned = 0;
    const categoryTotals: Record<string, number> = {};

    for (const tx of transactions) {
      const amt = Number(tx.amount);
      if (amt < 0) {
        totalSpent += Math.abs(amt);
        categoryTotals[tx.categoryId] = (categoryTotals[tx.categoryId] ?? 0) + Math.abs(amt);
      } else {
        totalEarned += amt;
      }
    }

    const topEntry = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0];

    // Previous week comparison
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const prevSummary = await this.prisma.weeklySummary.findUnique({
      where: { userId_weekStart: { userId, weekStart: prevWeekStart } },
      select: { totalSpent: true },
    });

    const prevSpent = prevSummary ? Number(prevSummary.totalSpent) : null;
    const comparedToPrevWeekPct =
      prevSpent && prevSpent > 0
        ? round2(((totalSpent - prevSpent) / prevSpent) * 100)
        : null;

    return {
      weekStart: toDateStr(weekStart),
      weekEnd: toDateStr(weekEnd),
      totalSpent: round2(totalSpent),
      totalEarned: round2(totalEarned),
      netFlow: round2(totalEarned - totalSpent),
      transactionCount: transactions.length,
      topCategoryId: topEntry?.[0] ?? null,
      topCategoryAmount: topEntry ? round2(topEntry[1]) : null,
      categoryBreakdown: Object.fromEntries(
        Object.entries(categoryTotals).map(([k, v]) => [k, round2(v)]),
      ),
      comparedToPrevWeekPct,
    };
  }

  // ── Month to date (live) ────────────────────────────────────

  async computeMonthToDate(userId: string, now: Date): Promise<MonthToDate> {
    const monthStart = getMonthStart(now);

    const transactions = await this.prisma.transaction.findMany({
      where: { userId, bookedAt: { gte: monthStart, lte: now } },
      select: { amount: true },
    });

    let totalSpent = 0;
    let totalEarned = 0;

    for (const tx of transactions) {
      const amt = Number(tx.amount);
      if (amt < 0) totalSpent += Math.abs(amt);
      else totalEarned += amt;
    }

    return {
      totalSpent: round2(totalSpent),
      totalEarned: round2(totalEarned),
      netFlow: round2(totalEarned - totalSpent),
      daysRemaining: getDaysRemaining(now),
    };
  }

  // ── Fixed vs flexible (live + pre-computed recurring) ───────

  async computeFixedVsFlexible(userId: string, now: Date): Promise<FixedVsFlexible> {
    const monthStart = getMonthStart(now);

    const [recurring, monthTransactions] = await Promise.all([
      this.prisma.recurringPayment.findMany({
        where: { userId, isActive: true, isDismissed: false },
      }),
      this.prisma.transaction.findMany({
        where: { userId, bookedAt: { gte: monthStart, lte: now }, amount: { lt: 0 } },
        select: { amount: true },
      }),
    ]);

    // Convert recurring to monthly equivalent
    let fixedMonthly = 0;
    for (const rp of recurring) {
      const amt = Math.abs(Number(rp.averageAmount));
      const multiplier =
        rp.frequency === 'WEEKLY' ? 4.33 :
        rp.frequency === 'FORTNIGHTLY' ? 2.17 :
        rp.frequency === 'MONTHLY' ? 1 :
        rp.frequency === 'QUARTERLY' ? 0.33 :
        rp.frequency === 'YEARLY' ? 0.083 : 1;
      fixedMonthly += amt * multiplier;
    }

    const totalSpent = monthTransactions.reduce(
      (sum, tx) => sum + Math.abs(Number(tx.amount)),
      0,
    );

    // Fixed can't exceed total spent (pro-rate for partial months)
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const proRatedFixed = Math.min(fixedMonthly * (dayOfMonth / daysInMonth), totalSpent);

    return {
      fixed: round2(proRatedFixed),
      flexible: round2(Math.max(totalSpent - proRatedFixed, 0)),
      fixedItems: recurring.length,
    };
  }

  // ── Top merchants (live) ────────────────────────────────────

  async computeTopMerchants(userId: string, now: Date, limit = 5): Promise<TopMerchant[]> {
    const monthStart = getMonthStart(now);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        bookedAt: { gte: monthStart, lte: now },
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

    return Array.from(merchantMap.entries())
      .map(([name, data]) => ({
        name,
        amount: round2(data.amount),
        count: data.count,
        logoUrl: data.logoUrl,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  // ── Budget progress (live) ──────────────────────────────────

  async computeBudgetProgress(userId: string, now: Date): Promise<BudgetProgress[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, isActive: true },
    });

    if (budgets.length === 0) return [];

    const results: BudgetProgress[] = [];

    for (const budget of budgets) {
      const periodDates = this.getBudgetPeriodDates(budget.period, budget.periodStartDay, now);

      const spending = await this.prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: budget.categoryId,
          bookedAt: { gte: periodDates.start, lte: periodDates.end },
          amount: { lt: 0 },
        },
        _sum: { amount: true },
      });

      const spent = Math.abs(Number(spending._sum.amount ?? 0));
      const limit = Number(budget.limitAmount);

      results.push({
        budgetId: budget.id,
        categoryId: budget.categoryId,
        label: CATEGORIES[budget.categoryId]?.label ?? budget.categoryId,
        color: CATEGORIES[budget.categoryId]?.color ?? '#94a3b8',
        limit: round2(limit),
        spent: round2(spent),
        percent: limit > 0 ? Math.round((spent / limit) * 100) : 0,
      });
    }

    return results.sort((a, b) => b.percent - a.percent);
  }

  // ── Insights (pre-computed, just fetch) ─────────────────────

  private async getUnreadInsights(userId: string) {
    const insights = await this.prisma.insight.findMany({
      where: {
        userId,
        isRead: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      select: { id: true, type: true, title: true, body: true, priority: true, isRead: true },
    });
    return insights;
  }

  // ── Upcoming bills (from recurring_payments) ────────────────

  private async getUpcomingBills(userId: string, now: Date): Promise<UpcomingBill[]> {
    const twoWeeksFromNow = new Date(now);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    const bills = await this.prisma.recurringPayment.findMany({
      where: {
        userId,
        isActive: true,
        isDismissed: false,
        nextExpectedAt: { gte: now, lte: twoWeeksFromNow },
      },
      orderBy: { nextExpectedAt: 'asc' },
      take: 5,
    });

    return bills.map((b) => ({
      name: b.merchantName,
      amount: round2(Math.abs(Number(b.averageAmount))),
      dueDate: b.nextExpectedAt ? toDateStr(b.nextExpectedAt) : '',
      frequency: b.frequency,
    }));
  }

  // ── Batch: compute and store a weekly summary ───────────────

  async computeAndStoreWeeklySummary(userId: string, weekStart: Date): Promise<void> {
    const data = await this.computeCurrentWeek(userId, weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    await this.prisma.weeklySummary.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: {
        userId,
        weekStart,
        weekEnd,
        totalSpent: data.totalSpent,
        totalEarned: data.totalEarned,
        netFlow: data.netFlow,
        transactionCount: data.transactionCount,
        topCategoryId: data.topCategoryId,
        topCategoryAmount: data.topCategoryAmount,
        categoryBreakdown: data.categoryBreakdown,
        comparedToPrevWeekPct: data.comparedToPrevWeekPct,
      },
      update: {
        totalSpent: data.totalSpent,
        totalEarned: data.totalEarned,
        netFlow: data.netFlow,
        transactionCount: data.transactionCount,
        topCategoryId: data.topCategoryId,
        topCategoryAmount: data.topCategoryAmount,
        categoryBreakdown: data.categoryBreakdown,
        comparedToPrevWeekPct: data.comparedToPrevWeekPct,
      },
    });
  }

  // ── Budget period calculation ───────────────────────────────

  private getBudgetPeriodDates(
    period: string,
    periodStartDay: number,
    now: Date,
  ): { start: Date; end: Date } {
    const year = now.getFullYear();
    const month = now.getMonth();

    if (period === 'MONTHLY') {
      const startDay = Math.min(periodStartDay, new Date(year, month + 1, 0).getDate());
      let start: Date;
      if (now.getDate() >= startDay) {
        start = new Date(year, month, startDay, 0, 0, 0, 0);
      } else {
        start = new Date(year, month - 1, startDay, 0, 0, 0, 0);
      }
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setMilliseconds(-1);
      return { start, end };
    }

    if (period === 'WEEKLY') {
      const monday = getMonday(now);
      const sunday = getSunday(monday);
      return { start: monday, end: sunday };
    }

    // Default: calendar month
    return {
      start: new Date(year, month, 1, 0, 0, 0, 0),
      end: new Date(year, month + 1, 0, 23, 59, 59, 999),
    };
  }
}
