/**
 * Redis-backed OAuth state store.
 *
 * During the TrueLayer OAuth consent flow we generate a random `state` param
 * and need to validate it when the callback arrives. Storing in Redis with a
 * short TTL (10 minutes) prevents:
 *   - CSRF attacks (state is per-user, per-flow)
 *   - Stale/expired consent flows lingering forever
 *   - The broken "find any PENDING connection" pattern
 */

import IORedis from 'ioredis';

const KEY_PREFIX = 'oauth:state:';
const TTL_SECONDS = 600; // 10 minutes — consent flows rarely take longer

export interface OAuthStatePayload {
  userId: string;
  institutionId: string;
  connectionId: string; // connectedInstitution row ID
}

let redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
    });
  }
  return redis;
}

/** Store state → payload with TTL. */
export async function storeOAuthState(
  state: string,
  payload: OAuthStatePayload,
): Promise<void> {
  await getRedis().set(
    `${KEY_PREFIX}${state}`,
    JSON.stringify(payload),
    'EX',
    TTL_SECONDS,
  );
}

/**
 * Retrieve and atomically delete the state payload.
 * Returns null if expired or not found (replay/CSRF).
 */
export async function consumeOAuthState(
  state: string,
): Promise<OAuthStatePayload | null> {
  const key = `${KEY_PREFIX}${state}`;
  const raw = await getRedis().get(key);
  if (!raw) return null;

  // Delete immediately — state is single-use
  await getRedis().del(key);

  try {
    return JSON.parse(raw) as OAuthStatePayload;
  } catch {
    return null;
  }
}
