import { z } from 'zod';

/**
 * Typed job payloads for every queue in the pipeline.
 *
 * We define each payload as a zod schema and derive the TypeScript type from it. That gives us
 * one source of truth used two ways: producers/consumers get compile-time types, and a worker can
 * `parse()` an incoming job at runtime — jobs live in Redis and may outlive a code change, so we
 * validate rather than trust the shape blindly.
 */

// scrape: fetch one URL. `depth` drives the crawl-depth limit (Phase 3.7); enqueued links carry
// depth + 1. The worker looks the site up by id to pick render mode and crawl delay.
export const scrapeJobSchema = z.object({
  siteId: z.number().int().positive(),
  url: z.string().url(),
  depth: z.number().int().min(0).default(0),
  // Set when the URL belongs to a tracked crawl run — lets the worker bump that session's
  // progress counters and enforce its page budget (Phase 3.7).
  sessionId: z.number().int().positive().optional(),
});
export type ScrapeJob = z.infer<typeof scrapeJobSchema>;

// process: clean + normalize the raw HTML captured in a specific page version (Phase 4).
export const processJobSchema = z.object({
  pageVersionId: z.number().int().positive(),
});
export type ProcessJob = z.infer<typeof processJobSchema>;

// index: chunk + embed one processed document into pgvector (Phase 5).
export const indexJobSchema = z.object({
  documentId: z.number().int().positive(),
});
export type IndexJob = z.infer<typeof indexJobSchema>;

/**
 * Map of queue name → payload type. Keeping this in one place lets the queue/worker helpers be
 * generic over the queue name while staying fully typed (see queues.ts / worker.ts).
 */
export interface JobPayloads {
  scrape: ScrapeJob;
  process: ProcessJob;
  index: IndexJob;
}

export const jobSchemas = {
  scrape: scrapeJobSchema,
  process: processJobSchema,
  index: indexJobSchema,
} as const;
