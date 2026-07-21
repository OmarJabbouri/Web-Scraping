import type { Job } from 'bullmq';
import type { Redis, ScrapeJob } from '@rag/shared';
import { CrawlSession } from '@rag/db';

/**
 * Crawl-completion tracking (fixes "session stuck on running").
 *
 * A distributed crawl has no single worker that knows it handled the *last* page, so we count
 * outstanding scrape jobs for each session in a Redis key:
 *   - +1 every time a scrape job for the session is enqueued (seed + every discovered link);
 *   - -1 every time one of those jobs settles (completed, or failed for good).
 * When the counter reaches zero, the crawl is finished — we mark the session `completed`. The
 * counter lives in Redis so the arithmetic is atomic and shared across all workers.
 */
const pendingKey = (sessionId: number) => `crawl:session:${sessionId}:pending`;

export { pendingKey };

/** Count one more outstanding scrape job for the session (call right before enqueueing it). */
export async function bumpPending(redis: Redis, sessionId: number): Promise<void> {
  await redis.incr(pendingKey(sessionId));
}

/**
 * Mark one scrape job settled. When the last outstanding job settles, flip the session to
 * `completed` and stamp `finished_at`. The `status: 'running'` guard makes the update idempotent,
 * so a race between two workers hitting zero can only complete the session once.
 */
export async function settleScrapeJob(redis: Redis, job: Job<ScrapeJob>): Promise<void> {
  const sessionId = job.data?.sessionId;
  if (!sessionId) return;
  const remaining = await redis.decr(pendingKey(sessionId));
  if (remaining <= 0) {
    await CrawlSession.update(
      { status: 'completed', finishedAt: new Date() },
      { where: { id: sessionId, status: 'running' } },
    );
    await redis.del(pendingKey(sessionId));
    console.log(`[scraper-worker] crawl session ${sessionId} completed`);
  }
}
