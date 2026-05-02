# Build context must be the workspace root (SocietyOps/).
# In docker-compose: build.context: .

# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:22-slim AS deps
RUN corepack enable
WORKDIR /workspace

# Workspace root manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# All workspace package manifests — pnpm needs these to resolve workspace:* links
COPY lib/api-client-react/package.json        ./lib/api-client-react/
COPY lib/api-spec/package.json                ./lib/api-spec/
COPY lib/api-zod/package.json                 ./lib/api-zod/
COPY lib/db/package.json                      ./lib/db/
COPY lib/integrations-openai-ai-react/package.json   ./lib/integrations-openai-ai-react/
COPY lib/integrations-openai-ai-server/package.json  ./lib/integrations-openai-ai-server/
COPY scripts/package.json                     ./scripts/
COPY artifacts/api-server/package.json        ./artifacts/api-server/
COPY artifacts/dashboard/package.json         ./artifacts/dashboard/
COPY artifacts/mockup-sandbox/package.json    ./artifacts/mockup-sandbox/

RUN pnpm install --frozen-lockfile


# ── Stage 2: build the api-server bundle ─────────────────────────────────────
FROM deps AS build

COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY tsconfig.base.json ./

RUN pnpm --filter @workspace/api-server run build
# Copy CSV data files into dist so they are available at runtime
RUN mkdir -p /workspace/artifacts/api-server/dist/data && \
    cp /workspace/artifacts/api-server/src/data/*.csv \
       /workspace/artifacts/api-server/dist/data/


# ── Stage 3: lean runtime image ──────────────────────────────────────────────
FROM node:22-slim
# Match the build-stage path so esbuild-plugin-pino's baked-in absolute worker
# paths (/workspace/artifacts/api-server/dist/thread-stream-worker.mjs) resolve correctly.
WORKDIR /workspace/artifacts/api-server

COPY --from=build /workspace/artifacts/api-server/dist/ ./dist/
COPY --from=build /workspace/artifacts/api-server/dist/data/ ./dist/data/

ENV PORT=3001
EXPOSE 3001
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
