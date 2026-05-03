# ComplaintOps

AI-powered complaint management platform for residential societies. Residents submit complaints
via WhatsApp groups; the system classifies them with a GROQ LLaMA 3 AI model, creates tickets
automatically, sends a confirmation reply, and surfaces everything on a web dashboard.

---

## What This Project Does

Residential societies typically manage complaints (water leaks, power cuts, broken lifts, security
incidents) through unstructured WhatsApp chat groups. ComplaintOps turns those messages into a
structured, trackable ticket system — with zero friction for residents.

**Core capabilities:**

| Capability | How it works |
|-----------|-------------|
| **Automatic ticket creation** | Incoming WhatsApp messages are classified by AI and converted to tickets |
| **AI classification** | GROQ LLaMA 3 assigns a `category` (plumbing, electrical, security…) and `priority` (LOW → CRITICAL) |
| **Keyword fallback** | If no GROQ key is configured, a keyword-based classifier keeps the system functional |
| **WhatsApp auto-reply** | Residents receive a confirmation message with their ticket ID and category |
| **Policy engine** | Two-phase safety filter (group allow-list, sender filter, keyword block, confidence threshold, read-only mode) |
| **Supervisor commands** | Society managers type `42 resolved` in a group to close ticket #42 — no UI needed |
| **Daily reports** | Scheduled WhatsApp summary sent to a designated group each evening |
| **Web dashboard** | React SPA with KPI cards, charts, filterable ticket table, activity feed |
| **AI chat assistant** | Embedded LLM chat on the dashboard for querying ticket data in natural language |
| **Connect page** | Scan a QR code inside the dashboard to link a WhatsApp account |

---

## Tech Stack

### complaint-service (Python)

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI 0.115 + Uvicorn |
| Database | SQLite via SQLAlchemy 2.0 ORM |
| Validation | Pydantic v2 |
| AI classifier | GROQ API (`llama-3.1-8b-instant`) with keyword fallback |
| HTTP client | httpx (async) |
| Scheduler | APScheduler 3.10 (daily reports) |
| Container | Python 3.12-slim (multi-stage) |

### apps/api-server (Node.js)

| Component | Technology |
|-----------|-----------|
| Framework | Express 5 |
| Database | PostgreSQL via Drizzle ORM |
| Language | TypeScript 5.9 |
| Logging | Pino |
| Build | esbuild |
| Container | Node 22-slim (multi-stage) |

### apps/dashboard (React)

| Component | Technology |
|-----------|-----------|
| Framework | React 19 + Vite 7 |
| Styling | Tailwind CSS 4 |
| UI primitives | Radix UI + shadcn/ui |
| Data fetching | React Query 5 (auto-generated hooks) |
| Charts | Recharts 2 |
| Forms | React Hook Form 7 + Zod |
| Router | Wouter |
| Container | Node build → nginx:alpine |

### Infrastructure

| Component | Technology |
|-----------|-----------|
| WhatsApp gateway | Evolution API v2 (self-hosted) |
| Orchestration | Docker Compose (5 services) |
| Internal DB (Evolution) | PostgreSQL 16-alpine |
| Workspace | pnpm workspaces (monorepo) |
| API codegen | Orval (OpenAPI → React Query + Zod) |

---

## Architecture & Request Flow

```
Resident → WhatsApp Group
               │
               ▼
    ┌─────────────────────┐
    │   Evolution API     │  (self-hosted WhatsApp gateway, port 8080)
    │   atendai/v2.2.3    │
    └──────────┬──────────┘
               │  POST /evolution/events
               ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │           Express API Server — api-server (port 3001)           │
     │                                                                 │
     │  1. Receives webhook from Evolution API                          │
     │  2. Normalizes event (v1 messages.upsert / v2 MESSAGES_UPSERT)  │
     │  3. Extracts text from conversation/extended/image/buttons       │
     │  4. Updates in-memory rawMessages list (Real-time Dashboard)     │
     │  5. Forwards webhook to complaint-service                        │
     └─────────────────────────────────────────────────────────────────┘
                │
                ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │               FastAPI — complaint-service (port 8000)           │
     │                                                                 │
     │  1. Pydantic validates IncomingMessage                          │
     │  2. MessageLog inserted (raw audit trail)                       │
     │  3. Policy Engine — Phase 1 (inbound gate)                      │
     │       group_filter → sender_filter → keyword_block → length     │
     │  4. GROQ AI Classifier (LLaMA 3.1)                              │
     │       → category (plumbing/electrical/security/…)               │
     │       → priority (LOW/MEDIUM/HIGH/CRITICAL)                     │
     │       → confidence score                                        │
     │       (falls back to keyword scan if GROQ unavailable)          │
     │  5. Policy Engine — Phase 2 (post-classification gate)          │
     │       confidence_threshold → read_only_mode → casual_reply      │
     │  6. Ticket created in SQLite                                    │
     │  7. WhatsApp reply sent via Evolution API                       │
     │  8. APScheduler → daily report to REPORT_GROUP_ID at cron time  │
     └─────────────────────────────────────────────────────────────────┘
               │
               ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │           Express API Server — api-server (port 3001)           │
    │                                                                 │
    │  GET /api/dashboard/*   → stats, charts, recent activity        │
    │  GET/POST /api/policies → tracked groups, contacts              │
    │  GET /api/connect/*     → WhatsApp QR code generation           │
    │  POST /api/ai/chat      → AI assistant (SSE streaming)          │
    │  POST /api/webhooks/ev* → Webhook entry point (v1/v2 support)   │
    └─────────────────────────────────────────────────────────────────┘
               │
               ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │          React Dashboard — dashboard (port 3000, nginx)         │
    │                                                                 │
    │  / Dashboard    → KPI cards, charts, ticket table               │
    │  /policies      → tracked WhatsApp groups and contacts          │
    │  /connect       → scan QR to link WhatsApp                      │
    │  /prompt        → AI assistant chat                             │
    └─────────────────────────────────────────────────────────────────┘
```

