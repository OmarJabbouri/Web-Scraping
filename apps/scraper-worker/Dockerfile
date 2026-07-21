# Build from the repo root: docker build -f apps/scraper-worker/Dockerfile .
# Debian slim (not alpine) so Playwright's Chromium deps can be installed in Phase 3:
#   RUN npx playwright install --with-deps chromium
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY . .
RUN npm ci
RUN npx turbo run build --filter=@rag/scraper-worker

FROM node:22-bookworm-slim
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/package.json /repo/package-lock.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/db/package.json ./packages/db/package.json
COPY --from=build /repo/packages/db/dist ./packages/db/dist
COPY --from=build /repo/apps/scraper-worker/package.json ./apps/scraper-worker/package.json
COPY --from=build /repo/apps/scraper-worker/dist ./apps/scraper-worker/dist
# The JS fetcher (jsFetcher) needs a real Chromium + its system libraries. `--with-deps` installs
# both, so js-rendered sites (e.g. quotes.toscrape.com/js) work inside the container.
RUN npx playwright install --with-deps chromium
CMD ["node", "apps/scraper-worker/dist/index.js"]
