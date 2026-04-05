/**
 * SyncService — orchestrates data synchronisation between the open banking
 * provider and our database. Used by BullMQ workers, never called from
 * HTTP handlers directly.
 *
 * Flow per connection:
 *   1. Load connection → decrypt tokens
 *   2. Refresh access token if needed
 *   3. Fetch accounts → upsert
 *   4. For each account: fetch balance + transactions → upsert
 *   5. Update connection.lastSyncedAt + SyncJob record
 */

import type { PrismaClient } from '../../generated/prisma/client.js';
import type {
  BankingProvider,
  TransactionFetchOptions,
} from '../lib/banking-provider.js';
import {
  RefreshTokenExpiredError,
  ConsentRevokedError,
  ProviderRateLimitError,
} from '../lib/banking-provider.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { CategorisationService } from './categorisation.js';
import { RecurringDetector } from './recurring-detector.js';

// ─── Types ───────────────────────────────────────────────────────

export type SyncJobType = 'INITIAL_SYNC' | 'INCREMENTAL_SYNC' | 'BALANCE_ONLY';

interface SyncConnectionParams {
  connectionId: string;
  userId: string;
  jobType: SyncJobType;
  syncJobId?: string; // if resuming an existing SyncJob row
}

interface SyncResult {
  accountsSynced: number;
  transactionsSynced: number;
  status: 'COMPLETED' | 'FAILED' | 'CONSENT_EXPIRED';
  error?: string;
}

// ─── Service ─────────────────────────────────────────────────────

export class SyncService {
  private categoriser: CategorisationService;
  private recurringDetector: RecurringDetector;

  constructor(
    private prisma: PrismaClient,
    private provider: BankingProvider,
    private encryptionKey: string,
  ) {
    this.categoriser = new CategorisationService(prisma);
    this.recurringDetector = new RecurringDetector(prisma);
  }

