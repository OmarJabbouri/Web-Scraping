import { Redis, type RedisOptions } from 'ioredis';
import { loadConfig } from '../config.js';

// BullMQ requires `maxRetriesPerRequest: null` on its Redis connection: internally it uses
// blocking commands (BRPOPLPUSH) whose duration is unknown, so ioredis must not abort them.
const BULLMQ_REQUIRED_OPTS: RedisOptions = {
  maxRetriesPerRequest: null,
};

/**
 * Create a fresh Redis connection for BullMQ.
 *
 * BullMQ recommends a dedicated connection per Queue and per Worker (a Worker's blocking reads
 * would otherwise stall commands issued on a shared connection), so this is a factory, not a
 * singleton. `extra` lets callers layer on options (e.g. a plain connection for the rate limiter).
 */
export function createRedisConnection(extra: RedisOptions = {}): Redis {
  const { REDIS_URL } = loadConfig();
  return new Redis(REDIS_URL, { ...BULLMQ_REQUIRED_OPTS, ...extra });
}

export { Redis };
