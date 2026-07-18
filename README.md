# Distributed RAG-Based Web Scraper

Turborepo monorepo (npm workspaces): TypeScript, Node.js, React, PostgreSQL (pgvector), Redis, BullMQ, Playwright, Docker.

## Layout

| Workspace | Purpose |
|---|---|
| `packages/shared` | Config (zod-validated env), queue definitions, shared types |
| `apps/api` | Express API (crawl triggers, search, RAG Q&A) |
| `apps/scraper-worker` | Fetches pages (static + Playwright), Playwright Docker base |
| `apps/processing-worker` | Cleans/normalizes raw HTML into documents |
| `apps/indexing-worker` | Chunks + embeds documents into pgvector |
| `apps/web` | React (Vite) dashboard/search/ask UI |

## Local development

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis   # infra only, as images
npm run dev                           # turbo runs all dev tasks
```

## Full stack in Docker

Each app has its own Dockerfile; Postgres and Redis run from official images.

```bash
docker compose up --build
docker compose up --scale scraper-worker=4   # horizontal scaling demo
```

- Web UI: http://localhost:8080
- API: http://localhost:3000/health

## Commands

```bash
npm run build      # turbo build all workspaces
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run test       # tests (from Phase 2+)
```

See `TASKS.md` for the full phase breakdown.
