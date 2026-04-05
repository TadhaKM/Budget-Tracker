import type { FastifyInstance } from 'fastify';
import IORedis from 'ioredis';

let redis: IORedis | null = null;

export async function healthRoutes(app: FastifyInstance) {
  // GET /health — basic liveness check
  app.get('/', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // GET /health/ready — deep readiness check (DB + Redis)
  app.get('/ready', async () => {
    const checks: Record<string, 'ok' | 'error'> = {};

    // Database
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    // Redis
    try {
      if (!redis) {
        redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
        });
      }
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return {
      status: allOk ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  });
}
