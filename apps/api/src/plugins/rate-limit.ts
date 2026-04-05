/**
 * Simple in-memory rate limiter.
 *
 * Limits per-user (or per-IP for unauthenticated routes).
 * For production with multiple API instances, swap to a Redis-backed limiter.
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX = 100;          // requests per window
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

export const rateLimitPlugin = fp(async (app: FastifyInstance) => {
  const store = new Map<string, RateLimitEntry>();

  // Cleanup stale entries every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60_000);

  app.addHook('onClose', () => clearInterval(cleanupInterval));

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip health checks
    if (request.url.startsWith('/health')) return;

    const key = (request as unknown as Record<string, unknown>).userId as string
      ?? request.ip
      ?? 'unknown';

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + DEFAULT_WINDOW_MS };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(DEFAULT_MAX - entry.count, 0);
    reply.header('x-ratelimit-limit', DEFAULT_MAX);
    reply.header('x-ratelimit-remaining', remaining);
    reply.header('x-ratelimit-reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > DEFAULT_MAX) {
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
      });
    }
  });
});
