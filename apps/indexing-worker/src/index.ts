import { loadConfig, createWorker, type IndexJob } from '@rag/shared';
import { recordDeadLetter } from '@rag/db';
import type { Job } from 'bullmq';

const config = loadConfig();
console.log(`[indexing-worker] started (env: ${config.NODE_ENV}, redis: ${config.REDIS_URL})`);

// Consume the `index` queue. Real chunking/embedding logic lands in Phase 5.
createWorker(
  'index',
  async (job: Job<IndexJob>) => {
    console.log(`[indexing-worker] index job ${job.id}: document=${job.data.documentId}`);
    // Phase 5: structure-aware chunking → batch embed (OpenAI) → store vectors in pgvector.
    return { ok: true };
  },
  { concurrency: 1, onFinalFailure: recordDeadLetter },
);
