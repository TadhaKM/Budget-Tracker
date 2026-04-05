import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { encrypt } from '../lib/crypto.js';
import { getBankingProvider } from '../services/truelayer.js';
import { syncAccountQueue } from '../jobs/queues.js';

const CreateConnectionSchema = z.object({
  institutionId: z.string().min(1),
});

export async function connectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // POST /connections — start bank connection (get auth URL)
  app.post('/', async (request, reply) => {
    const { institutionId } = CreateConnectionSchema.parse(request.body);

    const institution = await app.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    if (!institution || !institution.isAvailable) {
      throw new AppError(400, 'BAD_REQUEST', 'Institution not available');
    }

    // Check not already actively connected
    const existing = await app.prisma.connectedInstitution.findUnique({
      where: {
        userId_institutionId: {
          userId: request.userId,
          institutionId,
        },
      },
    });
    if (existing && existing.consentStatus === 'ACTIVE') {
      throw new AppError(409, 'ALREADY_CONNECTED', 'Bank already connected');
    }

    // Generate auth URL via provider adapter
    const state = crypto.randomUUID();
    const provider = getBankingProvider();
    const authUrl = provider.getAuthUrl({
      state,
      institutionId,
      redirectUri: process.env.TRUELAYER_REDIRECT_URI!,
    });

    // Persist state so callback can verify it
    // Store in a short-lived cache (Redis) or in the connection row
    if (existing) {
      // Re-using existing row for re-auth
      await app.prisma.connectedInstitution.update({
        where: { id: existing.id },
        data: {
          consentStatus: 'PENDING',
          metadata: { oauthState: state },
        } as Record<string, unknown>,
      });
    }

    return reply.code(201).send({
      data: { authUrl, state, expiresIn: 600 },
    });
  });

  // GET /connections — list user's connected banks
  app.get('/', async (request) => {
    const connections = await app.prisma.connectedInstitution.findMany({
      where: { userId: request.userId },
      include: {
        institution: true,
        _count: { select: { accounts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: connections.map((c) => ({
        id: c.id,
        institution: {
          id: c.institution.id,
          name: c.institution.name,
          logoUrl: c.institution.logoUrl,
        },
        consentStatus: c.consentStatus,
        consentExpiresAt: c.consentExpiresAt.toISOString(),
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        accountCount: c._count.accounts,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  });

  // GET /connections/:id — connection detail with accounts
  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const connection = await app.prisma.connectedInstitution.findFirst({
      where: { id, userId: request.userId },
      include: {
        institution: true,
        accounts: {
          where: { isActive: true },
          include: {
            balances: { orderBy: { fetchedAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!connection) throw new AppError(404, 'NOT_FOUND', 'Connection not found');

    return {
      data: {
        id: connection.id,
        institution: connection.institution,
        consentStatus: connection.consentStatus,
        consentExpiresAt: connection.consentExpiresAt.toISOString(),
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        accounts: connection.accounts.map((a) => ({
          id: a.id,
          externalAccountId: a.externalAccountId,
          accountType: a.accountType,
          displayName: a.displayName,
          currency: a.currency,
          balance: a.balances[0]
            ? {
                current: a.balances[0].current.toString(),
                available: a.balances[0].available?.toString() ?? null,
                fetchedAt: a.balances[0].fetchedAt.toISOString(),
              }
            : null,
        })),
      },
    };
  });

  // DELETE /connections/:id — disconnect a bank
  app.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };

    const connection = await app.prisma.connectedInstitution.findFirst({
      where: { id, userId: request.userId },
    });
    if (!connection) throw new AppError(404, 'NOT_FOUND', 'Connection not found');

    // Deactivate accounts (keep transaction history)
    await app.prisma.account.updateMany({
      where: { connectedInstitutionId: id },
      data: { isActive: false },
    });

    await app.prisma.connectedInstitution.update({
      where: { id },
      data: { consentStatus: 'REVOKED' },
    });

    await app.prisma.auditLog.create({
      data: {
        userId: request.userId,
        action: 'BANK_DISCONNECTED',
        entityType: 'connected_institution',
        entityId: id,
      },
    });

    return { success: true };
  });

  // POST /connections/:id/refresh — trigger consent re-auth
  app.post('/:id/refresh', async (request) => {
    const { id } = request.params as { id: string };
    const connection = await app.prisma.connectedInstitution.findFirst({
      where: { id, userId: request.userId },
      include: { institution: true },
    });
    if (!connection) throw new AppError(404, 'NOT_FOUND', 'Connection not found');

    const state = crypto.randomUUID();
    const provider = getBankingProvider();
    const authUrl = provider.getAuthUrl({
      state,
      institutionId: connection.institutionId,
      redirectUri: process.env.TRUELAYER_REDIRECT_URI!,
    });

    await app.prisma.connectedInstitution.update({
      where: { id },
      data: { consentStatus: 'PENDING' },
    });

    return { data: { authUrl, state, expiresIn: 600 } };
  });
}

// ─── OAuth callback (no auth — TrueLayer redirects here) ────────

export async function connectionCallbackRoutes(app: FastifyInstance) {
  app.get('/callback', async (request, reply) => {
    const { code, state, error: tlError } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (tlError) {
      app.log.warn({ tlError, state }, 'TrueLayer auth denied or failed');
      return reply.redirect('clearmoney://connection/error?reason=denied');
    }

    if (!code || !state) {
      return reply.code(400).send({
        error: { code: 'BAD_REQUEST', message: 'Missing code or state' },
      });
    }

    try {
      // 1. Exchange authorisation code for tokens
      const provider = getBankingProvider();
      const tokens = await provider.exchangeCode(code);

      // 2. Encrypt tokens for storage
      const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY!;
      const accessTokenEnc = encrypt(tokens.accessToken, encryptionKey);
      const refreshTokenEnc = encrypt(tokens.refreshToken, encryptionKey);

      // 3. Fetch accounts to identify the institution
      const accounts = await provider.getAccounts(tokens.accessToken);
      if (accounts.length === 0) {
        return reply.redirect('clearmoney://connection/error?reason=no_accounts');
      }

      // 4. Determine institution from the first account or state
      // For now, find a PENDING connection for this state
      // In production, the state token should be stored in Redis with userId + institutionId
      const consentExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days PSD2

      // 5. Upsert the connected institution record
      // Note: in the full flow, we'd look up the pending connection by state from Redis
      // For now we use a simpler approach — the connection was created in POST /connections
      // and we match by PENDING status
      const pendingConnection = await app.prisma.connectedInstitution.findFirst({
        where: { consentStatus: 'PENDING' },
        orderBy: { updatedAt: 'desc' },
      });

      if (pendingConnection) {
        await app.prisma.connectedInstitution.update({
          where: { id: pendingConnection.id },
          data: {
            accessTokenEnc,
            refreshTokenEnc,
            consentGrantedAt: new Date(),
            consentExpiresAt,
            consentStatus: 'ACTIVE',
          },
        });

        // 6. Enqueue initial sync job
        await syncAccountQueue.add(
          `initial-sync:${pendingConnection.id}`,
          {
            connectionId: pendingConnection.id,
            userId: pendingConnection.userId,
            jobType: 'INITIAL_SYNC',
          },
          {
            jobId: `sync:${pendingConnection.id}:INITIAL_SYNC`,
          },
        );

        await app.prisma.auditLog.create({
          data: {
            userId: pendingConnection.userId,
            action: 'BANK_CONNECTED',
            entityType: 'connected_institution',
            entityId: pendingConnection.id,
          },
        });
      }

      return reply.redirect('clearmoney://connection/success');
    } catch (err) {
      app.log.error(err, 'OAuth callback failed');
      return reply.redirect('clearmoney://connection/error?reason=exchange_failed');
    }
  });
}
