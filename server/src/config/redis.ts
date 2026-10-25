import { Redis } from 'ioredis';
import { config } from './env.js';
import { logger, serializeError } from '../utils/logger.js';

/** Connection state reported by /health. */
export type RedisStatus = 'connected' | 'connecting' | 'disconnected';

// Tests never need a real Redis: ioredis-mock is a dev dependency, loaded only when NODE_ENV=test.
const RedisMock = config.isTest ? (await import('ioredis-mock')).default : undefined;

let client: Redis | undefined;

function createClient(): Redis {
  if (RedisMock) return new RedisMock() as unknown as Redis;
  if (!config.redisUrl) throw new Error('REDIS_URL is not set');

  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    // Required by BullMQ: commands wait for a reconnect instead of failing after N retries.
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
  });

  // Log state changes only, not every failed reconnect attempt. Never log the URL.
  let down = false;
  redis.on('ready', () => {
    down = false;
    logger.info('Redis connected');
  });
  redis.on('error', (err: unknown) => {
    if (down) return;
    down = true;
    logger.error({ err: serializeError(err) }, 'Redis error; reconnecting in the background');
  });
  return redis;
}

/**
 * Returns the shared ioredis client (created on first use; an ioredis-mock instance in tests).
 * BullMQ connections should reuse its options.
 */
export function getRedis(): Redis {
  client ??= createClient();
  return client;
}

/**
 * Connects the shared client. A failure is logged, not thrown: ioredis keeps retrying in the
 * background and /health reports the state, so the API still starts when Redis is down.
 */
export async function connectRedis(): Promise<void> {
  const redis = getRedis();
  if (redis.status !== 'wait') return;
  try {
    await redis.connect();
  } catch {
    // Already logged by the 'error' listener.
  }
}

/** Current state of the shared client. */
export function redisStatus(): RedisStatus {
  switch (client?.status) {
    case 'ready':
      return 'connected';
    case 'connecting':
    case 'connect':
      return 'connecting';
    default:
      // Includes 'reconnecting': the connection was lost and is being retried.
      return 'disconnected';
  }
}

/** Closes the shared client (QUIT, or a hard disconnect if that fails). */
export async function closeRedis(): Promise<void> {
  if (!client) return;
  const redis = client;
  client = undefined;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
