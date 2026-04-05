/**
 * Auth plugin — JWT verification + user resolution.
 *
 * Verifies Supabase JWTs locally using the shared JWT secret (HMAC).
 * This is ~100x faster than calling supabase.auth.getUser() per request
 * and doesn't depend on Supabase being reachable.
 *
 * Decorates:
 *   - app.authenticate  (preHandler hook)
 *   - request.userId    (internal UUID, not Supabase UUID)
 */

import fp from 'fastify-plugin';
import * as jose from 'jose';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('SUPABASE_JWT_SECRET is required');
  }

  // Encode the secret for jose (Supabase uses HMAC-SHA256)
  const secret = new TextEncoder().encode(jwtSecret);

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' },
      });
    }

    const token = header.slice(7);

    // 1. Verify JWT signature and expiry locally
    let payload: jose.JWTPayload;
    try {
      const result = await jose.jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });
      payload = result.payload;
    } catch (err) {
      const message =
        err instanceof jose.errors.JWTExpired
          ? 'Token expired'
          : 'Invalid token';
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message },
      });
    }

    // 2. Extract Supabase user ID from the 'sub' claim
    const supabaseId = payload.sub;
    if (!supabaseId) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Token missing subject' },
      });
    }

    // 3. Look up our internal user by Supabase ID
    const user = await app.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    request.userId = user.id;
  });
});
