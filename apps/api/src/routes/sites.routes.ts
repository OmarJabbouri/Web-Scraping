import { Router } from 'express';
import { CrawlSession, Site, sequelize } from '@rag/db';
import { QueryTypes } from 'sequelize';
import { ApiError, asyncHandler } from '../http/errors.js';
import { parseBody, parseParams } from '../http/validate.js';
import { idParam, startCrawlBody } from '../schemas.js';
import { startCrawl } from '../services/crawl.service.js';

export const sitesRouter = Router();

interface SiteCountRow {
  siteId: number;
  pageCount: number;
  crawledCount: number;
}

/** Page tallies for every site in one grouped query — avoids an N+1 count per site. */
async function pageCounts(): Promise<Map<number, SiteCountRow>> {
  const rows = await sequelize.query<SiteCountRow>(
    `SELECT site_id AS "siteId",
            COUNT(*)::int AS "pageCount",
            COUNT(*) FILTER (WHERE status = 'crawled')::int AS "crawledCount"
     FROM pages GROUP BY site_id`,
    { type: QueryTypes.SELECT },
  );
  return new Map(rows.map((r) => [r.siteId, r]));
}

/** 6.1 — GET /api/sites: the configured crawl targets plus how much of each we hold. */
sitesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [sites, counts] = await Promise.all([
      Site.findAll({ order: [['id', 'ASC']] }),
      pageCounts(),
    ]);
    res.json({
      data: sites.map((site) => ({
        ...site.toJSON(),
        robotsTxt: undefined, // can be many KB — fetch the single-site route for it
        robotsTxtCached: site.robotsTxt !== null,
        pageCount: counts.get(site.id)?.pageCount ?? 0,
        crawledCount: counts.get(site.id)?.crawledCount ?? 0,
      })),
    });
  }),
);

/** GET /api/sites/:id — one site with its cached robots.txt and recent crawl runs. */
sitesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseParams(req, idParam);
    const site = await Site.findByPk(id);
    if (!site) throw ApiError.notFound('Site');

    const sessions = await CrawlSession.findAll({
      where: { siteId: id },
      order: [['id', 'DESC']],
      limit: 10,
    });
    res.json({ data: { ...site.toJSON(), crawlSessions: sessions } });
  }),
);

/** GET /api/sites/:id/crawls — crawl-session history, the UI's progress feed. */
sitesRouter.get(
  '/:id/crawls',
  asyncHandler(async (req, res) => {
    const { id } = parseParams(req, idParam);
    const sessions = await CrawlSession.findAll({
      where: { siteId: id },
      order: [['id', 'DESC']],
      limit: 50,
    });
    res.json({ data: sessions });
  }),
);

/**
 * 6.1 — POST /api/sites/:id/crawl: enqueue the site's base URL and return immediately with the
 * session id. 202 (not 200) because the crawl itself happens asynchronously on the workers; the
 * caller polls `/api/sites/:id/crawls` or `/api/stats` for progress.
 */
sitesRouter.post(
  '/:id/crawl',
  asyncHandler(async (req, res) => {
    const { id } = parseParams(req, idParam);
    const body = parseBody(req, startCrawlBody);
    const site = await Site.findByPk(id);
    if (!site) throw ApiError.notFound('Site');
    // Honour the operator's own kill switch: `allowed=false` means we decided not to crawl this
    // domain (robots.txt/ToS), so the API must not be a way around that decision.
    if (!site.allowed) throw new ApiError(403, `Crawling is disabled for site ${site.name}`);

    const session = await startCrawl(site, body);
    res.status(202).json({
      data: {
        sessionId: session.id,
        siteId: site.id,
        seedUrl: site.baseUrl,
        maxDepth: session.maxDepth,
        maxPages: session.maxPages,
        status: session.status,
      },
    });
  }),
);
