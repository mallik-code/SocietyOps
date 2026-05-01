# Design Document — WhatsApp Complaint Management System

## 1. System Overview

```
WhatsApp Groups
      │
      ▼
  OpenClaw Bot  ──── POST /webhook/message ────▶  FastAPI Backend
                                                       │
                                            ┌──────────┼──────────┐
                                            ▼          ▼          ▼
                                       MessageLog   AI Classifier  Ticket
                                       (audit)      (category +   (stored
                                                     priority)    in SQLite)
                                                                    │
                                                         ┌──────────┼──────────┐
                                                         ▼          ▼          ▼
                                                    GET /tickets  PATCH    POST /supervisor
                                                    (list/filter) /status  /actions
                                                         │
                                                         ▼
                                                  GET /reports/daily
```

---

## 2. Architecture

### 2.1 Layer Model

```
app/
├── main.py               Application entry point, CORS, lifespan hooks
├── database.py           SQLAlchemy engine, session factory, Base
├── models.py             ORM table definitions (Ticket, MessageLog, SupervisorAction)
├── schemas.py            Pydantic request/response models
├── routers/
│   ├── webhooks.py       POST /webhook/message  — message ingestion
│   ├── tickets.py        GET/POST/PATCH/DELETE /tickets
│   ├── supervisor.py     POST/GET /supervisor/actions
│   └── reports.py        GET /reports/daily
└── services/
    ├── ai_classifier.py  Category + priority inference (OpenAI / keyword fallback)
    └── report_generator.py  Aggregate query logic for daily reports
```

Each layer has a single responsibility:

| Layer | Responsibility |
|-------|----------------|
| **Routers** | HTTP binding, input validation, response serialisation |
| **Services** | Business logic, AI calls, aggregation queries |
| **Models** | Database schema and relationships |
| **Schemas** | Wire format contracts (request bodies + response shapes) |

### 2.2 Request Lifecycle — Webhook

```
POST /webhook/message
        │
        ▼
  Pydantic validates IncomingMessage
        │
        ▼
  MessageLog inserted (raw audit)
        │
        ▼
  ai_classifier.classify_complaint(text)
    ├── OPENAI_API_KEY set? → OpenAI Chat Completions → parse JSON
    └── fallback            → keyword scan → (category, priority)
        │
        ▼
  Ticket inserted (status=OPEN)
        │
        ▼
  WebhookResponse returned (ticket_id, category, priority)
```

---

## 3. Database Schema

### 3.1 Entity-Relationship Diagram

```
┌──────────────────────────────────────┐
│               tickets                │
├──────────────────────────────────────┤
│ id           PK  INTEGER             │
│ message_text     TEXT NOT NULL       │
│ category         TEXT                │
│ priority         TEXT (ENUM)         │
│ location         TEXT                │
│ status           TEXT (ENUM)         │
│ created_at       TEXT (ISO-8601 UTC) │
│ updated_at       TEXT (auto-trigger) │
│ reporter_name    TEXT                │
│ group_name       TEXT                │
└───────────────────┬──────────────────┘
                    │ 1
                    │
                    │ N
┌──────────────────────────────────────┐
│          supervisor_actions          │
├──────────────────────────────────────┤
│ id           PK  INTEGER             │
│ ticket_id    FK → tickets.id         │
│ action           TEXT (ENUM)         │
│ timestamp        TEXT (ISO-8601 UTC) │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│            message_logs              │
├──────────────────────────────────────┤
│ id           PK  INTEGER             │
│ raw_message      TEXT NOT NULL       │
│ sender           TEXT                │
│ group_name       TEXT                │
│ timestamp        TEXT (ISO-8601 UTC) │
└──────────────────────────────────────┘
```

`message_logs` is independent — it records every raw inbound message for audit/replay purposes regardless of whether a ticket was created.

### 3.2 Enum Values

| Column | Allowed Values |
|--------|---------------|
| `tickets.status` | OPEN, IN_PROGRESS, RESOLVED |
| `tickets.priority` | LOW, MEDIUM, HIGH, CRITICAL |
| `supervisor_actions.action` | STARTED, RESOLVED, DELAYED |

### 3.3 Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| tickets | status | Filter open/in-progress/resolved tickets |
| tickets | priority | Filter high-priority tickets |
| tickets | category | Group by category for reports |
| tickets | created_at | Date-range queries for daily reports |
| tickets | group_name | Filter tickets from a specific WhatsApp group |
| message_logs | sender | Look up all messages from a sender |
| message_logs | timestamp | Audit time-range queries |
| supervisor_actions | ticket_id | List all actions for a ticket |
| supervisor_actions | timestamp | Time-range audits |

---

## 4. AI Classification Service

### 4.1 Modes

```
classify_complaint(text)
        │
        ├── OPENAI_API_KEY is set
        │       │
        │       ▼
        │   POST https://api.openai.com/v1/chat/completions
        │   Model: gpt-3.5-turbo (configurable via OPENAI_MODEL)
        │   Temperature: 0  (deterministic output)
        │   Returns: {"category": "...", "priority": "..."}
        │       │
        │       ├── Success → return (category, priority)
        │       └── Error   → fall through to keyword classifier
        │
        └── No API key (or OpenAI fails)
                │
                ▼
            Keyword scan over predefined dictionaries
            Returns best-match (category, priority)
```

