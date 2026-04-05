/**
 * Cron-based job scheduler.
 *
 * Uses BullMQ's built-in repeatable jobs to enqueue:
 *  - Weekly summary generation (Monday 03:00 UTC)
 *  - Budget snapshot + alerts (daily 02:00 UTC)
 *  - Incremental sync for all active connections (every 4 hours)
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '../../generated/prisma/client.js';

let connection: IORedis | null = null;
let syncQueue: Queue | null = null;
let weeklyQueue: Queue | null = null;
let budgetQueue: Queue | null = null;
let prisma: PrismaClient | null = null;

// Interval ID for the active-user sync scheduler
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

export async function startScheduler(redisUrl: string) {
  connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  prisma = new PrismaClient();

  syncQueue = new Queue('sync:account', { connection });
  weeklyQueue = new Queue('notify:weekly', { connection });
  budgetQueue = new Queue('notify:budget', { connection });

  // ── Weekly summary: Monday 03:00 UTC ──────────────────────────
  await weeklyQueue.upsertJobScheduler(
    'weekly-summary-scheduler',
    { pattern: '0 3 * * 1' }, // cron: Mon 03:00
    {
      name: 'weekly-summary-batch',
      data: { batch: true },
    },
  );
  console.log('[scheduler] Weekly summary: Monday 03:00 UTC');

  // ── Budget alerts: daily 02:00 UTC ────────────────────────────
  await budgetQueue.upsertJobScheduler(
    'budget-alert-scheduler',
    { pattern: '0 2 * * *' }, // cron: daily 02:00
    {
      name: 'budget-alert-batch',
      data: { mode: 'SNAPSHOT' },
    },
  );
  console.log('[scheduler] Budget alerts: daily 02:00 UTC');

  // ── Incremental sync: every 4 hours ───────────────────────────
  // We enqueue one job per active connection. Use a setInterval to
  // query active connections and enqueue sync jobs.
  await enqueueSyncJobs();
  syncIntervalId = setInterval(enqueueSyncJobs, 4 * 60 * 60 * 1000);
  console.log('[scheduler] Incremental sync: every 4 hours');
}

async function enqueueSyncJobs() {
  if (!prisma || !syncQueue) return;

  try {
    const activeConnections = await prisma.connectedInstitution.findMany({
      where: { consentStatus: 'ACTIVE' },
      select: { id: true, userId: true },
    });

    for (const conn of activeConnections) {
      await syncQueue.add(
        `scheduled-sync:${conn.id}`,
        {
          connectionId: conn.id,
          userId: conn.userId,
          jobType: 'INCREMENTAL_SYNC',
        },
        {
          jobId: `sync:${conn.id}:scheduled:${Date.now()}`,
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      );
    }

    if (activeConnections.length > 0) {
      console.log(`[scheduler] Enqueued ${activeConnections.length} incremental sync jobs`);
    }
  } catch (err) {
    console.error('[scheduler] Failed to enqueue sync jobs:', err);
  }
}

export async function stopScheduler() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }

  const queues = [syncQueue, weeklyQueue, budgetQueue].filter(Boolean) as Queue[];
  await Promise.allSettled(queues.map((q) => q.close()));

  if (connection) {
    connection.disconnect();
    connection = null;
  }

  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }

  console.log('[scheduler] Stopped');
}
