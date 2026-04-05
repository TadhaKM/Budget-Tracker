/**
 * Worker process entry point.
 *
 * Run separately from the API server:
 *   tsx src/workers.ts
 *
 * Starts all BullMQ workers and the cron scheduler.
 * Handles graceful shutdown on SIGINT / SIGTERM.
 */

import { loadEnv } from './config/env.js';
import { createSyncAccountWorker } from './jobs/workers/sync-account.js';
import { createSyncWebhookWorker } from './jobs/workers/sync-webhook.js';
import { createNotifyWeeklyWorker } from './jobs/workers/notify-weekly.js';
import { createNotifyBudgetWorker } from './jobs/workers/notify-budget.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';
import type { Worker } from 'bullmq';

const env = loadEnv();
const workers: Worker[] = [];

async function start() {
  console.log('[workers] Starting worker processes...');

  workers.push(
    createSyncAccountWorker(env.REDIS_URL),
    createSyncWebhookWorker(env.REDIS_URL),
    createNotifyWeeklyWorker(env.REDIS_URL),
    createNotifyBudgetWorker(env.REDIS_URL),
  );

  // Start the cron scheduler (enqueues recurring jobs)
  await startScheduler(env.REDIS_URL);

  console.log(`[workers] ${workers.length} workers running, scheduler active`);
}

async function shutdown(signal: string) {
  console.log(`[workers] ${signal} received — shutting down gracefully...`);

  // Stop accepting new jobs, finish current ones
  const closePromises = workers.map((w) =>
    w.close().catch((err) => console.error(`[workers] Error closing ${w.name}:`, err)),
  );

  await stopScheduler();
  await Promise.allSettled(closePromises);

  console.log('[workers] All workers stopped');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  console.error('[workers] Fatal startup error:', err);
  process.exit(1);
});
