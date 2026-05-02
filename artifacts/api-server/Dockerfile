# Build context must be the workspace root (SocietyOps/).
# In docker-compose: build.context: .

# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN npm install -g pnpm
WORKDIR /workspace

# Workspace root manifests (.npmrc must come first — sets musl arch before install)
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

RUN pnpm --filter @workspace/api-server run build


# ── Stage 3: lean runtime image ──────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

COPY --from=build /workspace/artifacts/api-server/dist/ ./dist/

ENV PORT=3001
EXPOSE 3001
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
