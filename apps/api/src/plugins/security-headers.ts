/**
 * Security headers plugin.
 *
 * Adds baseline HTTP security headers to all responses.
 * Replaces the need for @fastify/helmet with zero dependencies.
 */

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

export const securityHeadersPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '0'); // Modern browsers: CSP replaces this
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    reply.header('X-Download-Options', 'noopen');

    // Strict Transport Security — only in production with HTTPS
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });
});
