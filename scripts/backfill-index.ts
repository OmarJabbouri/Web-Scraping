/**
 * Backfill: embed any documents that don't yet have chunks (Phase 5.1/5.2).
 *
 * Handy when index jobs failed earlier (e.g. a worker started without OPENAI_API_KEY) — run this
 * from the repo root so the root .env is loaded, and it re-indexes only what's missing.
 *
 *   npx tsx scripts/backfill-index.ts
 */
import { sequelize, Document, Chunk } from '@rag/db';
import { closeQueues } from '@rag/shared';
import { indexDocument } from '../apps/indexing-worker/src/rag/index-document.js';

const asJob = <T>(data: T): { data: T } => ({ data });

async function main(): Promise<void> {
  const docs = await Document.findAll({ attributes: ['id'], order: [['id', 'ASC']] });
  let indexed = 0;
  let chunks = 0;
  for (const d of docs) {
    if ((await Chunk.count({ where: { documentId: d.id } })) > 0) continue;
    const out = await indexDocument(asJob({ documentId: d.id }) as never);
    if (out.result === 'indexed') {
      indexed++;
      chunks += out.chunks ?? 0;
    }
  }
  console.log(`Backfill: indexed ${indexed} documents, ${chunks} chunks embedded`);
  await closeQueues();
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
