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

## Key Commands (Node/TypeScript)

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

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

### Structure
```
complaint-service/
├── app/
│   ├── main.py               # FastAPI app, CORS, lifespan
│   ├── database.py           # SQLAlchemy engine + session factory
│   ├── models.py             # ORM models: Ticket, MessageLog, SupervisorAction
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── routers/
│   │   ├── webhooks.py       # POST /webhook/message
│   │   ├── tickets.py        # CRUD /tickets
│   │   ├── supervisor.py     # POST/GET /supervisor/actions
│   │   └── reports.py        # GET /reports/daily
│   └── services/
│       ├── ai_classifier.py  # OpenAI + keyword classifier
│       └── report_generator.py
├── schema.sql                # Raw SQLite DDL + seed data
├── requirements.txt
├── Dockerfile                # Multi-stage Python 3.12 image
├── docker-compose.yml        # API service + optional nginx
├── .env.example              # All configurable env vars
├── requirements.md           # Functional & non-functional requirements
└── design.md                 # Architecture, ERD, API reference, deployment guide
```

### Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/webhook/message` | Receive WhatsApp message from OpenClaw |
| GET | `/tickets` | List/filter tickets |
| PATCH | `/tickets/{id}` | Update ticket status/priority |
| POST | `/supervisor/actions` | Log supervisor action (auto-updates ticket status) |
| GET | `/reports/daily` | Daily aggregate report |
| GET | `/docs` | Swagger UI |

### Local Docker Deployment
```bash
cd complaint-service
cp .env.example .env          # optionally set OPENAI_API_KEY
docker compose up --build
# API available at http://localhost:8000
# Swagger UI at  http://localhost:8000/docs
```
