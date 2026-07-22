import type { Job } from 'bullmq';
import { enqueue, type ProcessJob } from '@rag/shared';
import { PageVersion, Page, Document } from '@rag/db';
import { extractContent } from './extract.js';
import { extractTables } from './tables.js';
import { extractDocumentLinks } from './links.js';
import { classifyContentType, normalizedDocumentSchema } from './schema.js';

export interface ProcessOutcome {
  pageVersionId: number;
  result: 'processed' | 'skipped';
  documentId?: number;
  reason?: string;
  contentType?: string;
}

/**
 * Turn one raw page version into a normalized `documents` row, then hand off to the indexing queue.
 *
 * Pipeline for a single page version (Phase 4):
 *   load raw HTML + source URL → strip boilerplate (Readability/Cheerio) → extract tables + document
 *   links → classify content type → zod-validate → upsert `documents` → enqueue `index`.
 */
export async function processPageVersion(job: Job<ProcessJob>): Promise<ProcessOutcome> {
  const { pageVersionId } = job.data;

  const version = await PageVersion.findByPk(pageVersionId, {
    include: [{ model: Page, as: 'page' }],
  });
  if (!version) {
    // The row was deleted between enqueue and now — nothing to do, and a retry won't help.
    return { pageVersionId, result: 'skipped', reason: 'page_version not found' };
  }
  const url = (version.get('page') as Page | undefined)?.url ?? '';

  // 4.1 boilerplate stripping.
  const { title, text, usedReadability } = extractContent(version.rawHtml, url);
  // 4.2 additional content types: tables → JSON, document links.
  const tables = extractTables(version.rawHtml);
  const documentLinks = url ? extractDocumentLinks(version.rawHtml, url) : [];

  // Nothing worth indexing (JS shell with no server HTML, empty page). Skip rather than store an
  // empty document or churn retries — a re-crawl with real content will make a new version.
  if (!text && tables.length === 0 && documentLinks.length === 0) {
    return { pageVersionId, result: 'skipped', reason: 'no extractable content' };
  }

  const contentType = classifyContentType({
    textLength: text.length,
    tableCount: tables.length,
    usedReadability,
  });

  // 4.3 normalize + validate before we touch the DB.
  const normalized = normalizedDocumentSchema.parse({
    title,
    cleanedText: text,
    contentType,
    structuredData: { tables, documentLinks },
  });

  // Upsert keyed by the unique page_version_id: reprocessing a version replaces its document
  // rather than erroring on the unique constraint.
  const [document] = await Document.upsert({
    pageVersionId,
    title: normalized.title,
    cleanedText: normalized.cleanedText,
    contentType: normalized.contentType,
    structuredData: normalized.structuredData,
  });

  // 4.4 hand off to the indexing worker (Phase 5: chunk + embed).
  await enqueue('index', { documentId: document.id });

  return {
    pageVersionId,
    result: 'processed',
    documentId: document.id,
    contentType: normalized.contentType,
  };
}
