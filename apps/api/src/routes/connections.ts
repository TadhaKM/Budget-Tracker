/**
 * Connection routes — bank linking via TrueLayer OAuth.
 *
 * Flow:
 *   1. POST /connections         → creates/reuses ConnectedInstitution row (PENDING),
 *                                  stores state in Redis, returns authUrl
 *   2. GET  /connections/callback → TrueLayer redirects here after consent,
 *                                  validates state from Redis, exchanges code,
 *                                  encrypts tokens, enqueues initial sync
 *   3. GET  /connections         → list user's connected banks
 *   4. GET  /connections/:id     → connection detail with accounts
 *   5. DELETE /connections/:id   → revoke connection (keep tx history)
 *   6. POST /connections/:id/refresh → re-auth expired consent
 */

import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';
import { encrypt } from '../lib/crypto.js';
import { storeOAuthState, consumeOAuthState } from '../lib/oauth-state.js';
import { getBankingProvider } from '../services/truelayer.js';
import { syncAccountQueue } from '../jobs/queues.js';

const CreateConnectionSchema = z.object({
  institutionId: z.string().min(1),
});

export async function connectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ── POST /connections — initiate bank link ───────────────────
  app.post('/', async (request, reply) => {
    const { institutionId } = CreateConnectionSchema.parse(request.body);

    // Validate institution exists and is available
    const institution = await app.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    if (!institution || !institution.isAvailable) {
      throw new AppError(400, 'BAD_REQUEST', 'Institution not available');
    }

    // Check for existing connection
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

    // Generate cryptographic state for CSRF protection
    const state = crypto.randomUUID();
    const provider = getBankingProvider();
    const authUrl = provider.getAuthUrl({
      state,
      institutionId,
      redirectUri: process.env.TRUELAYER_REDIRECT_URI!,
    });

    let connectionId: string;

    if (existing) {
      // Re-use existing row for re-auth (EXPIRED / REVOKED / FAILED → PENDING)
      await app.prisma.connectedInstitution.update({
        where: { id: existing.id },
        data: { consentStatus: 'PENDING' },
      });
      connectionId = existing.id;
    } else {
      // First time connecting this institution — create the row
      const created = await app.prisma.connectedInstitution.create({
        data: {
          userId: request.userId,
          institutionId,
          consentStatus: 'PENDING',
          consentExpiresAt: new Date(0), // placeholder until consent granted
        },
      });
      connectionId = created.id;
    }

    // Store state → {userId, institutionId, connectionId} in Redis with 10min TTL
    await storeOAuthState(state, {
      userId: request.userId,
      institutionId,
      connectionId,
    });

    await app.prisma.auditLog.create({
      data: {
        userId: request.userId,
        action: 'BANK_LINK_INITIATED',
        entityType: 'connected_institution',
        entityId: connectionId,
      },
    });

    return reply.code(201).send({
      data: { authUrl, state, connectionId, expiresIn: 600 },
    });
  });

  // ── GET /connections — list connected banks ──────────────────
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

  // ── GET /connections/:id — detail with accounts ──────────────
  app.get('/:id', async (request) => {
    const { id } = parseIdParam(request.params);
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

  // ── DELETE /connections/:id — disconnect bank ────────────────
  app.delete('/:id', async (request) => {
    const { id } = parseIdParam(request.params);

    const connection = await app.prisma.connectedInstitution.findFirst({
      where: { id, userId: request.userId },
    });
    if (!connection) throw new AppError(404, 'NOT_FOUND', 'Connection not found');

    // Deactivate accounts but preserve transaction history
    await app.prisma.account.updateMany({
      where: { connectedInstitutionId: id },
      data: { isActive: false },
    });

    await app.prisma.connectedInstitution.update({
      where: { id },
      data: {
        consentStatus: 'REVOKED',
        accessTokenEnc: null,
        refreshTokenEnc: null,
      },
    });

    await app.prisma.auditLog.create({
      data: {
        userId: request.userId,
        action: 'BANK_DISCONNECTED',
        entityType: 'connected_institution',
        entityId: id,
      },
    });

    return { data: { success: true } };
  });

  // ── POST /connections/:id/refresh — re-auth expired consent ──
  app.post('/:id/refresh', async (request, reply) => {
    const { id } = parseIdParam(request.params);
    const connection = await app.prisma.connectedInstitution.findFirst({
      where: { id, userId: request.userId },
      include: { institution: true },
    });
    if (!connection) throw new AppError(404, 'NOT_FOUND', 'Connection not found');

    if (connection.consentStatus === 'ACTIVE') {
      throw new AppError(400, 'BAD_REQUEST', 'Connection is still active — no refresh needed');
    }

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

    await storeOAuthState(state, {
      userId: request.userId,
      institutionId: connection.institutionId,
      connectionId: id,
    });

    return reply.code(200).send({
      data: { authUrl, state, expiresIn: 600 },
    });
  });
}

// ─── OAuth callback (unauthenticated — TrueLayer redirects here) ──

export async function connectionCallbackRoutes(app: FastifyInstance) {
  const CallbackQuerySchema = z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
  });

  app.get('/callback', async (request, reply) => {
    const query = CallbackQuerySchema.parse(request.query);

    // ── Handle denial / cancellation ────────────────────────────
    if (query.error) {
      app.log.warn({ error: query.error, state: query.state }, 'TrueLayer auth denied or failed');

      // If we have a state, mark the connection as failed
      if (query.state) {
        const payload = await consumeOAuthState(query.state);
        if (payload) {
          await app.prisma.connectedInstitution.update({
            where: { id: payload.connectionId },
            data: { consentStatus: 'FAILED' },
          });
          await app.prisma.auditLog.create({
            data: {
              userId: payload.userId,
              action: 'BANK_LINK_DENIED',
              entityType: 'connected_institution',
              entityId: payload.connectionId,
            },
          });
        }
      }

      const reason = query.error === 'access_denied' ? 'denied' : 'failed';
      return reply.redirect(`clearmoney://connection/error?reason=${reason}`);
    }

    // ── Validate required params ────────────────────────────────
    if (!query.code || !query.state) {
      return reply.code(400).send({
        error: { code: 'BAD_REQUEST', message: 'Missing code or state parameter' },
      });
    }

    // ── Validate state from Redis (CSRF + flow binding) ─────────
    const payload = await consumeOAuthState(query.state);
    if (!payload) {
      app.log.warn({ state: query.state }, 'Invalid or expired OAuth state');
      return reply.redirect('clearmoney://connection/error?reason=expired');
    }

    const { userId, connectionId } = payload;

    try {
      // 1. Exchange authorisation code for tokens
      const provider = getBankingProvider();
      const tokens = await provider.exchangeCode(query.code);

      // 2. Encrypt tokens for at-rest storage (AES-256-GCM)
      const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY!;
      const accessTokenEnc = encrypt(tokens.accessToken, encryptionKey);
      const refreshTokenEnc = encrypt(tokens.refreshToken, encryptionKey);

      // 3. PSD2 consent validity — 90 days from grant
      const consentExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      // 4. Activate the connection with encrypted tokens
      await app.prisma.connectedInstitution.update({
        where: { id: connectionId },
        data: {
          accessTokenEnc,
          refreshTokenEnc,
          consentGrantedAt: new Date(),
          consentExpiresAt,
          consentStatus: 'ACTIVE',
        },
      });

      // 5. Enqueue initial sync (fetches accounts, balances, transactions)
      await syncAccountQueue.add(
        `initial-sync:${connectionId}`,
        {
          connectionId,
          userId,
          jobType: 'INITIAL_SYNC',
        },
        {
          jobId: `sync:${connectionId}:initial:${Date.now()}`,
        },
      );

      // 6. Audit trail
      await app.prisma.auditLog.create({
        data: {
          userId,
          action: 'BANK_CONNECTED',
          entityType: 'connected_institution',
          entityId: connectionId,
        },
      });

      app.log.info({ connectionId, userId }, 'Bank connection activated');
      return reply.redirect('clearmoney://connection/success');
    } catch (err) {
      app.log.error(err, 'OAuth callback token exchange failed');

      // Mark connection as failed so user can retry
      await app.prisma.connectedInstitution.update({
        where: { id: connectionId },
        data: { consentStatus: 'FAILED' },
      });

      await app.prisma.auditLog.create({
        data: {
          userId,
          action: 'BANK_LINK_FAILED',
          entityType: 'connected_institution',
          entityId: connectionId,
        },
      });

      return reply.redirect('clearmoney://connection/error?reason=exchange_failed');
    }
  });
}
