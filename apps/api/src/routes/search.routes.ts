import { Router } from 'express';
import { search } from '@rag/rag';
import { asyncHandler } from '../http/errors.js';
import { parseQuery } from '../http/validate.js';
import { searchQuery } from '../schemas.js';

export const searchRouter = Router();

/**
 * 6.4 — GET /api/search?q=&mode=keyword|semantic|hybrid&k=
 *
 * One endpoint over all three retrieval strategies (Phase 5.3/5.4) so the UI can toggle between
 * them and the report can show the measured difference: semantic wins on paraphrased questions,
 * keyword on exact terms (names, prices, codes), hybrid RRF hedges between the two.
 *
 * `took` is returned because the latency gap is part of the story — the keyword arm hits a GIN
 * index locally, the semantic arm pays for an embedding round-trip first.
 */
searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, mode, k } = parseQuery(req, searchQuery);

    const startedAt = Date.now();
    const results = await search(q, mode, k);

    res.json({
      data: results,
      meta: { query: q, mode, k, count: results.length, tookMs: Date.now() - startedAt },
    });
  }),
);
