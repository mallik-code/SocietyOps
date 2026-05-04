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
COPY apps/api-server/package.json        ./apps/api-server/
COPY apps/dashboard/package.json         ./apps/dashboard/
COPY apps/mockup-sandbox/package.json    ./apps/mockup-sandbox/

RUN pnpm install --no-frozen-lockfile


# ── Stage 2: build the api-server bundle ─────────────────────────────────────
FROM deps AS build

COPY lib/ ./lib/
COPY apps/api-server/ ./apps/api-server/
COPY tsconfig.base.json ./

RUN pnpm --filter @workspace/api-server run build
# Copy CSV data files into dist so they are available at runtime
RUN mkdir -p /workspace/apps/api-server/dist/data && \
    cp /workspace/apps/api-server/src/data/*.csv \
       /workspace/apps/api-server/dist/data/


# ── Stage 3: lean runtime image ──────────────────────────────────────────────
FROM node:22-slim
RUN corepack enable
WORKDIR /workspace/apps/api-server

# Copy bundle and data
COPY --from=build /workspace/apps/api-server/dist/ ./dist/
COPY --from=build /workspace/apps/api-server/dist/data/ ./dist/data/

# Copy workspace root manifests and lockfile for prod install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /workspace/
COPY apps/api-server/package.json ./package.json

# Install only production dependencies for the api-server
# We need this for native modules like @napi-rs/canvas which can't be bundled
RUN cd /workspace && pnpm install --prod --filter @workspace/api-server

ENV PORT=3001
EXPOSE 3001
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
