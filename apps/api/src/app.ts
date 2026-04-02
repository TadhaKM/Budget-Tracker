import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadEnv } from './config/env.js';
import { prismaPlugin } from './plugins/prisma.js';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { accountRoutes } from './routes/accounts.js';
import { transactionRoutes } from './routes/transactions.js';
import { budgetRoutes } from './routes/budgets.js';
import { insightRoutes } from './routes/insights.js';
import { webhookRoutes } from './routes/webhooks.js';

export async function buildApp() {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(accountRoutes, { prefix: '/accounts' });
  await app.register(transactionRoutes, { prefix: '/transactions' });
  await app.register(budgetRoutes, { prefix: '/budgets' });
  await app.register(insightRoutes, { prefix: '/insights' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });

  return { app, env };
}
