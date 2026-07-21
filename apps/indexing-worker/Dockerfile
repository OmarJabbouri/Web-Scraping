# Build from the repo root: docker build -f apps/indexing-worker/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci
RUN npx turbo run build --filter=@rag/indexing-worker

FROM node:22-alpine
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/package.json /repo/package-lock.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/db/package.json ./packages/db/package.json
COPY --from=build /repo/packages/db/dist ./packages/db/dist
COPY --from=build /repo/apps/indexing-worker/package.json ./apps/indexing-worker/package.json
COPY --from=build /repo/apps/indexing-worker/dist ./apps/indexing-worker/dist
CMD ["node", "apps/indexing-worker/dist/index.js"]
