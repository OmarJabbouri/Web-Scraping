import type { Job } from 'bullmq';
import type { IndexJob } from '@rag/shared';
import { sequelize, Document, Chunk } from '@rag/db';
import { chunkDocument } from './chunk.js';
import { embedTexts } from './embed.js';

export interface IndexOutcome {
  documentId: number;
  result: 'indexed' | 'skipped';
  chunks?: number;
  reason?: string;
}

/**
 * Index one processed document (Phase 5.1 + 5.2):
 *   load the document → split its cleaned text into overlapping, structure-aware chunks →
 *   embed every chunk with OpenAI → replace this document's rows in `chunks` (vectors + text).
 *
 * The generated `content_tsv` column is filled by Postgres automatically from `text`, so the same
 * rows serve both semantic (vector) and keyword (full-text) search — no extra work here.
 */
export async function indexDocument(job: Job<IndexJob>): Promise<IndexOutcome> {
  const { documentId } = job.data;

  const doc = await Document.findByPk(documentId);
  if (!doc) return { documentId, result: 'skipped', reason: 'document not found' };

  const chunks = chunkDocument(doc.cleanedText, doc.title);
  if (!chunks.length) return { documentId, result: 'skipped', reason: 'no chunkable text' };

  // One batched OpenAI call set for the whole document; order matches `chunks`.
  const embeddings = await embedTexts(chunks.map((c) => c.text));

  // Re-indexing a document replaces its chunks atomically: delete the old set, insert the new one,
  // so a re-run never leaves stale or duplicated vectors behind (idempotent).
  await sequelize.transaction(async (transaction) => {
    await Chunk.destroy({ where: { documentId }, transaction });
    await Chunk.bulkCreate(
      chunks.map((c, i) => ({
        documentId,
        chunkIndex: i,
        headingPath: c.headingPath,
        text: c.text,
        tokenCount: c.tokenCount,
        embedding: embeddings[i] ?? null,
      })),
      { transaction },
    );
  });

  return { documentId, result: 'indexed', chunks: chunks.length };
}
