import { Router } from 'express';
import { Chunk, Document, Page, PageVersion, Site } from '@rag/db';
import { Op, literal, type FindAttributeOptions, type WhereOptions } from 'sequelize';
import { ApiError, asyncHandler } from '../http/errors.js';
import { parseParams, parseQuery } from '../http/validate.js';
import { idParam, listDocumentsQuery } from '../schemas.js';

export const documentsRouter = Router();

// A document's cleaned_text is the whole article — far too much for a list response. The list
// returns a 300-char excerpt and the length, computed in Postgres so the text never crosses the
// wire. Table-qualified because the query joins page_versions/pages/sites.
const LIST_ATTRS: FindAttributeOptions = [
  'id',
  'pageVersionId',
  'title',
  'contentType',
  'createdAt',
  [literal(`LEFT("Document"."cleaned_text", 300)`), 'excerpt'],
  [literal(`LENGTH("Document"."cleaned_text")`), 'textLength'],
];

/** The join chain every document row needs to report which URL it came from. */
const sourceInclude = (siteId?: number) => [
  {
    model: PageVersion,
    as: 'pageVersion',
    attributes: ['id', 'versionNo', 'fetchedAt'],
    required: true,
    include: [
      {
        model: Page,
        as: 'page',
        attributes: ['id', 'url', 'siteId'],
        required: true,
        ...(siteId ? { where: { siteId } } : {}),
        include: [{ model: Site, as: 'site', attributes: ['id', 'name'], required: false }],
      },
    ],
  },
];

/** 6.3 — GET /api/documents: the cleaned/normalized layer, filterable by site and content type. */
documentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, siteId, contentType, q } = parseQuery(req, listDocumentsQuery);

    const where: WhereOptions = {
      ...(contentType ? { contentType } : {}),
      ...(q
        ? {
            [Op.or]: [
              { title: { [Op.iLike]: `%${q}%` } },
              { cleanedText: { [Op.iLike]: `%${q}%` } },
            ],
          }
        : {}),
    };

    const { rows, count } = await Document.findAndCountAll({
      where,
      attributes: LIST_ATTRS,
      include: sourceInclude(siteId),
      order: [['id', 'DESC']],
      limit,
      offset,
      // Without this the joins multiply the count; `distinct` counts documents, not join rows.
      distinct: true,
    });

    res.json({ data: rows, meta: { total: count, limit, offset } });
  }),
);

/**
 * 6.3 — GET /api/documents/:id: the full processed record — cleaned text plus `structuredData`
 * (extracted tables and document links), which is where the "more than one content type"
 * requirement is visible — plus the chunks this document was indexed into.
 */
documentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseParams(req, idParam);
    const document = await Document.findByPk(id, { include: sourceInclude() });
    if (!document) throw ApiError.notFound('Document');

    const chunks = await Chunk.findAll({
      where: { documentId: id },
      // The 1536-float embedding is useless to a client and huge — never serialize it.
      attributes: ['id', 'chunkIndex', 'headingPath', 'text', 'tokenCount'],
      order: [['chunkIndex', 'ASC']],
    });

    const embedded = await Chunk.count({ where: { documentId: id, embedding: { [Op.ne]: null } } });

    res.json({
      data: {
        ...document.toJSON(),
        chunkCount: chunks.length,
        embeddedChunkCount: embedded,
        chunks,
      },
    });
  }),
);
