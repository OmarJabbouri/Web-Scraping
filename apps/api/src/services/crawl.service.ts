import { CrawlSession, Page, type Site } from '@rag/db';
import { createRedisConnection, enqueue } from '@rag/shared';

export interface StartCrawlOptions {
  maxDepth?: number;
  maxPages?: number;
}

/**
 * Kick off a crawl for one site (task 6.1) — the HTTP equivalent of `npm run crawl`.
 *
 * The API only *seeds* the work: it opens a crawl_session, primes the Redis budget/pending
 * counters, and pushes the site's base URL onto the `scrape` queue. Independent worker containers
 * pick it up from there (fetch → store → discover links → enqueue), which is exactly why adding
 * workers scales the crawl without the API knowing anything about them.
 */
export async function startCrawl(site: Site, opts: StartCrawlOptions = {}): Promise<CrawlSession> {
  const session = await CrawlSession.create({
    siteId: site.id,
    maxDepth: opts.maxDepth ?? site.maxDepth,
    maxPages: opts.maxPages ?? site.maxPages,
  });

  const redis = createRedisConnection();
  try {
    // The seed URL counts as the first page against the budget (max_pages)…
    await redis.set(`crawl:session:${session.id}:budget`, '1');
    // …and as the first outstanding job. Workers decrement this as jobs settle and flip the
    // session to `completed` at zero. Keep in sync with pendingKey() in the scraper worker.
    await redis.set(`crawl:session:${session.id}:pending`, '1');
  } finally {
    await redis.quit();
  }

  await Page.findOrCreate({
    where: { url: site.baseUrl },
    defaults: { siteId: site.id, url: site.baseUrl, status: 'pending' },
  });
  await enqueue('scrape', { siteId: site.id, url: site.baseUrl, depth: 0, sessionId: session.id });

  return session;
}
