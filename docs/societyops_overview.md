# SocietyOps Overview

This document is intended as onboarding context for an LLM or engineer taking new work on SocietyOps. It summarizes the current runtime status, functional product behavior, technical architecture, key code paths, data stores, APIs, and development workflow.

## Current System Status

Snapshot taken from the local workspace on 2026-05-07.

- Workspace: `C:\projects\SocietyOps`
- Git branch: `main`
- Git tracked-file state: clean from `git status --porcelain=v1 -uno`
- Note: `git status --short` emitted a permission warning for `complaint-service/.pytest_cache/`, but no tracked modifications were reported.
- Docker Compose project: `societyops`
- Compose warning: `docker-compose.yml` still includes obsolete top-level `version`.

Running containers:

| Container | Service | Status | Host Port |
|---|---|---|---|
| `complaint_dashboard` | `dashboard` | Up | `3000 -> 80` |
| `complaint_api_server` | `api-server` | Up, healthy | `3001 -> 3001` |
| `complaint_api` | `api` | Up, healthy | `8000 -> 8000` |
| `complaint_evolution` | `evolution` | Up, healthy | `8080 -> 8080` |
| `complaint_knowledge` | `knowledge-service` | Up, healthy | internal `8000` |
| `complaint_postgres` | `postgres` | Up, healthy | internal `5432` |

Health/status checks:

- Express API health: `GET http://localhost:3001/api/healthz` returned `{ "status": "ok" }`.
- Complaint service health: `GET http://localhost:8000/health` returned `{ "status": "ok", "service": "complaint-management" }`.
- WhatsApp status via dashboard API: connected, instance `complaint-bot`, state `open`, Evolution URL `http://evolution:8080`.
- Dashboard stats at the time of capture: `15` total tickets, `15` open tickets, `12` high-priority open tickets, `99` processed messages today, `0` resolved today.

Primary local URLs:

- Dashboard: `http://localhost:3000`
- Express API server: `http://localhost:3001/api`
- Complaint FastAPI service: `http://localhost:8000`
- Complaint FastAPI docs: `http://localhost:8000/docs`
- Evolution API: `http://localhost:8080`

## Product Purpose

SocietyOps is an AI-assisted operations platform for residential societies. It turns unstructured WhatsApp messages from residents into structured operational data: complaint tickets, message logs, policy-controlled tracking, supervisor actions, reports, and searchable knowledge.

The core user journey is:

1. A resident sends a message in a WhatsApp group or direct chat.
2. Evolution API receives the WhatsApp event and sends a webhook to the Node/Express API gateway.
3. The Express API normalizes/stores raw message data for dashboard visibility and forwards relevant events to the Python complaint service.
4. The Python complaint service applies policy checks, classifies intent/category/priority, creates or updates tickets, and sends WhatsApp replies through Evolution.
5. The dashboard gives managers views for tickets, raw messages, classifications, policies, WhatsApp connection, AI assistant, knowledge bank, and research documents.

## Functional Capabilities

### WhatsApp Ingestion

- Uses self-hosted Evolution API v2 as the WhatsApp gateway.
- Supports `MESSAGES_UPSERT` and `messages.upsert` event names.
- Ignores own messages and unsupported event types.
- Extracts text from plain messages, extended text, media captions, and file names.
- Supports media preview handling through Evolution webhook base64 configuration in `apps/api-server/src/routes/connect.ts`.

### Complaint Classification

- Core classifier lives in `complaint-service/app/services/ai_classifier.py`.
- Primary model path uses GROQ when `GROQ_API_KEY` is configured.
- Fallback path is keyword based, so the system can continue without the external LLM key.
- Output fields include:
  - `is_complaint`
  - `intent`: `NEW_COMPLAINT`, `ISSUE_RESOLUTION`, or `OTHER`
  - `category`: `Lift`, `Garbage`, `Cleaning`, `Water`, `Electrical`, `Security`, or `Other`
  - `priority`: `High`, `Medium`, or `Low`
  - `location`
  - `issue_summary`
  - `confidence`

