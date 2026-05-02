# WhatsApp Complaint Management System

A backend service that receives WhatsApp messages via **OpenClaw**, classifies them using **GROQ AI**, and manages complaint tickets — complete with supervisor workflows, a daily reporting scheduler, and a configurable policy/safety engine.

---

## What This App Does

Residents of a building, tower, or community send complaints to a WhatsApp group (e.g. "Lift is broken on 3rd floor"). This service:

1. **Receives** the message from OpenClaw (a WhatsApp automation platform)
2. **Classifies** it using GROQ's LLaMA AI — is it a complaint? What category, priority, location?
3. **Creates a ticket** in SQLite if it passes the policy checks
4. **Sends a WhatsApp reply** back to the group confirming the ticket number
5. **Lets supervisors** update ticket status by replying with short commands (e.g. `42 resolved`)
6. **Sends a daily summary report** to a configured group at a scheduled time

```
Resident types in WhatsApp group
        │
        ▼
   OpenClaw webhook → POST /openclaw/events
        │
        ▼
   Policy Engine (group filter, sender filter, block keywords, READ_ONLY mode)
        │
        ▼
   GROQ AI Classifier (category, priority, location, confidence)
        │
        ▼
   Policy Engine Phase 2 (is_complaint? confidence >= 0.7?)
        │
        ├── YES → Create Ticket in SQLite → Reply to group ✅
        └── NO  → Log only, no reply
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.12 |
| Web framework | FastAPI 0.115 |
| ASGI server | Uvicorn (with standard extras) |
| Database | SQLite via SQLAlchemy 2.x ORM |
| Data validation | Pydantic v2 |
| AI classifier | GROQ API (`groq==0.13.0`) — LLaMA 3 models |
| WhatsApp integration | OpenClaw (via HTTP/httpx) |
| Scheduler | APScheduler 3.x (AsyncIOScheduler) |
| Timezone data | tzdata (cross-platform tz support) |
| Containerisation | Docker (multi-stage build) + Docker Compose |

---

## Project Structure

```
complaint-service/
├── app/
│   ├── main.py                        # FastAPI app, startup/shutdown lifecycle
│   ├── database.py                    # SQLAlchemy engine + session factory
│   ├── models.py                      # ORM models: MessageLog, Ticket
│   ├── schemas.py                     # Pydantic request/response schemas
│   ├── routers/
│   │   ├── openclaw.py                # POST /openclaw/events  (main integration)
│   │   ├── webhooks.py                # POST /webhook/message  (direct webhook)
│   │   ├── tickets.py                 # CRUD for /tickets
│   │   ├── supervisor.py              # Supervisor status update commands
│   │   ├── reports.py                 # Daily reports + scheduler status
│   │   └── policy.py                  # Policy inspection + simulate
│   └── services/
│       ├── ai_classifier.py           # GROQ AI + keyword fallback classifier
│       ├── openclaw_client.py         # HTTP client for OpenClaw send API
│       ├── policy_engine.py           # Central policy/safety engine
│       ├── response_generator.py      # WhatsApp reply text builder
│       ├── supervisor_parser.py       # Parses "42 resolved" style commands
│       ├── report_generator.py        # Daily report SQL aggregation
│       ├── scheduler.py               # APScheduler daily report job
│       └── group_filter.py            # Group allow-list helper
├── Dockerfile                         # Multi-stage production image
├── docker-compose.yml                 # Full stack with named volume
├── requirements.txt                   # Pinned Python dependencies
└── .env.example                       # All environment variables documented
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Interactive Swagger UI |
| `POST` | `/openclaw/events` | Main OpenClaw webhook receiver |
| `GET` | `/openclaw/config` | Show OpenClaw + policy config |
| `POST` | `/webhook/message` | Direct webhook (for testing) |
| `POST` | `/webhook/classify` | Classify a message without creating a ticket |
| `GET` | `/tickets` | List all tickets (filterable by status, category) |
| `GET` | `/tickets/{id}` | Get a single ticket |
| `PATCH` | `/tickets/{id}/status` | Update ticket status |
| `POST` | `/supervisor/command` | Process a supervisor command |
| `GET` | `/reports/daily` | Daily report as JSON |
| `GET` | `/reports/daily/text` | Daily report as formatted text |
| `POST` | `/reports/daily/send` | Manually send report to WhatsApp group now |
| `GET` | `/reports/scheduler/status` | Check scheduler next run time |
| `GET` | `/policy/` | Inspect all active policy rules |
| `POST` | `/policy/simulate` | Dry-run policy against a test message |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

### Core

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:////app/data/complaints.db` | SQLAlchemy database URL |
| `LOG_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `SQL_ECHO` | `false` | Set to `true` to log every SQL query |
| `CORS_ORIGINS` | `*` | Comma-separated allowed CORS origins |

### GROQ AI Classifier

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | _(empty)_ | Your GROQ API key — [get one free at console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | `llama3-8b-8192` | Model to use. Options: `llama3-70b-8192`, `mixtral-8x7b-32768`, `gemma2-9b-it` |

> **Note:** If `GROQ_API_KEY` is left blank the service falls back to a built-in keyword classifier automatically. No crash, no error.

### OpenClaw Integration

| Variable | Default | Description |
|---|---|---|
| `OPENCLAW_API_URL` | `https://api.openclaw.io` | Base URL of your OpenClaw instance |
| `OPENCLAW_API_KEY` | _(empty)_ | API key for sending WhatsApp replies |
| `OPENCLAW_TIMEOUT` | `10` | HTTP timeout in seconds |

### Policy Engine

