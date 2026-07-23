import { Router } from 'express';
import { CrawlSession, Site, sequelize } from '@rag/db';
import { getAllQueues } from '@rag/shared';
import { QueryTypes } from 'sequelize';
import { asyncHandler } from '../http/errors.js';

export const statsRouter = Router();

interface TotalsRow {
  sites: number;
  pages: number;
  pagesCrawled: number;
  pagesFailed: number;
  pagesSkipped: number;
  pagesPending: number;
  pageVersions: number;
  documents: number;
  chunks: number;
  chunksEmbedded: number;
  deadLetterJobs: number;
}

// One round-trip for the whole dashboard instead of ten COUNT queries — the UI polls this.
const TOTALS_SQL = `
  SELECT
    (SELECT COUNT(*) FROM sites)::int AS "sites",
    (SELECT COUNT(*) FROM pages)::int AS "pages",
    (SELECT COUNT(*) FROM pages WHERE status = 'crawled')::int AS "pagesCrawled",
    (SELECT COUNT(*) FROM pages WHERE status = 'failed')::int AS "pagesFailed",
    (SELECT COUNT(*) FROM pages WHERE status = 'skipped')::int AS "pagesSkipped",
    (SELECT COUNT(*) FROM pages WHERE status = 'pending')::int AS "pagesPending",
    (SELECT COUNT(*) FROM page_versions)::int AS "pageVersions",
    (SELECT COUNT(*) FROM documents)::int AS "documents",
    (SELECT COUNT(*) FROM chunks)::int AS "chunks",
    (SELECT COUNT(*) FROM chunks WHERE embedding IS NOT NULL)::int AS "chunksEmbedded",
    (SELECT COUNT(*) FROM failed_jobs)::int AS "deadLetterJobs"
`;

/**
 * 6.6 — GET /api/stats: everything the dashboard needs in one poll — live queue depths straight
 * from Redis (scrape/process/index + dead-letter) and the pipeline totals from Postgres.
 *
 * Reading queue depth here is also what makes the demos legible: during a scaling run the `scrape`
 * queue drains visibly faster with more workers, and a killed worker shows its job return to
 * `active` on another instance rather than disappearing.
 */
statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const queues = getAllQueues();

    const [totalsRows, queueCounts, recentSessions] = await Promise.all([
      sequelize.query<TotalsRow>(TOTALS_SQL, { type: QueryTypes.SELECT }),
      Promise.all(
        queues.map(async (queue) => ({
          name: queue.name,
          counts: await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
        })),
      ),
      CrawlSession.findAll({
        order: [['id', 'DESC']],
        limit: 5,
        include: [{ model: Site, as: 'site', attributes: ['id', 'name', 'baseUrl'] }],
      }),
    ]);

    res.json({
      data: {
        totals: totalsRows[0] ?? null,
        queues: queueCounts,
        recentCrawls: recentSessions,
      },
    });
  }),
);
