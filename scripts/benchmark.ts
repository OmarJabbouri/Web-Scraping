/**
 * 3.8 — horizontal scaling benchmark. Enqueues N independent scrape jobs (leaf pages, so no
 * link fan-out) and measures the wall-clock time for the workers to drain them. Run it once with
 * 1 worker and once with 4 to show that more workers = faster crawl.
 *
 *   # terminal 1 — run exactly the number of workers you want to measure:
 *   docker compose up --scale scraper-worker=1 scraper-worker      # then re-run with =4
 *   # terminal 2:
 *   npm run build
 *   npm run benchmark -- 40
 *
 * Prints elapsed seconds and pages/second. Put the 1-vs-4 numbers in the report.
 */
import { enqueue, createRedisConnection, getAllQueues, closeQueues, QUEUE_NAMES } from '@rag/shared';
import { Site, sequelize } from '@rag/db';
import { Queue } from 'bullmq';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const n = Number(process.argv[2] ?? 40);
  const site = await Site.findOne({ where: { renderMode: 'static' }, order: [['id', 'ASC']] });
  if (!site) {
    console.error('No static site seeded. Run: npm run db:seed');
    process.exit(1);
  }

  // Clean the pipeline queues so we measure only this batch.
  for (const q of getAllQueues()) await q.obliterate({ force: true });

  // depth = maxDepth means the crawler stores the page but discovers no children — a pure
  // throughput measurement with no fan-out.
  console.log(`Enqueuing ${n} scrape jobs for ${site.baseUrl} …`);
  for (let i = 1; i <= n; i++) {
    await enqueue('scrape', {
      siteId: site.id,
      url: `${site.baseUrl}catalogue/page-${i}.html`,
      depth: site.maxDepth,
    });
  }

  const scrapeQueue = new Queue(QUEUE_NAMES.scrape, { connection: createRedisConnection() });
  const start = Date.now();
  console.log('Waiting for workers to drain the queue…');
  for (;;) {
    const counts = await scrapeQueue.getJobCountByTypes('waiting', 'active', 'delayed');
    if (counts === 0) break;
    await sleep(250);
  }
  const elapsed = (Date.now() - start) / 1000;

  console.log(`\nDrained ${n} jobs in ${elapsed.toFixed(1)}s → ${(n / elapsed).toFixed(1)} pages/sec`);

  await scrapeQueue.close();
  await closeQueues();
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
