import { loadConfig, createWorker, type ProcessJob } from '@rag/shared';
import { recordDeadLetter } from '@rag/db';
import type { Job } from 'bullmq';

const config = loadConfig();
console.log(`[processing-worker] started (env: ${config.NODE_ENV}, redis: ${config.REDIS_URL})`);

// Consume the `process` queue. Real cleaning/normalization logic lands in Phase 4.
createWorker(
  'process',
  async (job: Job<ProcessJob>) => {
    console.log(`[processing-worker] process job ${job.id}: pageVersion=${job.data.pageVersionId}`);
    // Phase 4: Readability/Cheerio strip → extract text/tables/links → insert `documents` → enqueue `index`.
    return { ok: true };
  },
  { concurrency: 2, onFinalFailure: recordDeadLetter },
);
