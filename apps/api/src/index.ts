import { createRedisConnection, closeQueues, loadConfig } from '@rag/shared';
import { sequelize } from '@rag/db';
import { createApp } from './app.js';

const config = loadConfig();
// One long-lived connection for health probes. The queues keep their own (BullMQ requires a
// dedicated connection per Queue/Worker), so this one only ever serves PINGs.
const redis = createRedisConnection({ maxRetriesPerRequest: 2, lazyConnect: false });

const app = createApp(config, redis);
const server = app.listen(config.PORT, () => {
  console.log(`[api] listening on http://localhost:${config.PORT}`);
  console.log(`[api] docs        http://localhost:${config.PORT}/api/docs`);
  console.log(`[api] queues      http://localhost:${config.PORT}/admin/queues`);
});

/**
 * Graceful shutdown (mirrors the workers, task 2.6): stop accepting connections, let in-flight
 * requests finish, then release Redis/Postgres. Without this, `docker compose down` would cut
 * live requests and leave queue connections dangling.
 */
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received — shutting down`);

  const forceExit = setTimeout(() => {
    console.error('[api] shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await Promise.allSettled([closeQueues(), redis.quit(), sequelize.close()]);
  console.log('[api] shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
