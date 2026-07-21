import type { Job } from 'bullmq';
import {
  enqueue,
  waitForDomainSlot,
  domainOf,
  type ScrapeJob,
  type Redis,
} from '@rag/shared';
import { Site, Page, PageVersion, CrawlSession } from '@rag/db';
import { selectFetcher } from './fetchers.js';
import { getRobots, isAllowed, effectiveCrawlDelayMs } from './robots.js';
import { extractSameDomainLinks } from './links.js';
import { sha256 } from './hash.js';
import { assertNotInCooldown, noteBlocked } from './cooldown.js';
import { bumpPending } from './session.js';
import { RetryableError, PermanentError } from './errors.js';

const budgetKey = (sessionId: number) => `crawl:session:${sessionId}:budget`;

export interface CrawlOutcome {
  url: string;
  result: 'stored' | 'unchanged' | 'skipped' | 'failed';
  reason?: string;
  discovered?: number;
}

/**
 * Crawl a single URL. This is the whole scraper pipeline for one page, in order:
 *   robots check → politeness delay → fetch (static or JS) → dedup by content hash →
 *   store a new page_version + enqueue `process` → discover same-domain links → enqueue them.
 *
 * Transient problems throw RetryableError so BullMQ retries with backoff; dead ends (404, disallowed)
 * are recorded and returned without a retry.
 */
export async function crawlUrl(job: Job<ScrapeJob>, redis: Redis): Promise<CrawlOutcome> {
  const { siteId, url, depth, sessionId } = job.data;

  const site = await Site.findByPk(siteId);
  if (!site) throw new PermanentError(`site ${siteId} not found`);
  if (!site.allowed) return finish(sessionId, 'skipped', { url, result: 'skipped', reason: 'site not allowed' });

  // 3.2 robots.txt — check every URL and log the decision (for the compliance note).
  const robots = await getRobots(site, url);
  if (!isAllowed(robots, url)) {
    console.log(`[scraper-worker] robots DISALLOW ${url} — skipping`);
    await upsertPageStatus(url, siteId, 'skipped');
    return finish(sessionId, 'skipped', { url, result: 'skipped', reason: 'robots disallow' });
  }

  // 3.6 respect a domain cooldown, then 2.4 space requests by the (stricter) crawl delay.
  const domain = domainOf(url);
  await assertNotInCooldown(redis, domain);
  await waitForDomainSlot(redis, domain, effectiveCrawlDelayMs(robots, site.crawlDelayMs));

  // 3.1 fetch with the fetcher chosen by render_mode.
  const fetcher = selectFetcher(site.renderMode);
  const { status, html, finalUrl } = await fetcher(url);

  // 3.6 explicit block handling → domain cooldown + retry.
  if (status === 403 || status === 429) {
    await noteBlocked(redis, domain);
    throw new RetryableError(`blocked HTTP ${status} for ${url}`, status);
  }
  if (status >= 400) {
    console.log(`[scraper-worker] HTTP ${status} for ${url} — recording as failed`);
    await upsertPageStatus(url, siteId, 'failed', status);
    return finish(sessionId, 'failed', { url, result: 'failed', reason: `http ${status}` });
  }

  // 3.4 dedup by content hash.
  const hash = sha256(html);
  const page = await claimPage(url, siteId);
  if (page.contentHash === hash) {
    page.status = 'crawled';
    page.lastCrawledAt = new Date();
    await page.save();
    console.log(`[scraper-worker] unchanged ${url} — skipping processing`);
    return finish(sessionId, 'skipped', { url, result: 'unchanged' });
  }

  // 3.5 store a new immutable version (never overwrite) and hand off to the processing worker.
  const prevMax = (await PageVersion.max<number, PageVersion>('versionNo', { where: { pageId: page.id } })) ?? 0;
  const version = await PageVersion.create({
    pageId: page.id,
    versionNo: prevMax + 1,
    rawHtml: html,
    contentHash: hash,
  });
  page.status = 'crawled';
  page.contentHash = hash;
  page.httpStatus = status;
  page.lastCrawledAt = new Date();
  await page.save();
  await enqueue('process', { pageVersionId: version.id });

  // 3.3 + 3.7 discover links and enqueue them, bounded by depth and the session page budget.
  const discovered = await discoverAndEnqueue(html, finalUrl, site, depth, sessionId, redis);

  return finish(sessionId, 'crawled', { url, result: 'stored', discovered });
}

/** Find-or-create the page row for a URL (the crawl may be the first time we've seen it). */
async function claimPage(url: string, siteId: number): Promise<Page> {
  const [page] = await Page.findOrCreate({ where: { url }, defaults: { siteId, url, status: 'pending' } });
  return page;
}

async function upsertPageStatus(
  url: string,
  siteId: number,
  status: 'skipped' | 'failed',
  httpStatus?: number,
): Promise<void> {
  const page = await claimPage(url, siteId);
  page.status = status;
  if (httpStatus !== undefined) page.httpStatus = httpStatus;
  page.lastCrawledAt = new Date();
  await page.save();
}

async function discoverAndEnqueue(
  html: string,
  pageUrl: string,
  site: Site,
  depth: number,
  sessionId: number | undefined,
  redis: Redis,
): Promise<number> {
  if (depth >= site.maxDepth) return 0;

  let enqueued = 0;
  for (const link of extractSameDomainLinks(html, pageUrl)) {
    // Claim the URL by creating a pending page. The unique `url` constraint means only one worker
    // wins the race, so a link is enqueued exactly once even with many workers running.
    const [page, created] = await Page.findOrCreate({
      where: { url: link },
      defaults: { siteId: site.id, url: link, status: 'pending' },
    });
    if (!created) continue; // already known → someone else owns crawling it

    // 3.7 page budget: stop enqueueing once the session hits max_pages (atomic across workers).
    if (sessionId !== undefined) {
      const n = await redis.incr(budgetKey(sessionId));
      if (n > site.maxPages) {
        // We claimed this page but the budget is spent — mark it skipped, not left as "pending".
        page.status = 'skipped';
        await page.save();
        break;
      }
    }

    // Count this job as outstanding for the session *before* enqueueing it, so the completion
    // counter can never briefly hit zero while children are still being scheduled.
    if (sessionId !== undefined) await bumpPending(redis, sessionId);
    await enqueue('scrape', { siteId: site.id, url: link, depth: depth + 1, sessionId });
    enqueued++;
  }
  return enqueued;
}

/** Bump the crawl session's live counters (task 3.7) and return the outcome. */
async function finish(
  sessionId: number | undefined,
  bucket: 'crawled' | 'skipped' | 'failed',
  outcome: CrawlOutcome,
): Promise<CrawlOutcome> {
  if (sessionId !== undefined) {
    const field =
      bucket === 'crawled' ? 'pagesCrawled' : bucket === 'skipped' ? 'pagesSkipped' : 'pagesFailed';
    await CrawlSession.increment(field, { where: { id: sessionId } }).catch(() => {});
  }
  return outcome;
}
