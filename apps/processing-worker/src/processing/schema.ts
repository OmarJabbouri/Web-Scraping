import { z } from 'zod';
import type { ExtractedTable } from './tables.js';
import type { DocumentLink } from './links.js';

/**
 * 4.3 — the normalized shape we validate before inserting into `documents`.
 *
 * Jobs are processed by whatever worker build happens to be running, and extraction is best-effort
 * over messy real-world HTML — so we validate the assembled record against a zod schema and fail
 * loudly rather than write a malformed row. Mirrors the runtime-validation approach used for queue
 * payloads (packages/shared payloads.ts).
 */

export const tableSchema: z.ZodType<ExtractedTable> = z.object({
  caption: z.string().nullable(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const documentLinkSchema: z.ZodType<DocumentLink> = z.object({
  url: z.string().url(),
  text: z.string(),
  type: z.string(),
});

// Must match the ContentType union on the Document model.
export const contentTypeSchema = z.enum(['article', 'listing', 'table', 'mixed']);
export type ContentType = z.infer<typeof contentTypeSchema>;

export const structuredDataSchema = z.object({
  tables: z.array(tableSchema),
  documentLinks: z.array(documentLinkSchema),
});

export const normalizedDocumentSchema = z.object({
  title: z.string().nullable(),
  cleanedText: z.string(),
  contentType: contentTypeSchema,
  structuredData: structuredDataSchema,
});
export type NormalizedDocument = z.infer<typeof normalizedDocumentSchema>;

/**
 * Classify a page by which content types actually carry weight — this feeds retrieval/UX later and
 * is a small, explainable heuristic rather than a model:
 *   - substantial prose *and* data tables ⇒ `mixed`
 *   - dominated by tables with little prose ⇒ `table`
 *   - Readability found no article and there's little prose ⇒ `listing` (index/catalogue page)
 *   - otherwise ⇒ `article`
 */
export function classifyContentType(opts: {
  textLength: number;
  tableCount: number;
  usedReadability: boolean;
}): ContentType {
  const { textLength, tableCount, usedReadability } = opts;
  const hasProse = textLength >= PROSE_MIN_CHARS;

  if (tableCount > 0 && hasProse) return 'mixed';
  if (tableCount > 0 && !hasProse) return 'table';
  if (!usedReadability && !hasProse) return 'listing';
  return 'article';
}

const PROSE_MIN_CHARS = 500;
