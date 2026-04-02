import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

interface NotifyBudgetJob {
  userId: string;
  category: string;
  spentAmount: number;
  limitAmount: number;
}

export function createNotifyBudgetWorker(redisUrl: string) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  return new Worker<NotifyBudgetJob>(
    'notify:budget',
    async (job: Job<NotifyBudgetJob>) => {
      const { userId, category, spentAmount, limitAmount } = job.data;
      const percent = Math.round((spentAmount / limitAmount) * 100);
      console.log(`Budget alert for user ${userId}: ${category} at ${percent}%`);
      // TODO: Send push notification
    },
    { connection, concurrency: 3 },
  );
}
