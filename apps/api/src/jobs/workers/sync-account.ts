import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

interface SyncAccountJob {
  userId: string;
  accountId: string;
}

export function createSyncAccountWorker(redisUrl: string) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker<SyncAccountJob>(
    'sync:account',
    async (job: Job<SyncAccountJob>) => {
      const { userId, accountId } = job.data;
      console.log(`Syncing account ${accountId} for user ${userId}`);
      // TODO: Call syncAccountData(userId, accountId)
    },
    { connection, concurrency: 5 },
  );
}
