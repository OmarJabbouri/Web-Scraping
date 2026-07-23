import express, { type Express, type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getAllQueues, type Config, type Redis } from '@rag/shared';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { openApiDocument } from './openapi.js';
import { askRouter } from './routes/ask.routes.js';
import { documentsRouter } from './routes/documents.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import { pagesRouter } from './routes/pages.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { sitesRouter } from './routes/sites.routes.js';
import { statsRouter } from './routes/stats.routes.js';

/** Rate limiters (6.7). Two tiers: cheap DB reads vs. the endpoint that spends money per call. */
function createLimiters() {
  const json = (message: string): RequestHandler => (_req, res) => {
    res.status(429).json({ error: { message } });
  };

  return {
    general: rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: json('Too many requests — slow down.'),
    }),
    // Each /ask hits the embedding API and the LLM, so it is both the slowest and the only
    // endpoint with a per-request cost. A tighter budget protects the API key, not the server.
    ask: rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: json('Too many questions — the RAG endpoint is rate limited.'),
    }),
  };
}

// The Bull Board and Swagger UIs poll their own APIs every few seconds; logging every poll drowns
// out the real API traffic in the console. Skip those mounts (and favicon) in the logger.
const LOG_SKIP = /^\/(admin\/queues|api\/docs|favicon)/;

/** Minimal request log — enough to narrate the demo without pulling in a logging framework. */
const requestLogger: RequestHandler = (req, res, next) => {
  if (LOG_SKIP.test(req.path)) return next();
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
};

/**
 * Build the Express app. Takes its dependencies as arguments (config + a Redis handle) rather than
 * reaching for globals, so the app is constructible in a test without opening real connections.
 */
export function createApp(config: Config, redis: Redis): Express {
  const app = express();
  const limiters = createLimiters();

  // CSP is disabled because two mounted UIs (Bull Board and Swagger UI) serve their own inline
  // assets; the rest of helmet's headers still apply. This API returns JSON, not user-facing HTML.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  app.use(['/health', '/api/health'], createHealthRouter(redis, config.NODE_ENV));

  // Bull Board (task 2.5): live view of every queue — depth, active/completed/failed, retries and
  // the dead-letter queue. This is what makes the scaling and worker-crash demos visible.
  const bullBoardAdapter = new ExpressAdapter();
  bullBoardAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: getAllQueues().map((queue) => new BullMQAdapter(queue)),
    serverAdapter: bullBoardAdapter,
  });
  app.use('/admin/queues', bullBoardAdapter.getRouter());

  // 6.7 — interactive API docs.
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use('/api', limiters.general);
  app.use('/api/sites', sitesRouter);
  app.use('/api/pages', pagesRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/ask', limiters.ask, askRouter);
  app.use('/api/stats', statsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
