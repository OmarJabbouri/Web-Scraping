import { Router } from 'express';
import { generateAnswer, hybridSearch, multiHybridSearch } from '@rag/rag';
import { asyncHandler } from '../http/errors.js';
import { parseBody } from '../http/validate.js';
import { askBody } from '../schemas.js';

export const askRouter = Router();

/**
 * 6.5 — POST /api/ask: the grounded question-answering endpoint.
 *
 * Retrieve → generate → cite. The model only ever sees the retrieved chunks and is instructed to
 * answer from them alone, so every response carries `citations` mapping each inline `[n]` marker
 * back to the exact source URL it came from — the auditable-answer requirement.
 *
 * POST rather than GET: questions can be long, and this is the one endpoint with a real cost and
 * side effect (an LLM call), so it should not be cacheable or triggerable by a bare link.
 */
askRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { question, k, subQueries } = parseBody(req, askBody);

    const startedAt = Date.now();
    // Multi-query retrieval when the caller split the question into intents (5.6): each sub-query
    // retrieves independently and the lists are RRF-fused, so an answer can span several sites
    // instead of collapsing onto whichever intent dominated a single averaged embedding.
    const chunks = subQueries?.length
      ? await multiHybridSearch(subQueries, Math.max(k, subQueries.length * 2))
      : await hybridSearch(question, k);

    const answer = await generateAnswer(question, chunks);

    res.json({
      data: answer,
      meta: {
        question,
        k,
        subQueries: subQueries ?? null,
        retrieved: chunks.length,
        sources: [...new Set(answer.citations.map((c) => c.url))].length,
        tookMs: Date.now() - startedAt,
      },
    });
  }),
);