| Variable | Default | Description |
|---|---|---|
| `READ_ONLY_MODE` | `false` | `true` = classify and log only, no tickets or replies ever sent |
| `MIN_CONFIDENCE` | `0.7` | Minimum AI confidence (0–1) to create a ticket |
| `ALLOW_CASUAL_REPLIES` | `false` | Send a polite reply to non-complaints too |
| `MAX_MESSAGE_LENGTH` | `2000` | Hard-reject messages longer than this (characters) |
| `ALLOWED_GROUPS` | `*` | Comma-separated group IDs or names, `*` for all |
| `ALLOWED_SENDERS` | `*` | Comma-separated sender IDs/phones, `*` for all |
| `BLOCK_KEYWORDS` | _(empty)_ | Comma-separated keywords — messages with any of these are rejected |

### Daily Report Scheduler

| Variable | Default | Description |
|---|---|---|
| `REPORT_GROUP_ID` | _(empty)_ | WhatsApp group ID to send the daily report to |
| `REPORT_CRON_HOUR` | `20` | Hour to send the report (24h format) |
| `REPORT_CRON_MINUTE` | `0` | Minute to send the report |
| `REPORT_TIMEZONE` | `Asia/Karachi` | Timezone for the cron schedule (any tz database name) |

---

## Running Locally (without Docker)

### Prerequisites

- Python 3.12+
- pip

### Steps

```bash
# 1. Go into the project directory
cd complaint-service

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Edit .env and fill in GROQ_API_KEY, OPENCLAW_API_KEY, etc.

# 5. Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now live at **http://localhost:8000**
Interactive docs at **http://localhost:8000/docs**

---

## Running with Docker

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### First run

```bash
cd complaint-service

# Copy and edit the env file
cp .env.example .env
# Open .env and add your GROQ_API_KEY and OPENCLAW_API_KEY

# Build the image and start the container
docker compose up --build
```

### Subsequent runs

```bash
docker compose up           # foreground
docker compose up -d        # detached (background)
```

### Useful commands

```bash
# Follow API logs
docker compose logs -f api

# Stop everything
docker compose down

# Stop and delete the database volume (fresh start)
docker compose down -v

# Rebuild after code changes
docker compose up --build
```

The API is available at **http://localhost:8000**

> The SQLite database is stored in a named Docker volume (`sqlite_data`) so it persists across container restarts. Only `docker compose down -v` will delete it.

---

## Verifying the Setup

After starting (locally or Docker), run these checks:

```bash
# 1. Health check
curl http://localhost:8000/health
# Expected: {"status": "ok"}

# 2. View active policy configuration
curl http://localhost:8000/policy/
# Expected: JSON with all policy rules

# 3. Classify a test message (no DB writes)
curl -X POST http://localhost:8000/webhook/classify \
  -H "Content-Type: application/json" \
  -d '{"message_text": "The elevator on floor 3 is broken"}'
# Expected: {"is_complaint": true, "category": "Maintenance", ...}

# 4. Simulate a policy decision
curl -X POST http://localhost:8000/policy/simulate \
  -H "Content-Type: application/json" \
  -d '{"message_text": "hello how are you", "is_complaint": false, "confidence": 0.2}'
# Expected: {"final_outcome": {"will_create_ticket": false, ...}}

# 5. Check the daily report scheduler
curl http://localhost:8000/reports/scheduler/status
# Expected: {"running": true, "next_run": "...", ...}
```

---

## Supervisor Workflow

Supervisors can update ticket status directly from WhatsApp by replying with a short command in any monitored group:

```
<ticket_id> <action>
```

| Command | Action |
|---|---|
| `42 started` | Mark ticket #42 as In Progress |
| `42 resolved` | Mark ticket #42 as Resolved |
| `42 delayed` | Mark ticket #42 as Delayed |
| `42 closed` | Close ticket #42 |

Example: A supervisor sees "Ticket #42 — Lift broken" and replies `42 resolved`. The service detects this, updates the database, and sends a confirmation message back to the group.

---

## Policy Engine

All message processing decisions go through a two-phase policy engine:

```
Phase 1 — Inbound (before AI)       Phase 2 — Post-classification
─────────────────────────────       ──────────────────────────────
GROUP_NOT_ALLOWED                   NOT_A_COMPLAINT
SENDER_NOT_ALLOWED                  LOW_CONFIDENCE
MESSAGE_TOO_LONG                    READ_ONLY_MODE
BLOCKED_KEYWORD
READ_ONLY_MODE
```

Use `POST /policy/simulate` to test any rule change before applying it:

```bash
curl -X POST http://localhost:8000/policy/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "message_text": "test message",
    "group_name": "Block B Residents",
    "sender_id": "923001234567@s.whatsapp.net",
    "is_complaint": true,
    "confidence": 0.85
  }'
```

---

## Manually Triggering the Daily Report

To send the daily report immediately (without waiting for the scheduled time):

```bash
curl -X POST http://localhost:8000/reports/daily/send
```

To preview the report without sending:

```bash
curl http://localhost:8000/reports/daily/text
```

---

## Common Issues

**GROQ API key not working**
The service automatically falls back to a keyword-based classifier. You will see `"source": "keyword_fallback"` in the classification response. Add a valid key to `.env` and restart.

**No WhatsApp replies being sent**
Check that `OPENCLAW_API_KEY` is set and `READ_ONLY_MODE` is not `true`. Visit `/openclaw/config` to verify.

**Database is reset after restart**
This happens if you run `docker compose down -v`. Omit the `-v` flag to keep the volume.

**Wrong timezone on scheduled reports**
Set `REPORT_TIMEZONE` to a valid [tz database name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) such as `Asia/Karachi`, `UTC`, or `Asia/Dubai`.

**Port 8000 is already in use**
Change the host port mapping in `docker-compose.yml` from `"8000:8000"` to e.g. `"8080:8000"`, then access the API at `http://localhost:8080`.
