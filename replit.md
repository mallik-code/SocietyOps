# Workspace

## Overview

pnpm workspace monorepo (TypeScript) plus a standalone Python FastAPI service for complaint management.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework (Node)**: Express 5
- **Database (Node)**: PostgreSQL + Drizzle ORM
- **Validation (Node)**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Replit AI Integrations (OpenAI proxy) — `gpt-5.4`, SSE streaming

## Key Commands (Node/TypeScript)

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

---

## Dashboard (`apps/dashboard`)

React + Vite SPA at `/dashboard/`. Four pages:

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard/` | Dashboard | KPI cards, charts, tickets table, activity feed |
| `/dashboard/policies` | Policies | WhatsApp group + contact tracking config |
| `/dashboard/connect` | Connect | WhatsApp QR pairing + Telegram bot setup |
| `/dashboard/ai` | AI Assistant | Chat UI backed by GPT via SSE streaming |

---

## API Server (`apps/api-server`)

Express 5 server at `/api/`. Routes:

| Prefix | File | Description |
|--------|------|-------------|
| `/api/healthz` | `health.ts` | Health check |
| `/api/dashboard/*` | `dashboard.ts` | Stats, charts, tickets, WA status, activity |
| `/api/tickets/*` | `dashboard.ts` | Ticket CRUD + status PATCH |
| `/api/policies/*` | `policies.ts` | Tracked groups + contacts CRUD |
| `/api/connect/*` | `connect.ts` | WhatsApp QR pairing + Telegram bot setup |
| `/api/ai/*` | `ai.ts` | Conversations CRUD + GPT SSE chat endpoint |

### AI Integration

- **Provider**: Replit AI Integrations (OpenAI proxy)
- **Env vars**: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` (auto-provisioned)
- **Model**: `gpt-5.4`
- **Streaming**: SSE via `POST /api/ai/chat`
- **Persistence**: `conversations` + `messages` tables in PostgreSQL (Drizzle ORM)
- **System prompt**: Pre-configured for building complaint management context; overridable per-session

### DB Tables

| Table | Purpose |
|-------|---------|
| `conversations` | AI chat conversation sessions |
| `messages` | Per-message history (user + assistant roles) |

---

## Libs

| Package | Purpose |
|---------|---------|
| `@workspace/api-spec` | OpenAPI spec + Orval codegen config |
| `@workspace/api-client-react` | Generated React Query hooks |
| `@workspace/api-zod` | Generated Zod validation schemas |
| `@workspace/db` | Drizzle ORM schema + client |
| `@workspace/integrations-openai-ai-server` | OpenAI SDK client (server-side) |
| `@workspace/integrations-openai-ai-react` | OpenAI React hooks (voice, audio) |

---

## Complaint Management Service (`complaint-service/`)

Standalone Python FastAPI service for AI-powered WhatsApp complaint management.

### Stack
- **Language**: Python 3.12
- **Framework**: FastAPI + Uvicorn
- **Database**: SQLite (via SQLAlchemy 2.x ORM)
- **Validation**: Pydantic v2
- **AI**: OpenAI GPT (optional) with keyword-based fallback classifier
- **Container**: Docker + Docker Compose

### Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/webhook/message` | Receive WhatsApp message from Evolution API |
| GET | `/tickets` | List/filter tickets |
| PATCH | `/tickets/{id}` | Update ticket status/priority |
| POST | `/supervisor/actions` | Log supervisor action |
| GET | `/reports/daily` | Daily aggregate report |
| GET | `/docs` | Swagger UI |
