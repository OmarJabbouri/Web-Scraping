import { loadConfig, createWorker, type ScrapeJob } from '@rag/shared';
import { recordDeadLetter } from '@rag/db';
import type { Job } from 'bullmq';

const config = loadConfig();
console.log(`[scraper-worker] started (env: ${config.NODE_ENV}, redis: ${config.REDIS_URL})`);

// Consume the `scrape` queue. The real fetch/robots/dedup/link-discovery logic lands in Phase 3;
// this Phase-2 processor wires up the queue plumbing so scaling, retries, the dead-letter path and
// graceful shutdown are all demonstrable now.
createWorker(
  'scrape',
  async (job: Job<ScrapeJob>) => {
    const { siteId, url, depth } = job.data;
    console.log(`[scraper-worker] scrape job ${job.id}: site=${siteId} depth=${depth} url=${url}`);
    // Phase 3: staticFetcher/jsFetcher → robots check → store page_version → enqueue `process`.
    return { ok: true, url };
  },
  {
    concurrency: 2,
    // On permanent failure, persist to failed_jobs and copy to the dead-letter queue (task 2.3).
    onFinalFailure: recordDeadLetter,
  },
);
