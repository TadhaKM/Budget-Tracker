import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { SyncService, type SyncJobType } from '../../services/sync.js';
import { getBankingProvider } from '../../services/truelayer.js';
import { ProviderRateLimitError } from '../../lib/banking-provider.js';

interface SyncAccountJob {
  connectionId: string;
  userId: string;
  jobType: SyncJobType;
  syncJobId?: string;
}

export function createSyncAccountWorker(redisUrl: string) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const prisma = new PrismaClient();
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY!;

  return new Worker<SyncAccountJob>(
    'sync:account',
    async (job: Job<SyncAccountJob>) => {
      const { connectionId, userId, jobType, syncJobId } = job.data;

      const provider = getBankingProvider();
      const syncService = new SyncService(prisma, provider, encryptionKey);

      job.log(`Starting ${jobType} for connection ${connectionId}`);

      const result = await syncService.syncConnection({
        connectionId,
        userId,
        jobType,
        syncJobId,
      });

      job.log(
        `Finished: ${result.status} — ${result.accountsSynced} accounts, ${result.transactionsSynced} transactions`,
      );

      if (result.status === 'FAILED') {
        throw new Error(result.error ?? 'Sync failed');
      }

      return result;
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // max 10 jobs/sec across all workers
      },
      settings: {
        backoffStrategy: (attemptsMade: number, _type: string | undefined, err: unknown) => {
          // Custom backoff: respect provider rate limit headers
          if (err instanceof ProviderRateLimitError) {
            return err.retryAfterSeconds * 1000;
          }
          // Default exponential: 5s, 25s, 125s, 625s
          return Math.min(5000 * Math.pow(5, attemptsMade - 1), 600_000);
        },
      },
    },
  );
}
