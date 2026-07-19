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
| `packages/db` | Sequelize models + migrations/seeders (pgvector schema) |

## Local development

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis   # infra only, as images
npm run db:migrate                    # apply schema (packages/db/migrations)
npm run db:seed                       # seed the 3 target sites
npm run dev                           # turbo runs all dev tasks
```

Postgres runs on host port `5433` (not the default `5432`) to avoid clashing with a
native Postgres install — see the comment in `docker-compose.yml` if you need to change it.

### Database commands

```bash
npm run db:migrate          # apply pending migrations
npm run db:migrate:undo     # roll back the last migration
npm run db:migrate:status   # list migration state
npm run db:seed             # run seeders
npm run db:seed:undo        # undo seeders
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
