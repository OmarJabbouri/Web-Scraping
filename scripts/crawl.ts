/**
 * Start a crawl of one site: create a crawl_session, seed the page budget, and enqueue the site's
 * base URL as the first `scrape` job. Workers take it from there (fetch → store → discover → enqueue).
 *
 *   npm run build
 *   docker compose up -d postgres redis
 *   npm run db:migrate && npm run db:seed
 *   npm run dev                       # (or start the scraper-worker)
 *   npm run crawl -- 1                # crawl site id 1  (omit to crawl the first site)
 *   npm run crawl -- books.toscrape   # or match by base_url substring
 *
 * Watch progress in Bull Board (http://localhost:3000/admin/queues) or the crawl_sessions table.
 */
import { enqueue, createRedisConnection, closeQueues } from '@rag/shared';
import { Site, Page, CrawlSession, sequelize } from '@rag/db';
import { Op } from 'sequelize';

async function main() {
  const arg = process.argv[2];
  const site = arg
    ? await Site.findOne({
        where: Number.isInteger(Number(arg))
          ? { id: Number(arg) }
          : { baseUrl: { [Op.iLike]: `%${arg}%` } },
      })
    : await Site.findOne({ order: [['id', 'ASC']] });

  if (!site) {
    console.error(`No site matched "${arg ?? '(first)'}". Run: npm run db:seed`);
    process.exit(1);
  }

  const session = await CrawlSession.create({
    siteId: site.id,
    maxDepth: site.maxDepth,
    maxPages: site.maxPages,
  });

  const redis = createRedisConnection();
  // The seed URL counts as the first page against the budget (max_pages)…
  await redis.set(`crawl:session:${session.id}:budget`, '1');
  // …and as the first outstanding job for completion tracking. The worker decrements this as jobs
  // settle and flips the session to `completed` when it hits zero. Keep this key in sync with
  // pendingKey() in apps/scraper-worker/src/crawler/session.ts.
  await redis.set(`crawl:session:${session.id}:pending`, '1');

  await Page.findOrCreate({
    where: { url: site.baseUrl },
    defaults: { siteId: site.id, url: site.baseUrl, status: 'pending' },
  });
  await enqueue('scrape', { siteId: site.id, url: site.baseUrl, depth: 0, sessionId: session.id });

  console.log(
    `Started crawl session ${session.id} for "${site.name}" (${site.baseUrl})\n` +
      `  render_mode=${site.renderMode} max_depth=${site.maxDepth} max_pages=${site.maxPages}`,
  );

  await redis.quit();
  await closeQueues();
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
