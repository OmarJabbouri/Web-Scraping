/**
 * 6.7 — OpenAPI 3.0 description of the API, served as JSON at `/api/openapi.json` and rendered by
 * Swagger UI at `/api/docs`. Hand-written rather than generated: the zod schemas in `schemas.ts`
 * are the runtime contract, and a generator would have added a dependency and a build step for a
 * surface this small. Keep the two in sync when adding a parameter.
 */

const okEnvelope = (itemsRef: string) => ({
  type: 'object',
  properties: { data: { type: 'array', items: { $ref: itemsRef } } },
});

const paginationParams = [
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
  { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
];

const idPath = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer', minimum: 1 },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Distributed RAG Web Scraper API',
    version: '1.0.0',
    description:
      'Read access to every stage of the pipeline (raw pages → processed documents → indexed ' +
      'chunks), keyword/semantic/hybrid search, and a grounded question-answering endpoint that ' +
      'cites the source URLs its answer came from.',
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'sites', description: 'Crawl targets and crawl runs' },
    { name: 'pages', description: 'Raw scraped data and version history' },
    { name: 'documents', description: 'Cleaned + normalized content' },
    { name: 'search', description: 'Keyword, semantic and hybrid retrieval' },
    { name: 'rag', description: 'Grounded question answering with citations' },
    { name: 'ops', description: 'Health and pipeline statistics' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['ops'],
        summary: 'Liveness/readiness probe',
        responses: { '200': { description: 'Service status, plus Postgres and Redis reachability' } },
      },
    },
    '/api/stats': {
      get: {
        tags: ['ops'],
        summary: 'Queue depths and pipeline totals (dashboard poll)',
        responses: { '200': { description: 'Queue counts, DB totals and recent crawl sessions' } },
      },
    },
    '/api/sites': {
      get: {
        tags: ['sites'],
        summary: 'List configured crawl targets',
        responses: {
          '200': {
            description: 'Sites with page counts',
            content: { 'application/json': { schema: okEnvelope('#/components/schemas/Site') } },
          },
        },
      },
    },
    '/api/sites/{id}': {
      get: {
        tags: ['sites'],
        summary: 'One site, its cached robots.txt and recent crawls',
        parameters: [idPath],
        responses: { '200': { description: 'Site' }, '404': { description: 'Not found' } },
      },
    },
    '/api/sites/{id}/crawls': {
      get: {
        tags: ['sites'],
        summary: 'Crawl-session history for a site',
        parameters: [idPath],
        responses: { '200': { description: 'Crawl sessions' } },
      },
    },
    '/api/sites/{id}/crawl': {
      post: {
        tags: ['sites'],
        summary: 'Start a crawl (enqueues the seed URL for the worker fleet)',
        parameters: [idPath],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  maxDepth: { type: 'integer', minimum: 0, maximum: 10 },
                  maxPages: { type: 'integer', minimum: 1, maximum: 5000 },
                },
              },
            },
          },
        },
        responses: {
          '202': { description: 'Crawl session created and seed job enqueued' },
          '403': { description: 'Crawling disabled for this site' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/api/pages': {
      get: {
        tags: ['pages'],
        summary: 'List crawled pages',
        parameters: [
          ...paginationParams,
          { name: 'siteId', in: 'query', schema: { type: 'integer' } },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['pending', 'crawled', 'failed', 'skipped'] },
          },
          { name: 'q', in: 'query', description: 'URL substring', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated pages' } },
      },
    },
    '/api/pages/{id}': {
      get: {
        tags: ['pages'],
        summary: 'One page with its full version history',
        parameters: [idPath],
        responses: { '200': { description: 'Page + versions' }, '404': { description: 'Not found' } },
      },
    },
    '/api/pages/{id}/raw': {
      get: {
        tags: ['pages'],
        summary: 'Raw scraped HTML (latest version by default)',
        parameters: [
          idPath,
          { name: 'version', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'html'], default: 'json' } },
        ],
        responses: { '200': { description: 'Raw HTML' }, '404': { description: 'Not found' } },
      },
    },
    '/api/documents': {
      get: {
        tags: ['documents'],
        summary: 'List processed documents (excerpt only)',
        parameters: [
          ...paginationParams,
          { name: 'siteId', in: 'query', schema: { type: 'integer' } },
          { name: 'contentType', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', description: 'Title/body substring', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated documents' } },
      },
    },
    '/api/documents/{id}': {
      get: {
        tags: ['documents'],
        summary: 'Full processed document, structured data and its chunks',
        parameters: [idPath],
        responses: { '200': { description: 'Document' }, '404': { description: 'Not found' } },
      },
    },
    '/api/search': {
      get: {
        tags: ['search'],
        summary: 'Search indexed chunks',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          {
            name: 'mode',
            in: 'query',
            schema: { type: 'string', enum: ['keyword', 'semantic', 'hybrid'], default: 'hybrid' },
          },
          { name: 'k', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 } },
        ],
        responses: {
          '200': {
            description: 'Ranked chunks with their source URLs',
            content: {
              'application/json': { schema: okEnvelope('#/components/schemas/RetrievedChunk') },
            },
          },
        },
      },
    },
    '/api/ask': {
      post: {
        tags: ['rag'],
        summary: 'Grounded answer with citations',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['question'],
                properties: {
                  question: { type: 'string', minLength: 3, maxLength: 1000 },
                  k: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
                  subQueries: {
                    type: 'array',
                    maxItems: 5,
                    items: { type: 'string' },
                    description:
                      'Split a multi-intent question into sub-queries to retrieve for each intent ' +
                      'separately (multi-query RRF) — how one answer spans multiple sites.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Answer plus the sources it cites',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RagAnswer' } } },
          },
          '429': { description: 'Rate limited (this endpoint calls the LLM)' },
        },
      },
    },
  },
  components: {
    schemas: {
      Site: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          baseUrl: { type: 'string' },
          renderMode: { type: 'string', enum: ['static', 'js'] },
          crawlDelayMs: { type: 'integer' },
          allowed: { type: 'boolean' },
          pageCount: { type: 'integer' },
          crawledCount: { type: 'integer' },
        },
      },
      RetrievedChunk: {
        type: 'object',
        properties: {
          chunkId: { type: 'integer' },
          documentId: { type: 'integer' },
          url: { type: 'string' },
          title: { type: 'string', nullable: true },
          headingPath: { type: 'string', nullable: true },
          text: { type: 'string' },
          score: { type: 'number' },
        },
      },
      RagAnswer: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              answer: { type: 'string' },
              citations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    marker: { type: 'integer' },
                    url: { type: 'string' },
                    title: { type: 'string', nullable: true },
                    snippet: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'object', properties: { message: { type: 'string' }, details: {} } },
        },
      },
    },
  },
} as const;