### Docker Network

All five services share `complaint_net` (bridge). Internal DNS resolves by container name:

```
postgres:5432    (Evolution API DB — not exposed publicly)
evolution:8080   → host:8080
api:8000         → host:8000
api-server:3001  → host:3001
dashboard:80     → host:3000
```

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Compose v2)
- Git
- A GROQ API key (free at console.groq.com) — optional but recommended

---

## Deploy with Docker (Recommended)

This is the fastest path to a running system.

### 1. Clone and configure

```bash
git clone <repo-url>
cd ComplaintOps
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
EVOLUTION_API_KEY=your-strong-secret-key        # must match in Evolution + api service
EVOLUTION_DB_PASSWORD=your-db-password          # Postgres password for Evolution
GROQ_API_KEY=gsk_...                            # leave empty to use keyword fallback
EVOLUTION_INSTANCE=complaint-bot                # WhatsApp instance name
```

Optional but useful:

```dotenv
REPORT_GROUP_ID=120363000000000001@g.us         # group that receives daily reports
REPORT_TIMEZONE=Asia/Kolkata                    # your timezone
ALLOWED_GROUPS=*                                # restrict to specific group IDs if needed
```

### 2. Build and start

```bash
docker compose up --build
```

First run downloads images and builds all services — takes ~3–5 minutes. Subsequent starts are fast.

### 3. Link a WhatsApp account

1. Open the dashboard at **http://localhost:3000**
2. Go to **Connect** page
3. Scan the QR code with your WhatsApp (or business account)
4. The Evolution API registers the session; it auto-reconnects on restart

### 4. Test a complaint

Send a message to one of your tracked WhatsApp groups (or send a direct message to the linked
number). The system should classify it and reply within a few seconds.

You can also send a test message directly to the FastAPI:

```bash
curl -s -X POST http://localhost:8000/webhook/message \
  -H "Content-Type: application/json" \
  -d '{"sender": "923001234567", "group_name": "Block B Residents", "message": "Water leakage in flat 3B since morning"}'
```

### 5. Useful Docker commands

```bash
docker compose logs -f api          # follow FastAPI logs
docker compose logs -f evolution    # follow Evolution API logs
docker compose logs -f api-server   # follow Express API logs
docker compose ps                   # check service status
docker compose down                 # stop everything (keeps data volumes)
docker compose down -v              # stop + delete all data (full reset)
docker compose restart api          # restart a single service
```

---

## Run Locally (Without Docker)

Useful during development when you want hot-reload.

### complaint-service (FastAPI)

```bash
cd complaint-service

# create and activate a virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt

# copy and edit env vars
cp ../.env.example .env
# set DATABASE_URL=sqlite:///./data/complaints.db (local path)

uvicorn app.main:app --reload --port 8000
```

API docs available at **http://localhost:8000/docs**

### api-server (Express)

```bash
# from repo root — install all workspace deps first
pnpm install

cd apps/api-server
pnpm dev
```

Runs on **http://localhost:3001**

### dashboard (React + Vite)

```bash
cd apps/dashboard
pnpm dev
```

Opens at **http://localhost:5173** (Vite dev server with HMR)

> When running locally without Docker, you still need Evolution API running (easiest via
> `docker compose up evolution postgres`) for the WhatsApp gateway. The dashboard and api-server
> can run fully local without Evolution.

---

## Key URLs

