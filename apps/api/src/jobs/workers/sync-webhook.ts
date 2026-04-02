import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

interface SyncWebhookJob {
  webhookPayload: Record<string, unknown>;
}

export function createSyncWebhookWorker(redisUrl: string) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker<SyncWebhookJob>(
    'sync:webhook',
    async (job: Job<SyncWebhookJob>) => {
      console.log('Processing TrueLayer webhook:', job.data.webhookPayload);
      // TODO: Parse webhook, identify affected account, run delta sync
    },
    { connection, concurrency: 5 },
  );
}
