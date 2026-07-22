/**
 * Phase 5 self-test — runs the whole RAG pipeline against the live Postgres + already-crawled data.
 *
 *   docker compose up -d postgres redis   # must be up
 *   npm run db:migrate                     # schema present
 *   # (some page_versions already crawled)
 *   OPENAI_API_KEY=sk-... in .env
 *   npx tsx scripts/test-phase5.ts
 *
 * It calls the SAME functions the processing- and indexing-workers run per job (just directly,
 * instead of through BullMQ), then exercises retrieval + answer generation from @rag/rag:
 *   Phase 4     page_versions -> documents        (processPageVersion)
 *   Phase 5.1/2 documents     -> chunks+embeddings (indexDocument)
 *   Phase 5.3   semantic (vector) search
 *   Phase 5.4   keyword search + hybrid RRF
 *   Phase 5.5   cited answer with gpt-4o-mini
 */
import { sequelize, PageVersion, Document } from '@rag/db';
import { closeQueues } from '@rag/shared';
import { vectorSearch, keywordSearch, hybridSearch, answerQuestion, type RetrievedChunk } from '@rag/rag';
import { processPageVersion } from '../apps/processing-worker/src/processing/process.js';
import { indexDocument } from '../apps/indexing-worker/src/rag/index-document.js';

// The workers hand these functions a full BullMQ Job; both only read `job.data`, so a minimal
// stand-in is enough to drive them from a script.
const asJob = <T>(data: T): { data: T } => ({ data });

function showTop(label: string, rows: RetrievedChunk[]): void {
  console.log(`\n${label}`);
  if (!rows.length) return void console.log('  (no matches)');
  rows.slice(0, 3).forEach((r, i) => {
    const preview = r.text.replace(/\s+/g, ' ').slice(0, 90);
    console.log(`  ${i + 1}. score=${r.score.toFixed(3)}  ${r.url}\n     ${preview}…`);
  });
}

async function main(): Promise<void> {
  console.log('\n=== Phase 5 — RAG pipeline test ===');

  // 1) Phase 4: raw HTML -> cleaned documents ------------------------------------------------
  const versions = await PageVersion.findAll({ attributes: ['id'], order: [['id', 'ASC']] });
  console.log(`\n[1/4] Processing ${versions.length} page versions -> documents...`);
  let processed = 0;
  let skipped = 0;
  for (const v of versions) {
    const out = await processPageVersion(asJob({ pageVersionId: v.id }) as never);
    out.result === 'processed' ? processed++ : skipped++;
  }
  console.log(`      ${processed} documents created, ${skipped} skipped`);

  // 2) Phase 5.1/5.2: documents -> chunks + embeddings ---------------------------------------
  const docs = await Document.findAll({ attributes: ['id'], order: [['id', 'ASC']] });
  console.log(`\n[2/4] Indexing ${docs.length} documents -> chunks + embeddings (OpenAI)...`);
  let totalChunks = 0;
  for (const d of docs) {
    const out = await indexDocument(asJob({ documentId: d.id }) as never);
    if (out.result === 'indexed') totalChunks += out.chunks ?? 0;
  }
  console.log(`      ${totalChunks} chunks embedded into pgvector`);

  // 3) Phase 5.3/5.4: three retrieval modes on the same query --------------------------------
  const query = 'Which travel books are available and what do they cost?';
  console.log(`\n[3/4] Retrieval for: "${query}"`);
  showTop('semantic — vector similarity (5.3):', await vectorSearch(query, 3));
  showTop('keyword — full-text tsvector (5.4):', await keywordSearch(query, 3));
  showTop('hybrid  — RRF fusion (5.4):', await hybridSearch(query, 3));

  // 4) Phase 5.5: grounded answer with inline citations --------------------------------------
  console.log(`\n[4/4] Generating cited answer with gpt-4o-mini...`);
  const ans = await answerQuestion(query, 5);
  console.log(`\nANSWER:\n${ans.answer}\n`);
  console.log('CITATIONS:');
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
