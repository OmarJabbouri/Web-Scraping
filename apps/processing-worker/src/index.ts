import { loadConfig } from '@rag/shared';

const config = loadConfig();

console.log(`[processing-worker] started (env: ${config.NODE_ENV}, redis: ${config.REDIS_URL})`);
console.log('[processing-worker] waiting for BullMQ consumer — implemented in Phase 2/4');

// Keep the process alive until the BullMQ worker (Phase 2) takes over this role.
setInterval(() => {}, 1 << 30);

process.on('SIGTERM', () => {
  console.log('[processing-worker] SIGTERM received, shutting down');
  process.exit(0);
});