| URL | Description |
|-----|-------------|
| http://localhost:3000 | React dashboard (Docker / nginx) |
| http://localhost:5173 | React dashboard (Vite dev mode) |
| http://localhost:3001 | Express API server |
| http://localhost:8000 | FastAPI complaint service |
| http://localhost:8000/docs | FastAPI Swagger UI |
| http://localhost:8000/health | FastAPI health check |
| http://localhost:8080 | Evolution API (WhatsApp gateway) |

---

## API Reference (FastAPI — port 8000)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/evolution/events` | Evolution API webhook (main message ingestion) |
| `GET` | `/tickets` | List tickets (filter by status, category, priority) |
| `POST` | `/tickets` | Create a ticket manually |
| `PATCH` | `/tickets/{id}` | Update ticket status / fields |
| `DELETE` | `/tickets/{id}` | Delete a ticket |
| `POST` | `/supervisor/command` | Parse and apply a supervisor command (e.g. `42 resolved`) |
| `GET` | `/supervisor/actions` | List all supervisor actions |
| `GET` | `/reports/daily` | Daily report as JSON |
| `GET` | `/reports/daily/text` | Daily report as formatted text |
| `POST` | `/reports/daily/send` | Send daily report to WhatsApp |
| `GET` | `/policy/` | Inspect current policy rules |
| `POST` | `/policy/simulate` | Dry-run a message through the full pipeline |
| `POST` | `/webhook/message` | Direct message test (no Evolution required) |
| `POST` | `/webhook/classify` | Classify text only, no ticket created |

---

## Environment Variables

See [.env.example](.env.example) for the full documented list.

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | GROQ API key; empty = keyword fallback |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | GROQ model name |
| `EVOLUTION_API_KEY` | `change-me-strong-key-123` | API key for Evolution (change this) |
| `EVOLUTION_INSTANCE` | `complaint-bot` | WhatsApp instance name |
| `EVOLUTION_DB_PASSWORD` | `evolution_pass` | Postgres password for Evolution |
| `MIN_CONFIDENCE` | `0.7` | Minimum AI confidence to create a ticket |
| `READ_ONLY_MODE` | `false` | Log-only mode — no tickets or replies |
| `ALLOWED_GROUPS` | `*` | Comma-separated group IDs or `*` for all |
| `BLOCK_KEYWORDS` | — | Comma-separated keywords to reject |
| `REPORT_GROUP_ID` | — | WhatsApp group ID for daily reports |
| `REPORT_CRON_HOUR` | `20` | Hour to send report (24h) |
| `REPORT_TIMEZONE` | `Asia/Karachi` | Timezone for report cron |
| `DATABASE_URL` | `sqlite:////app/data/complaints.db` | SQLite path (FastAPI service) |
| `DASHBOARD_PORT` | `3000` | Host port for dashboard |
| `API_SERVER_PORT` | `3001` | Host port for Express API server |

---

## Project Structure

```
ComplaintOps/
├── complaint-service/          Python FastAPI — core complaint engine
│   ├── app/
│   │   ├── main.py             Entry point, lifespan hooks
│   │   ├── models.py           SQLAlchemy ORM models
│   │   ├── schemas.py          Pydantic request/response schemas
�
## Troubleshooting

For solutions to common issues (Evolution API, QR codes, message ingestion, etc.), please refer to:
👉 [Troubleshooting Guide](docs/troubleshooting.md)
The evolution service depends on Postgres being healthy. Check `docker compose logs postgres`.
If the volume is corrupt: `docker compose down -v && docker compose up --build`.

**WhatsApp QR code not appearing**
Open http://localhost:8080 directly and use the Evolution API dashboard. Or use the `/connect`
page in the React dashboard which fetches the QR via the api-server.

**Messages not being received**
1. Check `docker compose logs evolution` for connection status.
2. Verify `EVOLUTION_API_KEY` matches in both `.env` and docker-compose.yml.
3. Confirm the webhook is registered. Check `api-server` logs for "Syncing webhook". Evolution v2 requires `enabled: true`.
4. Check if you are using Evolution API v2 (uppercase `MESSAGES_UPSERT`) or v1 (lowercase `messages.upsert`). The current `api-server` handles both.
5. Check `api-server` logs for "Evolution Webhook Request Body" to see if data is arriving.

**Tickets not being created (no AI errors)**
Check `MIN_CONFIDENCE` — if the message has low confidence the policy engine skips ticket creation.
Use `/policy/simulate` to dry-run a message and see which phase rejected it.

**Dashboard shows no data**
The dashboard fetches from the Express api-server (port 3001) which in turn proxies to FastAPI.
Check that api-server is healthy: `curl http://localhost:3001/api/healthz`.

**Port conflicts**
Change host ports in `.env`: `DASHBOARD_PORT`, `API_SERVER_PORT`. The Evolution API port (8080)
is set in `docker-compose.yml` directly.
