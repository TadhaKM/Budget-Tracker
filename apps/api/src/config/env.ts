import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  TRUELAYER_CLIENT_ID: z.string().min(1),
  TRUELAYER_CLIENT_SECRET: z.string().min(1),
  TRUELAYER_REDIRECT_URI: z.string().url(),
  TRUELAYER_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
