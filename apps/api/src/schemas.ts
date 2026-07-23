import { z } from 'zod';

/**
 * Every request shape the API accepts, in one place (task 6.7). Query strings are always strings,
 * so numeric/boolean fields are coerced here and clamped — `limit` is capped at 100 so a client
 * cannot ask for the whole `pages` table in one response.
 */

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const pageStatus = z.enum(['pending', 'crawled', 'failed', 'skipped']);

export const listPagesQuery = pagination.extend({
  siteId: z.coerce.number().int().positive().optional(),
  status: pageStatus.optional(),
  /** Substring match on the URL. */
  q: z.string().trim().min(1).max(500).optional(),
});

export const listDocumentsQuery = pagination.extend({
  siteId: z.coerce.number().int().positive().optional(),
  contentType: z.string().trim().min(1).max(50).optional(),
  q: z.string().trim().min(1).max(500).optional(),
});

/** `?format=html` streams the stored HTML back as-is; the default wraps it in the JSON envelope. */
export const rawPageQuery = z.object({
  version: z.coerce.number().int().positive().optional(),
  format: z.enum(['json', 'html']).default('json'),
});

export const searchQuery = z.object({
  q: z.string().trim().min(1, 'q is required').max(1000),
  mode: z.enum(['keyword', 'semantic', 'hybrid']).default('hybrid'),
  k: z.coerce.number().int().min(1).max(50).default(5),
});

/**
 * `subQueries` is what makes multi-source synthesis (5.6) reachable over HTTP: when a question has
 * two disjoint intents, the caller can split them and the API retrieves for each one separately
 * (multi-query RRF) instead of averaging both into one embedding that matches neither well.
 */
export const askBody = z.object({
  question: z.string().trim().min(3, 'question is too short').max(1000),
  k: z.coerce.number().int().min(1).max(20).default(5),
  subQueries: z.array(z.string().trim().min(1).max(500)).min(1).max(5).optional(),
});

export const startCrawlBody = z
  .object({
    maxDepth: z.coerce.number().int().min(0).max(10).optional(),
    maxPages: z.coerce.number().int().min(1).max(5000).optional(),
  })
  .default({});

export type Pagination = z.infer<typeof pagination>;
export type ListPagesQuery = z.infer<typeof listPagesQuery>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuery>;
export type SearchQuery = z.infer<typeof searchQuery>;
export type AskBody = z.infer<typeof askBody>;
export type StartCrawlBody = z.infer<typeof startCrawlBody>;