### Ticket Lifecycle

- New complaints can create tickets in the Python complaint service SQLite database.
- Tickets have status values `open`, `in_progress`, `resolved`, `delayed`, and `closed`.
- Dashboard ticket APIs are served by Express, but ticket persistence is delegated to the Python complaint service.
- Status updates and deletes from the dashboard flow through Express to FastAPI.

### Automatic Resolution

- Messages classified as `ISSUE_RESOLUTION` are passed to `ResolutionMatcher`.
- If a matching open or in-progress ticket is found, the ticket is marked `resolved`.
- A supervisor action is recorded for auditability.
- A WhatsApp resolution confirmation can be sent when replies are allowed.

### Policy Controls

There are two policy phases in `complaint-service/app/services/policy_engine.py`.

Phase 1, before AI classification:

- Allowed groups
- Allowed senders
- Maximum message length
- Blocked keywords
- Read-only mode

Phase 2, after classification:

- Non-complaint suppression
- Minimum confidence threshold
- Optional casual replies
- Read-only enforcement

Important environment variables:

- `READ_ONLY_MODE`
- `MIN_CONFIDENCE`
- `ALLOW_CASUAL_REPLIES`
- `MAX_MESSAGE_LENGTH`
- `ALLOWED_GROUPS`
- `ALLOWED_SENDERS`
- `BLOCK_KEYWORDS`

### Supervisor Commands

- Managers can send shorthand commands from WhatsApp.
- The orchestrator checks `is_supervisor_command()` before normal complaint creation.
- Supervisor actions are stored in the Python service database.
- Supported action types in the current model are `started`, `resolved`, and `delayed`.

### Dashboard

The React dashboard is the manager-facing UI. Routes are defined in `apps/dashboard/src/App.tsx`.

Current pages:

- `/`: dashboard metrics, charts, activity, tickets
- `/policies`: tracked WhatsApp groups and contacts
- `/connect`: WhatsApp QR/status/group refresh workflows
- `/messages`: raw message stream and media previews
- `/classification`: classification workflow UI
- `/ai`: AI assistant
- `/knowledge`: knowledge bank
- `/research`: research document ingestion/search

The dashboard uses React 19, Vite, Tailwind CSS 4, shadcn/Radix-style components, Wouter, React Query, Recharts, and lucide-react icons.

### AI Assistant

- Implemented in `apps/api-server/src/routes/ai.ts`.
- Stores conversations and messages in Postgres through `@workspace/db`.
- Builds live context from tickets, tracked groups, and tracked contacts.
- Streams responses over Server-Sent Events from `POST /api/ai/chat`.
- Uses `@workspace/integrations-openai-ai-server`, configured with OpenAI-compatible environment variables.
- Can also answer against a research collection when `collection_id` is supplied.

### Knowledge Bank and Research Hub

- `knowledge-service` is a standalone FastAPI RAG service.
- It stores chunks in Postgres with pgvector embeddings.
- Embedding provider is selected by `EMBEDDING_PROVIDER`; current Docker default is `gemini`.
- `EMBEDDING_API_KEY` is required for search/ingest.
- Express proxies knowledge APIs to the frontend under `/api/knowledge`.
- Research upload routes in `apps/api-server/src/routes/research.ts` extract text from PDF, DOCX, TXT, XLSX, and Google Drive files, chunk it, and ingest chunks into the knowledge service.

## Technical Architecture

SocietyOps is a monorepo with Docker Compose orchestration.

Top-level services:

| Service | Path | Runtime | Responsibility |
|---|---|---|---|
| `dashboard` | `apps/dashboard` | React + nginx | Manager UI |
| `api-server` | `apps/api-server` | Node.js + Express | Dashboard API, webhook ingress, AI chat, policy persistence, proxy layer |
| `api` | `complaint-service` | Python + FastAPI | Core complaint engine and SQLite ticket store |
| `knowledge-service` | `knowledge-service` | Python + FastAPI | RAG/knowledge storage and search |
| `evolution` | `docker/evolution` | Evolution API | WhatsApp gateway |
| `postgres` | Docker image | PostgreSQL + pgvector | Evolution state, Express data, knowledge vectors |

Internal Docker network: `complaint_net`.

Important service URLs inside Docker:

- `http://api-server:3001`
- `http://api:8000`
- `http://knowledge-service:8000`
- `http://evolution:8080`
- `postgres:5432`

## Main Message Flow

1. WhatsApp sends an event to Evolution.
2. Evolution posts to `http://api-server:3001/api/webhooks/evolution`.
3. Express handles it in:
   - `apps/api-server/src/routes/webhook.ts`
   - `apps/api-server/src/controllers/webhook.controller.ts`
   - `apps/api-server/src/services/webhook.service.ts`
4. Express saves raw dashboard message data through `messageRepository`.
5. Express forwards the event to the Python complaint service.
6. FastAPI handles it in `complaint-service/app/routers/evolution.py`.
7. `MessageOrchestrator` executes the complaint workflow:
   - inbound policy
   - message log
   - supervisor command check
   - AI classification
   - resolution matching or ticket creation
   - WhatsApp reply generation
8. FastAPI sends a reply through `EvolutionClient` when allowed.
9. Dashboard reads ticket stats through Express, which calls FastAPI ticket endpoints.

## Data Stores

### Python Complaint Service SQLite

Configured by `DATABASE_URL`, Docker default:

```text
sqlite:////app/data/complaints.db
```

Volume: `sqlite_data`.

Tables/models in `complaint-service/app/models.py`:

- `tickets`
- `message_logs`
- `supervisor_actions`

### Postgres

Docker image: `pgvector/pgvector:pg16`.

Databases are initialized by `docker/postgres-init/01-create-databases.sh`.

Used by:

- Evolution API session/state data in database `evolution`.
- Express dashboard/assistant/policy data in database `complaint`.
- Knowledge service vector data in database `knowledge`.

Express migrations are created imperatively in `lib/db/src/index.ts`.

Express tables:

- `conversations`
- `messages`
- `tracked_groups`
- `tracked_contacts`
- `raw_messages`
- `whatsapp_groups`

Knowledge service table:

- `knowledge_items`, with 768-dimensional vector embeddings and metadata fields.

## Important API Surfaces

### Express API, `/api`

Health:

- `GET /api/healthz`

Dashboard/tickets:

- `GET /api/dashboard/stats`
- `GET /api/dashboard/categories`
- `GET /api/dashboard/priorities`
- `GET /api/dashboard/trend`
- `GET /api/dashboard/status-breakdown`
- `GET /api/dashboard/recent-activity`
- `GET /api/dashboard/whatsapp-status`
- `GET /api/dashboard/messages`
- `POST /api/dashboard/messages/classify`
- `DELETE /api/dashboard/messages/:id`
- `GET /api/tickets`
- `GET /api/tickets/:id`
- `PATCH /api/tickets/:id/status`
- `DELETE /api/tickets/:id`

Webhook:

- `POST /api/webhooks/evolution`

Policies:

- `GET /api/policies/groups`
- `POST /api/policies/groups`
- `PATCH /api/policies/groups/:id`
- `DELETE /api/policies/groups/:id`
- `GET /api/policies/contacts`
- `POST /api/policies/contacts`
- `PATCH /api/policies/contacts/:id`
- `DELETE /api/policies/contacts/:id`

Connect:

- `GET /api/connect/whatsapp/qr`
- `POST /api/connect/whatsapp/refresh-groups`
- `GET /api/connect/whatsapp/chats`
- `GET /api/connect/whatsapp/status`
- `POST /api/connect/whatsapp/logout`
- Telegram demo/config routes also exist in `connect.ts`.