  async syncConnection(params: SyncConnectionParams): Promise<SyncResult> {
    const { connectionId, userId, jobType } = params;

    // 1. Create or resume SyncJob row
    const syncJob = params.syncJobId
      ? await this.prisma.syncJob.update({
          where: { id: params.syncJobId },
          data: { status: 'RUNNING', startedAt: new Date() },
        })
      : await this.prisma.syncJob.create({
          data: {
            userId,
            connectedInstitutionId: connectionId,
            jobType,
            status: 'RUNNING',
            startedAt: new Date(),
          },
        });

    try {
      // 2. Load connection and decrypt tokens
      const connection = await this.prisma.connectedInstitution.findUniqueOrThrow({
        where: { id: connectionId },
      });

      if (connection.consentStatus === 'REVOKED' || connection.consentStatus === 'EXPIRED') {
        return this.completeSyncJob(syncJob.id, 'CONSENT_EXPIRED', 0, 0, 'Consent not active');
      }

      let accessToken = decrypt(connection.accessTokenEnc, this.encryptionKey);
      const refreshToken = decrypt(connection.refreshTokenEnc, this.encryptionKey);

      // 3. Refresh access token
      try {
        const tokens = await this.provider.refreshTokens(refreshToken);
        accessToken = tokens.accessToken;

        // Re-encrypt and store new tokens
        await this.prisma.connectedInstitution.update({
          where: { id: connectionId },
          data: {
            accessTokenEnc: encrypt(tokens.accessToken, this.encryptionKey),
            refreshTokenEnc: encrypt(tokens.refreshToken, this.encryptionKey),
          },
        });
      } catch (err) {
        if (err instanceof RefreshTokenExpiredError) {
          await this.markConsentExpired(connectionId, userId);
          return this.completeSyncJob(syncJob.id, 'CONSENT_EXPIRED', 0, 0, err.message);
        }
        throw err;
      }

      // 4. Warm categorisation caches (merchants + user overrides)
      await this.categoriser.warmCache(userId);

      // 5. Fetch and upsert accounts
      let accountsSynced = 0;
      let transactionsSynced = 0;

      if (jobType !== 'BALANCE_ONLY') {
        const providerAccounts = await this.provider.getAccounts(accessToken);

        for (const pa of providerAccounts) {
          await this.prisma.account.upsert({
            where: { externalAccountId: pa.externalId },
            create: {
              userId,
              connectedInstitutionId: connectionId,
              externalAccountId: pa.externalId,
              accountType: pa.accountType,
              displayName: pa.displayName,
              currency: pa.currency,
              isActive: true,
            },
            update: {
              displayName: pa.displayName,
              accountType: pa.accountType,
              isActive: true,
            },
          });
          accountsSynced++;
        }

        // Deactivate accounts no longer returned by provider
        const externalIds = providerAccounts.map((a) => a.externalId);
        await this.prisma.account.updateMany({
          where: {
            connectedInstitutionId: connectionId,
            externalAccountId: { notIn: externalIds },
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      // 5. For each active account: sync balance + transactions
      const accounts = await this.prisma.account.findMany({
        where: { connectedInstitutionId: connectionId, isActive: true },
      });

      for (const account of accounts) {
        // Balance sync (always)
        try {
          const balance = await this.provider.getBalance(accessToken, account.externalAccountId);
          await this.prisma.balance.create({
            data: {
              accountId: account.id,
              current: balance.current,
              available: balance.available ?? null,
              currency: balance.currency,
              fetchedAt: new Date(balance.updatedAt),
            },
          });
        } catch (err) {
          // Balance failures are non-fatal — log and continue
          console.error(`Balance sync failed for account ${account.id}:`, err);
        }

        // Transaction sync (skip for BALANCE_ONLY)
        if (jobType !== 'BALANCE_ONLY') {
          try {
            const txCount = await this.syncTransactions(
              accessToken,
              account,
              userId,
              connection.lastSyncedAt,
              jobType,
            );
            transactionsSynced += txCount;
          } catch (err) {
            // Per-account transaction failure is non-fatal
            console.error(`Transaction sync failed for account ${account.id}:`, err);
          }
        }
      }

      // 7. Update connection timestamp
      await this.prisma.connectedInstitution.update({
        where: { id: connectionId },
        data: { lastSyncedAt: new Date() },
      });

      // 8. Detect recurring payments (post-processing)
      if (jobType !== 'BALANCE_ONLY') {
        try {
          await this.recurringDetector.detect(userId);
        } catch (err) {
          // Non-fatal — recurring detection failure shouldn't fail the sync
          console.error('Recurring payment detection failed:', err);
        }
      }

      return this.completeSyncJob(syncJob.id, 'COMPLETED', accountsSynced, transactionsSynced);
    } catch (err) {
      // Handle consent errors at the top level
      if (err instanceof ConsentRevokedError) {
        await this.markConsentExpired(connectionId, userId);
        return this.completeSyncJob(syncJob.id, 'CONSENT_EXPIRED', 0, 0, err.message);
      }

      // Rate limit — let BullMQ retry with delay
      if (err instanceof ProviderRateLimitError) {
        const errorMsg = `Rate limited — retry after ${err.retryAfterSeconds}s`;
        await this.prisma.syncJob.update({
          where: { id: syncJob.id },
          data: { status: 'PENDING', errorMessage: errorMsg },
        });
        throw err; // re-throw so BullMQ applies backoff
      }

      // All other errors
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return this.completeSyncJob(syncJob.id, 'FAILED', 0, 0, errorMsg);
    }
  }

  // ── Transaction sync (with categorisation pipeline) ─────────────

  private async syncTransactions(
    accessToken: string,
    account: { id: string; externalAccountId: string },
    userId: string,
    lastSyncedAt: Date | null,
    jobType: SyncJobType,
  ): Promise<number> {
    const now = new Date();
    const options: TransactionFetchOptions = {
      from:
        jobType === 'INITIAL_SYNC' || !lastSyncedAt
          ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : lastSyncedAt.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };

    const transactions = await this.provider.getTransactions(
      accessToken,
      account.externalAccountId,
      options,
    );

    let synced = 0;
    for (const tx of transactions) {
      // Run through the categorisation pipeline (in-memory, no DB calls)
      const result = this.categoriser.categorise({
        description: tx.description,
        amount: tx.amount,
        currency: tx.currency,
        merchantName: tx.merchantName,
        isPending: tx.isPending,
      });

      await this.prisma.transaction.upsert({
        where: { externalTransactionId: tx.externalId },
        create: {
          accountId: account.id,
          userId,
          externalTransactionId: tx.externalId,
          amount: tx.amount,
          currency: tx.currency,
          description: result.cleanMerchantName ?? tx.description,
          merchantId: result.merchantId,
          categoryId: result.categoryId,
          isPending: tx.isPending,
          bookedAt: new Date(tx.bookedAt),
        },
        update: {
          // Only update mutable fields — don't overwrite user's category overrides
          amount: tx.amount,
          isPending: tx.isPending,
        },
      });
      synced++;
    }
    return synced;
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async completeSyncJob(
    syncJobId: string,
    status: 'COMPLETED' | 'FAILED' | 'CONSENT_EXPIRED',
    accountsSynced: number,
    transactionsSynced: number,
    errorMessage?: string,
  ): Promise<SyncResult> {
    await this.prisma.syncJob.update({
      where: { id: syncJobId },
      data: {
        status,
        completedAt: new Date(),
        transactionsSynced,
        errorMessage: errorMessage ?? null,
        metadata: { accountsSynced },
      },
    });
    return {
      accountsSynced,
      transactionsSynced,
      status,
      error: errorMessage,
    };
  }

  private async markConsentExpired(connectionId: string, userId: string): Promise<void> {
    await this.prisma.connectedInstitution.update({
      where: { id: connectionId },
      data: { consentStatus: 'EXPIRED' },
    });

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'CONSENT_EXPIRED',
        title: 'Bank connection expired',
        body: 'Your bank connection needs to be renewed. Please re-authenticate to continue syncing.',
        data: { connectionId },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CONSENT_EXPIRED',
        entityType: 'connected_institution',
        entityId: connectionId,
      },
    });
  }
}
