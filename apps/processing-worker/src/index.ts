import { loadConfig, createWorker, type ProcessJob } from '@rag/shared';
import { recordDeadLetter } from '@rag/db';
import type { Job } from 'bullmq';
import { processPageVersion } from './processing/process.js';

const config = loadConfig();
console.log(`[processing-worker] started (env: ${config.NODE_ENV}, redis: ${config.REDIS_URL})`);

// Consume the `process` queue: clean + normalize the raw HTML of a page version into a `documents`
// row, then enqueue an `index` job (Phase 4). On final failure the job is dead-lettered like the
// rest of the pipeline (Phase 2.3).
createWorker(
  'process',
  async (job: Job<ProcessJob>) => {
    const outcome = await processPageVersion(job);
    const extra =
      outcome.result === 'processed'
        ? ` → document ${outcome.documentId} (${outcome.contentType})`
        : ` (${outcome.reason})`;
    console.log(
      `[processing-worker] ${outcome.result.toUpperCase()} pageVersion=${outcome.pageVersionId}${extra}`,
    );
    return outcome;
  },
  { concurrency: 2, onFinalFailure: recordDeadLetter },
);
