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
RUN pnpm --filter @app/platform build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3001
RUN useradd -m -u 1000 platform
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/platform/dist ./apps/platform/dist
COPY --from=build /app/apps/platform/package.json ./apps/platform/package.json
COPY apps/platform/src/public ./apps/platform/src/public

RUN chown -R platform:platform /app
USER platform
EXPOSE 3001
CMD ["node", "apps/platform/dist/server.js"]
