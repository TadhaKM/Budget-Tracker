/**
 * UserService — manages user lifecycle operations.
 *
 * Extracted from auth routes to keep route handlers thin.
 */

import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';

interface CreateUserInput {
  email: string;
  supabaseId: string;
  displayName?: string | null;
  timezone?: string;
  currency?: string;
}

interface UpdateUserInput {
  displayName?: string | null;
  timezone?: string;
  currency?: string;
}

interface UserStats {
  connectedBanks: number;
  totalAccounts: number;
  transactionCount: number;
}

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async findBySupabaseId(supabaseId: string) {
    return this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true, deletedAt: true },
    });
  }

  async create(input: CreateUserInput) {
    const existing = await this.prisma.user.findUnique({
      where: { supabaseId: input.supabaseId },
    });
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'User already registered');
    }

    return this.prisma.user.create({
      data: {
        email: input.email,
        supabaseId: input.supabaseId,
        displayName: input.displayName ?? null,
        timezone: input.timezone ?? 'Europe/Dublin',
        currency: input.currency ?? 'EUR',
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const stats = await this.getStats(userId);
    return { ...user, stats };
  }

  async update(userId: string, input: UpdateUserInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data: input,
    });
  }

  async softDelete(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ACCOUNT_DELETED',
        entityType: 'user',
        entityId: userId,
      },
    });
  }

  async getStats(userId: string): Promise<UserStats> {
    const [connectedBanks, totalAccounts, transactionCount] = await Promise.all([
      this.prisma.connectedInstitution.count({
        where: { userId, consentStatus: 'ACTIVE' },
      }),
      this.prisma.account.count({
        where: { userId, isActive: true },
      }),
      this.prisma.transaction.count({
        where: { userId },
      }),
    ]);

    return { connectedBanks, totalAccounts, transactionCount };
  }

  async getOnboardingStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { onboardedAt: true },
    });

    const hasBankConnected = await this.prisma.connectedInstitution.count({
      where: { userId },
    }) > 0;

    return {
      isComplete: user.onboardedAt !== null,
      steps: {
        accountCreated: true,
        bankConnected: hasBankConnected,
        firstSyncComplete: hasBankConnected,
      },
    };
  }

  async completeOnboarding(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardedAt: new Date() },
    });
  }
}
