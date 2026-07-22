/**
 * Phase 5.7 — measurable retrieval quality + 5.6 multi-source synthesis check.
 *
 *   npx tsx scripts/eval-retrieval.ts        # run from repo root so .env (OPENAI_API_KEY) loads
 *
 * A small golden set of question → expected-source pairs. For each of the three search modes we
 * measure, at k=5:
 *   - hit-rate@k : fraction of questions where a correct source appears in the top-k
 *   - MRR        : mean reciprocal rank of the first correct source (1/rank), rewarding higher hits
 * Then a multi-source question verifies retrieval spans BOTH scraped sites (5.6).
 */
import { search, generateAnswer, multiHybridSearch, type SearchMode } from '@rag/rag';
import { sequelize } from '@rag/db';
import { closeQueues } from '@rag/shared';

interface Golden {
  q: string;
  /** A substring that must appear in a retrieved chunk's URL for it to count as a correct source. */
  expect: string;
}

// Grounded in pages we actually crawled + indexed (books.toscrape categories, quotes.toscrape).
const GOLDEN: Golden[] = [
  { q: 'Which travel books are available and what do they cost?', expect: 'travel_2' },
  { q: 'Show me some fantasy books.', expect: 'fantasy_19' },
  { q: 'List a few classic literature titles.', expect: 'classics_6' },
  { q: 'What history books do you have?', expect: 'history_32' },
  { q: 'I want to read a biography — what is available?', expect: 'biography_36' },
  { q: 'Any books about business or management?', expect: 'business_35' },
  { q: "What children's books are there?", expect: 'childrens_11' },
  { q: 'Do you have books about food and drink?', expect: 'food-and-drink_33' },
  { q: 'What art books can I find?', expect: 'art_25' },
  { q: 'Show me books about health.', expect: 'health_47' },
  { q: 'What did Albert Einstein say about the world and our thinking?', expect: 'quotes.toscrape' },
  { q: 'What did J.K. Rowling write about the choices we make?', expect: 'quotes.toscrape' },
  { q: 'Give me an inspirational quote about living life.', expect: 'quotes.toscrape' },
  { q: 'Is there a quote about reading novels or books?', expect: 'quotes.toscrape' },
  { q: 'Share a quote about love.', expect: 'quotes.toscrape' },
];

const K = 5;
const MODES: SearchMode[] = ['semantic', 'keyword', 'hybrid'];
const domainOf = (url: string): string => new URL(url).host;

async function main(): Promise<void> {
  console.log(`\n=== Phase 5.7 retrieval eval (golden set: ${GOLDEN.length} questions, k=${K}) ===\n`);

  const rows: Array<{ mode: SearchMode; hitRate: number; mrr: number }> = [];
  for (const mode of MODES) {
    let hits = 0;
    let rrSum = 0;
    for (const item of GOLDEN) {
      const results = await search(item.q, mode, K);
      const rank = results.findIndex((r) => r.url.includes(item.expect)) + 1; // 0 => miss
      if (rank > 0) {
        hits++;
        rrSum += 1 / rank;
      }
    }
    rows.push({ mode, hitRate: hits / GOLDEN.length, mrr: rrSum / GOLDEN.length });
  }

  console.log('mode      hit-rate@5   MRR');
  console.log('--------  ----------   -----');
  for (const r of rows) {
    console.log(`${r.mode.padEnd(8)}  ${(r.hitRate * 100).toFixed(0).padStart(7)}%   ${r.mrr.toFixed(3)}`);
  }

  // 5.6 — multi-source synthesis: a question whose good sources live on BOTH sites.
  console.log('\n=== Phase 5.6 multi-source synthesis ===');
  // A genuinely two-intent question: one part is answered by books.toscrape (travel catalogue),
  // the other by quotes.toscrape (a life quote). A single query embedding can't represent both, so
  // we retrieve per sub-intent (multi-query) and fuse — that's what lets the answer span BOTH sites.
  const q = 'List some travel books I could buy, and share an inspirational quote about life.';
  const subQueries = ['travel books for sale and their prices', 'an inspirational quote about life'];
  console.log(`\nQuestion: "${q}"`);
  console.log(`Sub-queries: ${subQueries.map((s) => `"${s}"`).join(', ')}`);
  const top = await multiHybridSearch(subQueries, 8);
  const domains = [...new Set(top.map((r) => domainOf(r.url)))];
  console.log(`\nTop-8 retrieved from domains: ${domains.join(', ')}`);
  console.log(`Spans >= 2 sites: ${domains.length >= 2 ? 'YES ✅' : 'NO ❌'}`);
  top.forEach((r, i) => console.log(`  ${i + 1}. ${domainOf(r.url)}  ${r.url.replace('https://', '')}`));

  const ans = await generateAnswer(q, top);
  console.log(`\nSynthesized answer:\n${ans.answer}`);
  console.log('\nCitations:');
  ans.citations.forEach((c) => console.log(`  [${c.marker}] ${c.url}`));

  await closeQueues();
  await sequelize.close();
  console.log('\n=== done ===\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