AI:

- `GET /api/ai/conversations`
- `POST /api/ai/conversations`
- `DELETE /api/ai/conversations/:id`
- `GET /api/ai/conversations/:id/messages`
- `POST /api/ai/chat`

Knowledge/research:

- `GET /api/knowledge/categories`
- `POST /api/knowledge/categories`
- `GET /api/knowledge/search`
- `POST /api/research/upload`
- `POST /api/research/google-drive`
- `GET /api/research/collections/:id/search`
- `GET /api/research/collections/:id/documents`

### Complaint Service, FastAPI

- `GET /health`
- `POST /evolution/events`
- `GET /evolution/status`
- `GET /evolution/qr`
- `GET /evolution/config`
- `GET /tickets`
- `POST /tickets`
- `GET /tickets/{ticket_id}`
- `PATCH /tickets/{ticket_id}`
- `DELETE /tickets/{ticket_id}`
- `POST /tickets/seed`
- `DELETE /tickets`
- Additional routers: `webhooks`, `supervisor`, `reports`, `openclaw`, `policy`, `knowledge`.

### Knowledge Service, FastAPI

- `GET /health`
- `POST /ingest`
- `GET /search`
- `GET /categories`
- `GET /documents`

## Repository Map

```text
apps/
  api-server/        Express gateway, dashboard API, webhooks, AI chat, research upload
  dashboard/         React manager dashboard
  mockup-sandbox/    Separate UI sandbox
complaint-service/   Python FastAPI complaint engine
knowledge-service/   Python FastAPI knowledge/RAG service
lib/
  api-spec/          OpenAPI spec source
  api-zod/           Generated Zod schemas/types
  api-client-react/  Generated React Query API client
  db/                Postgres schema/migrations/client
  integrations-*/    OpenAI-compatible client integrations
docker/
  evolution/         Custom Evolution image
  postgres-init/     Database bootstrap scripts
docs/                Architecture/design/troubleshooting/onboarding docs
scripts/             Utility scripts
microservice-dependencies/ Shared Python dependency/interface package
```

## Key Files for New Work

Start here when changing behavior:

- Dashboard shell/routes: `apps/dashboard/src/App.tsx`
- Dashboard messages page: `apps/dashboard/src/components/MessagesPage.tsx`
- Dashboard API app setup: `apps/api-server/src/app.ts`
- Express route registration: `apps/api-server/src/routes/index.ts`
- Webhook ingress: `apps/api-server/src/controllers/webhook.controller.ts`
- Webhook processing: `apps/api-server/src/services/webhook.service.ts`
- Ticket proxy logic: `apps/api-server/src/repositories/ticket.repository.ts`
- Message persistence: `apps/api-server/src/repositories/message.repository.ts`
- Policy routes: `apps/api-server/src/routes/policies.ts`
- WhatsApp connect routes: `apps/api-server/src/routes/connect.ts`
- AI assistant routes: `apps/api-server/src/routes/ai.ts`
- Research upload/search routes: `apps/api-server/src/routes/research.ts`
- Complaint FastAPI app: `complaint-service/app/main.py`
- Evolution FastAPI webhook: `complaint-service/app/routers/evolution.py`
- Ticket CRUD: `complaint-service/app/routers/tickets.py`
- Orchestration: `complaint-service/app/services/message_orchestrator.py`
- Classifier: `complaint-service/app/services/ai_classifier.py`
- Policy engine: `complaint-service/app/services/policy_engine.py`
- Knowledge FastAPI app: `knowledge-service/app/main.py`
- Knowledge routes: `knowledge-service/app/routers/knowledge.py`
- Knowledge repository: `knowledge-service/app/repositories/knowledge_repository.py`
- Docker orchestration: `docker-compose.yml`

## Environment Variables

Common variables:

