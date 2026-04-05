/**
 * Auth routes — user registration, profile, onboarding.
 *
 * Registration requires a valid Supabase JWT (user signed up via magic link
 * on the mobile app, but hasn't created their internal profile yet).
 *
 * All other routes require full authentication (JWT + internal user exists).
 */

import type { FastifyInstance } from 'fastify';
import * as jose from 'jose';
import { RegisterUserSchema, UpdateUserSchema } from '@clearmoney/shared';
import { AppError } from '../lib/errors.js';
import { UserService } from '../services/user.js';

export async function authRoutes(app: FastifyInstance) {
  const userService = new UserService(app.prisma);

  // Shared helper: extract Supabase user ID from JWT without requiring
  // the user to exist in our DB yet (needed for registration).
  const jwtSecret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);

  async function extractSupabaseUser(request: { headers: { authorization?: string } }) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authorization token');
    }

    try {
      const { payload } = await jose.jwtVerify(header.slice(7), jwtSecret, {
        algorithms: ['HS256'],
      });
      if (!payload.sub || !payload.email) {
        throw new AppError(401, 'UNAUTHORIZED', 'Token missing required claims');
      }
      return { supabaseId: payload.sub, email: payload.email as string };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid token');
    }
  }

  // ── POST /auth/register ───────────────────────────────────────
  // Called once after first magic link sign-in. Creates internal user.
  app.post('/register', async (request, reply) => {
    const { supabaseId, email } = await extractSupabaseUser(request);
    const input = RegisterUserSchema.parse(request.body ?? {});

    const user = await userService.create({
      email,
      supabaseId,
      displayName: input.displayName,
      timezone: input.timezone,
      currency: input.currency,
    });

    return reply.code(201).send({ data: user });
  });

  // ── GET /auth/me ──────────────────────────────────────────────
  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const profile = await userService.getProfile(request.userId);
    return { data: profile };
  });

  // ── PATCH /auth/me ────────────────────────────────────────────
  app.patch('/me', { preHandler: [app.authenticate] }, async (request) => {
    const input = UpdateUserSchema.parse(request.body);
    const user = await userService.update(request.userId, input);
    return { data: user };
  });

  // ── DELETE /auth/me ───────────────────────────────────────────
  app.delete('/me', { preHandler: [app.authenticate] }, async (request) => {
    await userService.softDelete(request.userId);
    return { data: { message: 'Account scheduled for deletion within 48 hours' } };
  });

  // ── GET /auth/onboarding ──────────────────────────────────────
  app.get('/onboarding', { preHandler: [app.authenticate] }, async (request) => {
    const status = await userService.getOnboardingStatus(request.userId);
    return { data: status };
  });

  // ── POST /auth/onboarding/complete ────────────────────────────
  app.post('/onboarding/complete', { preHandler: [app.authenticate] }, async (request) => {
    await userService.completeOnboarding(request.userId);
    return { data: { success: true } };
  });
}
