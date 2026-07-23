import { Router } from 'express';
import { sequelize } from '@rag/db';
import type { Redis } from '@rag/shared';
import { asyncHandler } from '../http/errors.js';

/**
 * Health check. `/health` is the container probe; it reports whether the API can actually reach
 * Postgres and Redis, because an API process that is up but cannot reach its dependencies is not
 * healthy — Compose/orchestrators should see 503 and act on it.
 */
export function createHealthRouter(redis: Redis, env: string): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const [postgres, redisStatus] = await Promise.all([check(() => sequelize.authenticate()), check(() => redis.ping())]);
      const healthy = postgres === 'up' && redisStatus === 'up';
      res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        service: 'api',
        env,
        dependencies: { postgres, redis: redisStatus },
        uptimeSeconds: Math.round(process.uptime()),
      });
    }),
  );

  return router;
}

async function check(probe: () => Promise<unknown>): Promise<'up' | 'down'> {
  try {
    await probe();
    return 'up';
  } catch {
    return 'down';
  }
}
