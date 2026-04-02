import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export const syncAccountQueue = new Queue('sync:account', {
  connection: getConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const syncWebhookQueue = new Queue('sync:webhook', {
  connection: getConnection(),
});

export const notifyWeeklyQueue = new Queue('notify:weekly', {
  connection: getConnection(),
});

export const notifyBudgetQueue = new Queue('notify:budget', {
  connection: getConnection(),
});
