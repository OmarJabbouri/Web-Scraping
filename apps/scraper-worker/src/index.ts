import { loadConfig, createWorker, createRedisConnection, type ScrapeJob } from '@rag/shared';
import { recordDeadLetter } from '@rag/db';
import type { Job } from 'bullmq';
import { crawlUrl } from './crawler/crawl.js';
import { closeBrowser } from './crawler/fetchers.js';
import { settleScrapeJob } from './crawler/session.js';

const config = loadConfig();
console.log(`[scraper-worker] started (env: ${config.NODE_ENV}, redis: ${config.REDIS_URL})`);

// One plain Redis connection, shared by the per-domain rate limiter, the domain cooldown, and the
// crawl-session page budget + completion counter. (BullMQ's own connections are created separately.)
const redis = createRedisConnection();

const worker = createWorker(
  'scrape',
  async (job: Job<ScrapeJob>) => {
    const outcome = await crawlUrl(job, redis);
    const extra = outcome.discovered
      ? ` (+${outcome.discovered} links)`
      : outcome.reason
        ? ` (${outcome.reason})`
        : '';
    console.log(`[scraper-worker] ${outcome.result.toUpperCase()} ${outcome.url}${extra}`);
    return outcome;
  },
  {
    // Several pages in flight at once; per-domain rate limiting still keeps us polite to each site.
    concurrency: 4,
    onFinalFailure: recordDeadLetter,
  },
);

// Decrement the session's outstanding-job counter once a scrape job is truly settled — i.e. it
// succeeded, or it failed after exhausting all retries. When the counter reaches zero the session
// is marked `completed`. A mid-retry failure is NOT settled (the job will run again).
worker.on('completed', (job) => void settleScrapeJob(redis, job));
worker.on('failed', (job) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) void settleScrapeJob(redis, job);
});

// Best-effort cleanup of the shared Chromium instance when the worker is asked to stop.
process.once('SIGTERM', () => void closeBrowser());
process.once('SIGINT', () => void closeBrowser());
