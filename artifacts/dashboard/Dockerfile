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


# ── Stage 2: build the Vite SPA ──────────────────────────────────────────────
FROM deps AS build

# Copy lib source needed by the dashboard (api-client-react is a direct dep)
COPY lib/ ./lib/
COPY artifacts/dashboard/ ./artifacts/dashboard/

# Provide defaults so vite.config.ts doesn't throw outside Replit
ENV PORT=3000
ENV BASE_PATH=/

RUN pnpm --filter @workspace/dashboard run build


# ── Stage 3: serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /workspace/artifacts/dashboard/dist/public /usr/share/nginx/html
COPY artifacts/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