- `EVOLUTION_API_KEY`: shared API key for Evolution.
- `EVOLUTION_INSTANCE`: WhatsApp instance name; current default is `complaint-bot`.
- `EVOLUTION_API_URL`: internal URL for Evolution; Docker default is `http://evolution:8080`.
- `WEBHOOK_URL`: webhook target for Evolution; default is `http://api-server:3001/api/webhooks/evolution`.
- `API_SERVER_PORT`: host port for Express; default `3001`.
- `DASHBOARD_PORT`: host port for nginx dashboard; default `3000`.
- `COMPLAINT_SERVICE_URL`: Express-to-FastAPI URL; default in code is `http://api:8000`.
- `KNOWLEDGE_SERVICE_URL`: Express/Python URL to knowledge service; Docker default `http://knowledge-service:8000`.
- `DATABASE_URL`: Express Postgres URL for `api-server`; Python `api` uses a separate SQLite URL.
- `GROQ_API_KEY`, `GROQ_MODEL`: complaint classification.
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_MODEL`: dashboard AI assistant.
- `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY`, `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`: knowledge service embeddings.
- `GOOGLE_DRIVE_API_KEY`: Google Drive research ingestion.

## Development Commands

From repo root:

```powershell
docker compose ps
docker compose up -d
docker compose build api-server dashboard api knowledge-service evolution
docker compose logs --tail=120 api-server
docker compose logs --tail=120 api
docker compose logs --tail=120 evolution
docker compose logs --tail=120 knowledge-service
```

Node workspace:

```powershell
pnpm install
pnpm --filter @workspace/api-server run build
```

Useful local checks:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/healthz
Invoke-RestMethod -Uri http://localhost:8000/health
Invoke-RestMethod -Uri http://localhost:3001/api/dashboard/whatsapp-status
Invoke-RestMethod -Uri http://localhost:3001/api/dashboard/stats
```

## Coding Notes and Pitfalls

- There are two API layers. Do not assume dashboard endpoints persist directly to the same store as tickets.
- Tickets live in the Python complaint service. Express fetches and mutates them through HTTP.
- Raw dashboard messages, conversations, tracked groups, tracked contacts, and WhatsApp group snapshots live in Postgres through Express.
- Knowledge items live in the `knowledge` Postgres database and require a configured embedding key to ingest/search.
- The policy UI under Express tracks groups/contacts for dashboard management; the Python policy engine still reads its allow/block configuration from environment variables.
- The Evolution webhook should point to Express, not directly to FastAPI, so the dashboard can capture raw messages/media.
- `api-server` runs migrations on startup in code, not through a separate migration tool.
- Dashboard API types are generated from `lib/api-spec/openapi.yaml` into `lib/api-zod` and `lib/api-client-react`; update generated clients if the OpenAPI contract changes.
- The codebase still contains older names like `ComplaintOps`; current product/repo naming is SocietyOps.
- Some files show mojibake for symbols in comments/docs. Prefer ASCII in new docs/code unless the file already has intentional Unicode.

## Suggested Onboarding Path for an LLM

1. Read this file.
2. Check `docker compose ps` and health endpoints to confirm runtime state.
3. Inspect `docker-compose.yml` for service wiring and environment variables.
4. For dashboard work, start with `apps/dashboard/src/App.tsx` and the relevant page/component.
5. For API work, start with `apps/api-server/src/routes/index.ts`, then the specific route/controller/repository.
6. For ticket behavior, inspect `complaint-service/app/services/message_orchestrator.py`, then classifier, policy, repository, and router files.
7. For knowledge/RAG behavior, inspect `knowledge-service/app/routers/knowledge.py`, `knowledge-service/app/services/knowledge_service.py`, and the repository.
8. Before editing, run `git status --porcelain=v1 -uno` and avoid overwriting unrelated user changes.
9. After editing, run the narrowest relevant build/test/health check and document what was verified.
