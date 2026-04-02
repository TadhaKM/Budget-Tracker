import type { FastifyInstance } from 'fastify';

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/truelayer/link — generate TrueLayer consent URL
  app.post('/truelayer/link', {
    preHandler: [app.authenticate],
  }, async (request) => {
    // TODO: Generate TrueLayer auth URL with user-specific state
    return { authUrl: 'https://auth.truelayer-sandbox.com/...' };
  });

  // GET /auth/truelayer/callback — handle TrueLayer OAuth callback
  app.get('/truelayer/callback', async (request, reply) => {
    // TODO: Exchange code for tokens, store encrypted, trigger initial sync
    return { success: true };
  });
}
