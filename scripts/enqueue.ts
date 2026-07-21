/**
 * Push demo jobs onto the queues so you can watch them flow through Bull Board
 * (http://localhost:3000/admin/queues) — useful for the demo video and for eyeballing
 * horizontal scaling.
 *
 *   npm run build
 *   docker compose up -d postgres redis
 *   # start the API (Bull Board) and the workers, e.g.  npm run dev
 *   npm run demo:enqueue -- 20      # enqueue 20 scrape jobs (default 5)
 *
 * With more scraper-worker replicas the same batch drains faster — that is the scaling story.
 */
import { enqueue, closeQueues } from '@rag/shared';

async function main() {
  const count = Number(process.argv[2] ?? 5);
  console.log(`Enqueuing ${count} scrape job(s)…`);
  for (let i = 1; i <= count; i++) {
    await enqueue('scrape', {
      siteId: 1,
      url: `https://books.toscrape.com/catalogue/page-${i}.html`,
      depth: 0,
    });
  }
  console.log('Done. Watch them at http://localhost:3000/admin/queues');
  await closeQueues();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
