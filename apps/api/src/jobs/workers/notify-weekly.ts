import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

interface NotifyWeeklyJob {
  userId: string;
}

export function createNotifyWeeklyWorker(redisUrl: string) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker<NotifyWeeklyJob>(
    'notify:weekly',
    async (job: Job<NotifyWeeklyJob>) => {
      console.log(`Generating weekly digest for user ${job.data.userId}`);
      // TODO: Compute weekly summary, send push notification
    },
    { connection, concurrency: 3 },
  );
}
