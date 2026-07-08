# syntax=docker/dockerfile:1

FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/platform/package.json apps/platform/
COPY packages/agent-core/package.json packages/agent-core/
COPY packages/ai-gateway/package.json packages/ai-gateway/
COPY packages/block-registry/package.json packages/block-registry/
COPY packages/shared/package.json packages/shared/
COPY packages/sandbox-client/package.json packages/sandbox-client/
COPY packages/sandbox-provisioner/package.json packages/sandbox-provisioner/
RUN pnpm install --frozen-lockfile --filter @app/platform...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @app/platform... build

FROM base AS deploy
COPY --from=build /app .
RUN pnpm --filter @app/platform deploy --prod /prod/platform \
 && find /prod/platform/node_modules -path '*/@app/*/package.json' -exec \
      sed -i -e 's|\./src/|\./dist/|g' -e 's|\.ts"|\.js"|g' {} +

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

COPY --from=deploy /prod/platform/ .
COPY --from=build /app/apps/platform/src/public ./src/public

RUN chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
