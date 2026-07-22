import { loadConfig, createWorker, type IndexJob } from '@rag/shared';
import { recordDeadLetter } from '@rag/db';
import type { Job } from 'bullmq';
import { indexDocument } from './rag/index-document.js';

const config = loadConfig();
console.log(`[indexing-worker] started (env: ${config.NODE_ENV}, redis: ${config.REDIS_URL})`);

// Consume the `index` queue: chunk a processed document, embed the chunks with OpenAI, and store
// the vectors in pgvector (Phase 5.1 + 5.2). Concurrency 1 keeps us gentle on the embeddings rate
// limit; bump it once batching headroom is confirmed. Failed jobs dead-letter like the rest of the
// pipeline (Phase 2.3).
createWorker(
  'index',
  async (job: Job<IndexJob>) => {
    const outcome = await indexDocument(job);
    const extra =
      outcome.result === 'indexed' ? ` → ${outcome.chunks} chunks embedded` : ` (${outcome.reason})`;
    console.log(
      `[indexing-worker] ${outcome.result.toUpperCase()} document=${outcome.documentId}${extra}`,
    );
    return outcome;
  },
  { concurrency: 1, onFinalFailure: recordDeadLetter },
);
