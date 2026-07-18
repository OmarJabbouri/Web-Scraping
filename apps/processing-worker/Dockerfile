# Build from the repo root: docker build -f apps/processing-worker/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci
RUN npx turbo run build --filter=@rag/processing-worker

FROM node:22-alpine
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/package.json /repo/package-lock.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/apps/processing-worker/package.json ./apps/processing-worker/package.json
COPY --from=build /repo/apps/processing-worker/dist ./apps/processing-worker/dist
CMD ["node", "apps/processing-worker/dist/index.js"]
