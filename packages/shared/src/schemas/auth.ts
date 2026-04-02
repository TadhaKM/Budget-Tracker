import { z } from 'zod';

export const MagicLinkRequestSchema = z.object({
  email: z.string().email(),
});

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
