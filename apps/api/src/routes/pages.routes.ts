import { Router } from 'express';
import { Document, Page, PageVersion, Site } from '@rag/db';
import { Op, col, fn, type FindAttributeOptions, type WhereOptions } from 'sequelize';
import { ApiError, asyncHandler } from '../http/errors.js';
import { parseParams, parseQuery } from '../http/validate.js';
import { idParam, listPagesQuery, rawPageQuery } from '../schemas.js';

export const pagesRouter = Router();

// Version metadata without the HTML body: raw_html rows can be megabytes, so the list view returns
// only sizes and hashes and leaves the payload to /pages/:id/raw.
const VERSION_SUMMARY_ATTRS: FindAttributeOptions = [
  'id',
  'versionNo',
  'contentHash',
  'fetchedAt',
  [fn('length', col('raw_html')), 'rawHtmlLength'],
];

/** 6.2 — GET /api/pages: paginated raw-crawl index, filterable by site, status and URL substring. */
pagesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, siteId, status, q } = parseQuery(req, listPagesQuery);

    const where: WhereOptions = {
      ...(siteId ? { siteId } : {}),
      ...(status ? { status } : {}),
      ...(q ? { url: { [Op.iLike]: `%${q}%` } } : {}),
    };

    const { rows, count } = await Page.findAndCountAll({
      where,
      include: [{ model: Site, as: 'site', attributes: ['id', 'name', 'baseUrl'] }],
      order: [['id', 'DESC']],
      limit,
      offset,
    });

    res.json({ data: rows, meta: { total: count, limit, offset } });
  }),
);

/** GET /api/pages/:id — one page with its full version history (the "no silent overwrite" proof). */
pagesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseParams(req, idParam);
    const page = await Page.findByPk(id, {
      include: [{ model: Site, as: 'site', attributes: ['id', 'name', 'baseUrl', 'renderMode'] }],
    });
    if (!page) throw ApiError.notFound('Page');

    const versions = await PageVersion.findAll({
      where: { pageId: id },
      attributes: VERSION_SUMMARY_ATTRS,
      order: [['versionNo', 'DESC']],
    });

    res.json({ data: { ...page.toJSON(), versions } });
  }),
);

/**
 * 6.2 — GET /api/pages/:id/raw: the raw scraped HTML. Defaults to the newest version; `?version=N`
 * pulls a historical one so a diff between crawls is visible. `?format=html` returns the document
 * itself (handy for eyeballing what the JS renderer actually captured).
 */
pagesRouter.get(
  '/:id/raw',
  asyncHandler(async (req, res) => {
    const { id } = parseParams(req, idParam);
    const { version, format } = parseQuery(req, rawPageQuery);

    const page = await Page.findByPk(id);
    if (!page) throw ApiError.notFound('Page');

    const pageVersion = await PageVersion.findOne({
      where: { pageId: id, ...(version ? { versionNo: version } : {}) },
      order: [['versionNo', 'DESC']],
    });
    if (!pageVersion) {
      throw ApiError.notFound(version ? `Version ${version} of page ${id}` : `Any version of page ${id}`);
    }

    if (format === 'html') {
      // Served as plain text, not text/html: this is untrusted third-party markup and must never
      // be rendered in the browser under our own origin.
      res.type('text/plain; charset=utf-8').send(pageVersion.rawHtml);
      return;
    }

    const document = await Document.findOne({
      where: { pageVersionId: pageVersion.id },
      attributes: ['id'],
    });

    res.json({
      data: {
        pageId: page.id,
        url: page.url,
        versionNo: pageVersion.versionNo,
        contentHash: pageVersion.contentHash,
        fetchedAt: pageVersion.fetchedAt,
        httpStatus: page.httpStatus,
        rawHtml: pageVersion.rawHtml,
        documentId: document?.id ?? null,
      },
    });
  }),
);
