import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '../../../generated/prisma/client.js';
import type { WebhookEvent } from '../../lib/banking-provider.js';
import { syncAccountQueue } from '../queues.js';

interface SyncWebhookJob {
  event: WebhookEvent;
}

export function createSyncWebhookWorker(redisUrl: string) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const prisma = new PrismaClient();

  return new Worker<SyncWebhookJob>(
    'sync:webhook',
    async (job: Job<SyncWebhookJob>) => {
      const { event } = job.data;
      job.log(`Processing webhook: ${event.type}`);

      switch (event.type) {
        case 'SYNC_AVAILABLE':
          await handleSyncAvailable(prisma, event);
          break;

        case 'CONSENT_REVOKED':
          await handleConsentRevoked(prisma, event);
          break;

        case 'CONSENT_EXPIRING':
          await handleConsentExpiring(prisma, event);
          break;

        case 'ERROR':
          await handleProviderError(prisma, event);
          break;
      }

      // Audit log for every webhook event
      await prisma.auditLog.create({
        data: {
          action: `WEBHOOK_${event.type}`,
          entityType: 'webhook',
          metadata: event.metadata as Record<string, string>,
        },
      });
    },
    {
      connection,
      concurrency: 5,
    },
  );
}

// ─── Event handlers ──────────────────────────────────────────────

async function handleSyncAvailable(prisma: PrismaClient, event: WebhookEvent): Promise<void> {
  // Find the connection by external credential ID or account
  const account = event.accountExternalId
    ? await prisma.account.findUnique({
        where: { externalAccountId: event.accountExternalId },
        include: { connectedInstitution: true },
      })
    : null;

  if (!account) return;

  const conn = account.connectedInstitution;
  if (conn.consentStatus !== 'ACTIVE') return;

  // Enqueue an incremental sync (deduplicated by jobId)
  await syncAccountQueue.add(
    `webhook-sync:${conn.id}`,
    {
      connectionId: conn.id,
      userId: conn.userId,
      jobType: 'INCREMENTAL_SYNC' as const,
    },
    {
      jobId: `sync:${conn.id}:INCREMENTAL_SYNC:${new Date().toISOString().split('T')[0]}`,
      removeOnComplete: 100,
    },
  );
}

async function handleConsentRevoked(prisma: PrismaClient, event: WebhookEvent): Promise<void> {
  // Find connection by external account
  const account = event.accountExternalId
    ? await prisma.account.findUnique({
        where: { externalAccountId: event.accountExternalId },
        include: { connectedInstitution: true },
      })
    : null;

  if (!account) return;

  const conn = account.connectedInstitution;

  // Mark connection as revoked
  await prisma.connectedInstitution.update({
    where: { id: conn.id },
    data: { consentStatus: 'REVOKED' },
  });

  // Deactivate all accounts
  await prisma.account.updateMany({
    where: { connectedInstitutionId: conn.id },
    data: { isActive: false },
  });

  // Notify user
  await prisma.notification.create({
    data: {
      userId: conn.userId,
      type: 'CONSENT_REVOKED',
      title: 'Bank connection revoked',
      body: 'Your bank has revoked the connection. Please reconnect to continue syncing.',
      data: { connectionId: conn.id },
    },
  });
}

async function handleConsentExpiring(prisma: PrismaClient, event: WebhookEvent): Promise<void> {
  const account = event.accountExternalId
    ? await prisma.account.findUnique({
        where: { externalAccountId: event.accountExternalId },
        include: { connectedInstitution: { include: { institution: true } } },
      })
    : null;

  if (!account) return;

  const conn = account.connectedInstitution;

  await prisma.notification.create({
    data: {
      userId: conn.userId,
      type: 'CONSENT_EXPIRING',
      title: `${conn.institution.name} connection expiring soon`,
      body: 'Your bank connection will expire soon. Please re-authenticate to keep syncing.',
      data: { connectionId: conn.id, expiresAt: conn.consentExpiresAt.toISOString() },
    },
  });

  // Create an insight card for the home screen
  await prisma.insight.create({
    data: {
      userId: conn.userId,
      type: 'CONSENT_EXPIRING',
      title: 'Renew bank connection',
      body: `Your ${conn.institution.name} connection expires soon. Tap to renew.`,
      priority: 8, // high priority
      data: { connectionId: conn.id },
      expiresAt: conn.consentExpiresAt,
    },
  });
}

async function handleProviderError(prisma: PrismaClient, event: WebhookEvent): Promise<void> {
  // Log the error — no user-facing action unless repeated
  const account = event.accountExternalId
    ? await prisma.account.findUnique({
        where: { externalAccountId: event.accountExternalId },
        include: { connectedInstitution: true },
      })
    : null;

  if (!account) return;

  await prisma.syncJob.create({
    data: {
      userId: account.connectedInstitution.userId,
      connectedInstitutionId: account.connectedInstitution.id,
      accountId: account.id,
      jobType: 'WEBHOOK_ERROR',
      status: 'FAILED',
      errorMessage: JSON.stringify(event.metadata),
      completedAt: new Date(),
    },
  });
}
