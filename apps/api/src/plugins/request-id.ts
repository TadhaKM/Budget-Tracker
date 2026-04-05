/**
 * Request ID plugin.
 *
 * Generates a unique request ID for every incoming request and attaches it
 * to the response headers. If the client sends X-Request-ID, we use it.
 * The ID is available via request.id for structured logging.
 */

import fp from 'fastify-plugin';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export const requestIdPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request, reply) => {
    const clientId = request.headers['x-request-id'] as string | undefined;
    const requestId = clientId ?? crypto.randomUUID();

    // Fastify uses request.id for log child bindings
    (request as unknown as Record<string, unknown>).id = requestId;
    reply.header('x-request-id', requestId);
  });
});
