# syntax=docker/dockerfile:1

FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/scaffold/package.json apps/scaffold/
COPY apps/sandbox/package.json apps/sandbox/
COPY packages/agent-core/package.json packages/agent-core/
COPY packages/block-registry/package.json packages/block-registry/
COPY packages/shared/package.json packages/shared/
COPY packages/sandbox-client/package.json packages/sandbox-client/
RUN pnpm install --frozen-lockfile --filter @app/scaffold --filter @app/sandbox...

FROM base AS scaffold-seed
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/scaffold/package.json apps/scaffold/
COPY packages/shared/package.json packages/shared/
COPY apps/scaffold apps/scaffold/
COPY packages/shared packages/shared/
RUN rm -rf apps/scaffold/node_modules packages/shared/node_modules && \
    pnpm install --frozen-lockfile --filter @app/scaffold... && \
    pnpm --filter @app/scaffold deploy /seed-scaffold

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @app/sandbox... build

FROM base AS deploy
COPY --from=build /app .
RUN pnpm --filter @app/sandbox deploy --prod /prod/sandbox \
 && find /prod/sandbox/node_modules -path '*/@app/*/package.json' -exec \
      sed -i -e 's|\./src/|\./dist/|g' -e 's|\.ts"|\.js"|g' {} +

FROM base AS runtime
ENV WORKSPACE_ROOT=/workspace
ENV PORT=3002
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

COPY --from=deploy /prod/sandbox/ .
COPY apps/sandbox/entrypoint.sh /entrypoint.sh
COPY --from=scaffold-seed /seed-scaffold /seed-scaffold

RUN chown -R node:node /app /seed-scaffold && chmod +x /entrypoint.sh
USER node
EXPOSE 3002 5173
ENTRYPOINT ["/entrypoint.sh"]
