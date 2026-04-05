import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadEnv } from './config/env.js';
import { prismaPlugin } from './plugins/prisma.js';
import { authPlugin } from './plugins/auth.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { requestIdPlugin } from './plugins/request-id.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { securityHeadersPlugin } from './plugins/security-headers.js';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhooks.js';
import { connectionCallbackRoutes } from './routes/connections.js';
import { authRoutes } from './routes/auth.js';
import { institutionRoutes } from './routes/institutions.js';
import { connectionRoutes } from './routes/connections.js';
import { accountRoutes } from './routes/accounts.js';
import { transactionRoutes } from './routes/transactions.js';
import { budgetRoutes } from './routes/budgets.js';
import { recurringRoutes } from './routes/recurring.js';
import { analyticsRoutes } from './routes/analytics.js';
import { insightRoutes } from './routes/insights.js';
import { notificationRoutes } from './routes/notifications.js';
import { syncRoutes } from './routes/sync.js';
import { categoryRoutes } from './routes/categories.js';
import { createBankingProvider } from './services/truelayer.js';

export async function buildApp() {
  const env = loadEnv();

  // Initialise banking provider adapter (singleton)
  createBankingProvider({
    clientId: env.TRUELAYER_CLIENT_ID,
    clientSecret: env.TRUELAYER_CLIENT_SECRET,
    redirectUri: env.TRUELAYER_REDIRECT_URI,
    webhookSecret: env.TRUELAYER_WEBHOOK_SECRET,
    env: env.TRUELAYER_ENV,
  });

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // ── Infrastructure plugins ────────────────────────────────────
  const allowedOrigins = env.NODE_ENV === 'production'
    ? [
        // Add your production domains here
        'https://clearmoney.app',
        'clearmoney://', // deep link scheme
      ]
    : true; // allow all in development

  await app.register(cors, { origin: allowedOrigins });
  await app.register(requestIdPlugin);
  await app.register(securityHeadersPlugin);
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(errorHandlerPlugin);

  // ── Unversioned routes (health, webhooks, OAuth callbacks) ────
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });
  await app.register(connectionCallbackRoutes, { prefix: '/connections/callback' });

  // ── Versioned API routes (/v1) ────────────────────────────────
  await app.register(
    async (v1) => {
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(institutionRoutes, { prefix: '/institutions' });
      await v1.register(connectionRoutes, { prefix: '/connections' });
      await v1.register(accountRoutes, { prefix: '/accounts' });
      await v1.register(transactionRoutes, { prefix: '/transactions' });
      await v1.register(budgetRoutes, { prefix: '/budgets' });
      await v1.register(recurringRoutes, { prefix: '/recurring' });
      await v1.register(analyticsRoutes, { prefix: '/analytics' });
      await v1.register(insightRoutes, { prefix: '/insights' });
      await v1.register(notificationRoutes, { prefix: '/notifications' });
      await v1.register(syncRoutes, { prefix: '/sync' });
      await v1.register(categoryRoutes, { prefix: '/categories' });
    },
    { prefix: '/v1' },
  );

  return { app, env };
}
