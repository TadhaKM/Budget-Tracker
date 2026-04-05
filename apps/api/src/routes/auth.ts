import type { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { RegisterUserSchema, UpdateUserSchema } from '@clearmoney/shared';
import { AppError } from '../lib/errors.js';

export async function authRoutes(app: FastifyInstance) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // POST /auth/register — create user on first launch
  app.post('/register', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Missing authorization token');

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new AppError(401, 'UNAUTHORIZED', 'Invalid token');

    // Check if user already exists
    const existing = await app.prisma.user.findUnique({
      where: { supabaseId: data.user.id },
    });
    if (existing) throw new AppError(409, 'CONFLICT', 'User already registered');

    const input = RegisterUserSchema.parse(request.body ?? {});

    const user = await app.prisma.user.create({
      data: {
        email: data.user.email!,
        supabaseId: data.user.id,
        displayName: input.displayName ?? null,
        timezone: input.timezone,
        currency: input.currency,
      },
    });

    return reply.code(201).send(user);
  });

  // GET /auth/me — current user profile
  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
    });

    const [connectedBanks, totalAccounts, transactionCount] = await Promise.all([
      app.prisma.connectedInstitution.count({ where: { userId: request.userId } }),
      app.prisma.account.count({ where: { userId: request.userId, isActive: true } }),
      app.prisma.transaction.count({ where: { userId: request.userId } }),
    ]);

    return {
      ...user,
      stats: { connectedBanks, totalAccounts, transactionCount },
    };
  });

  // PATCH /auth/me — update profile
  app.patch('/me', { preHandler: [app.authenticate] }, async (request) => {
    const input = UpdateUserSchema.parse(request.body);
    const user = await app.prisma.user.update({
      where: { id: request.userId },
      data: input,
    });
    return user;
  });

  // DELETE /auth/me — request account deletion (soft delete)
  app.delete('/me', { preHandler: [app.authenticate] }, async (request) => {
    await app.prisma.user.update({
      where: { id: request.userId },
      data: { deletedAt: new Date() },
    });

    await app.prisma.auditLog.create({
      data: {
        userId: request.userId,
        action: 'ACCOUNT_DELETED',
        entityType: 'user',
        entityId: request.userId,
      },
    });

    return { message: 'Account scheduled for deletion within 48 hours' };
  });

  // GET /auth/onboarding — check onboarding status
  app.get('/onboarding', { preHandler: [app.authenticate] }, async (request) => {
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: { onboardedAt: true },
    });

    const hasBankConnected = await app.prisma.connectedInstitution.count({
      where: { userId: request.userId },
    }) > 0;

    return {
      isComplete: user.onboardedAt !== null,
      steps: {
        accountCreated: true,
        bankConnected: hasBankConnected,
        firstSyncComplete: hasBankConnected,
      },
    };
  });

  // POST /auth/onboarding/complete — mark onboarding done
  app.post('/onboarding/complete', { preHandler: [app.authenticate] }, async (request) => {
    await app.prisma.user.update({
      where: { id: request.userId },
      data: { onboardedAt: new Date() },
    });
    return { success: true };
  });
}