### 4.2 Categories & Keywords (Keyword Classifier)

| Category | Sample Keywords |
|----------|----------------|
| Water Supply | water, pipe, leak, flood, drainage, sewage |
| Electricity | electricity, power, outage, blackout, wiring |
| Road & Infrastructure | road, pothole, bridge, footpath, pavement |
| Garbage & Sanitation | garbage, trash, waste, litter, dump, rubbish |
| Noise Pollution | noise, loud, music, sound, disturbance |
| Public Safety | crime, theft, robbery, danger, police |
| Healthcare | hospital, clinic, medicine, doctor, ambulance |
| Education | school, college, teacher, student, university |
| Housing | house, building, roof, wall, rent, landlord |
| Transportation | bus, train, taxi, traffic, commute |
| Environment | pollution, smoke, air, chemical, toxic |

### 4.3 Priority Heuristics

| Priority | Trigger Keywords |
|----------|-----------------|
| CRITICAL | urgent, emergency, immediately, dangerous, life, death, fire, injury |
| HIGH | serious, severe, major, broken, flooding |
| LOW | minor, small, slight, occasionally |
| MEDIUM | (default — no strong signal found) |

---

## 5. API Endpoints

### Base URL: `http://localhost:8000`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| POST | `/webhook/message` | Receive WhatsApp message from OpenClaw |
| GET | `/tickets` | List tickets (filterable) |
| POST | `/tickets` | Create ticket manually |
| GET | `/tickets/{id}` | Get single ticket |
| PATCH | `/tickets/{id}` | Update ticket fields |
| DELETE | `/tickets/{id}` | Delete a ticket |
| POST | `/supervisor/actions` | Log a supervisor action |
| GET | `/supervisor/actions` | List all supervisor actions |
| GET | `/supervisor/actions/ticket/{id}` | List actions for a ticket |
| GET | `/reports/daily` | Generate daily report |
| GET | `/docs` | Swagger UI |
| GET | `/redoc` | ReDoc UI |

### Webhook Payload Example

```json
POST /webhook/message
{
  "message_text": "There is a major water pipe leak flooding Main Street.",
  "sender": "+92-300-1234567",
  "group_name": "Residents Group A",
  "reporter_name": "Ahmed Ali",
  "location": "Main Street"
}
```

Response:
```json
{
  "ticket_id": 1,
  "category": "Water Supply",
  "priority": "HIGH",
  "message": "Complaint received and classified"
}
```

---

## 6. Docker Architecture

```
docker-compose.yml
       │
       ├── api (complaint_api)
       │     ├── Image: python:3.12-slim (multi-stage build)
       │     ├── Port: 8000:8000
       │     ├── Volume: sqlite_data → /app/data/complaints.db
       │     └── Env: DATABASE_URL, OPENAI_API_KEY, LOG_LEVEL, CORS_ORIGINS
       │
       └── (nginx — optional, commented out by default)
             ├── Image: nginx:1.27-alpine
             └── Port: 80:80
```

### Volume Strategy

SQLite data is stored in a named Docker volume (`sqlite_data`) mounted at `/app/data`. This ensures the database persists across container restarts and image rebuilds.

---

## 7. Configuration Reference

All configuration is done via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:////app/data/complaints.db` | SQLAlchemy connection string |
| `LOG_LEVEL` | `INFO` | Python logging level |
| `SQL_ECHO` | `false` | Log all SQL statements (debug) |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `OPENAI_API_KEY` | _(blank)_ | OpenAI key — leave blank for keyword classifier |
| `OPENAI_MODEL` | `gpt-3.5-turbo` | OpenAI model to use for classification |

---

## 8. Local Deployment Guide

### Prerequisites
- Docker Desktop installed and running
- Port 8000 free on your machine

### Steps

```bash
# 1. Clone / navigate to the project
cd complaint-service

# 2. (Optional) configure environment
cp .env.example .env
# edit .env and set OPENAI_API_KEY if you want AI classification

# 3. Build and start
docker compose up --build

# 4. Verify
curl http://localhost:8000/health
# → {"status":"ok","service":"complaint-management"}

# 5. Open Swagger UI
open http://localhost:8000/docs

# 6. Stop
docker compose down

# 7. Stop and wipe database volume
docker compose down -v
```

---

## 9. Future Enhancements (v2 Roadmap)

| Feature | Notes |
|---------|-------|
| API key authentication | Bearer token middleware for securing endpoints |
| PostgreSQL support | Switch DATABASE_URL, use Alembic for migrations |
| Alembic migrations | Schema versioning for production upgrades |
| WebSocket live updates | Push new tickets to supervisor dashboard in real time |
| Email / SMS alerts | Notify supervisors of CRITICAL tickets immediately |
| Admin dashboard frontend | React-based UI for ticket management and reports |
| Rate limiting | Prevent webhook abuse with slowapi |
| Background task queue | Celery + Redis for async AI classification at scale |
| Multi-language support | Classify complaints in Urdu, Arabic, etc. |
