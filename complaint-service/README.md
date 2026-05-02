# WhatsApp Complaint Management System

A fully self-hosted backend that receives WhatsApp messages via **Evolution API** (open-source WhatsApp gateway running in Docker), classifies them using **GROQ AI**, and manages complaint tickets — with supervisor workflows, a daily reporting scheduler, and a configurable policy/safety engine.

No third-party SaaS required. Everything runs on your own machine or server.

---

## What This App Does

Residents of a building, tower, or community send complaints to a WhatsApp group (e.g. "Lift is broken on 3rd floor"). This service:

1. **Receives** the message from Evolution API (self-hosted WhatsApp gateway)
2. **Classifies** it using GROQ's LLaMA AI — is it a complaint? What category, priority, location?
3. **Creates a ticket** in SQLite if it passes the policy checks
4. **Sends a WhatsApp reply** back to the group confirming the ticket number
5. **Lets supervisors** update ticket status by replying with short commands (e.g. `42 resolved`)
6. **Sends a daily summary report** to a configured group at a scheduled time

```
Resident types in WhatsApp group
        │
        ▼
   Evolution API (Docker container, port 8080)
        │  forwards via HTTP webhook
        ▼
   POST /evolution/events  (our FastAPI service)
        │
        ▼
   Policy Engine Phase 1 (group filter, sender filter, block keywords, READ_ONLY)
        │
        ▼
   GROQ AI Classifier (category, priority, location, confidence)
        │
        ▼
   Policy Engine Phase 2 (is_complaint? confidence >= 0.7?)
        │
        ├── YES → Create Ticket in SQLite → Send WhatsApp reply ✅
        └── NO  → Log only, no reply
```

---

## Architecture — Two Docker Containers

```
┌─────────────────────────────────────────────────────┐
│                Docker Network: complaint_net          │
│                                                       │
│  ┌──────────────────────┐   webhook POST             │
│  │  Evolution API       │──────────────────────────► │
│  │  port 8080           │   http://api:8000           │
│  │  (WhatsApp gateway)  │   /evolution/events        │
│  └──────────────────────┘                            │
│            ▲                                          │
│            │ send reply                              │
│            │                                          │
│  ┌──────────────────────┐                            │
│  │  FastAPI + SQLite    │                            │
│  │  port 8000           │                            │
│  │  (complaint backend) │                            │
│  └──────────────────────┘                            │
└─────────────────────────────────────────────────────┘
        │                       │
        ▼                       ▼
 localhost:8080           localhost:8000
 (Evolution UI/API)       (Complaint API + Swagger)
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
| WhatsApp gateway | Evolution API v2 (self-hosted, Docker) |
| HTTP client | httpx (async) |
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
│   │   ├── evolution.py               # POST /evolution/events  ← main webhook
│   │   ├── openclaw.py                # POST /openclaw/events   (legacy / alternative)
│   │   ├── webhooks.py                # POST /webhook/message   (direct testing)
│   │   ├── tickets.py                 # CRUD for /tickets
│   │   ├── supervisor.py              # Supervisor status update commands
│   │   ├── reports.py                 # Daily reports + scheduler status
│   │   └── policy.py                  # Policy inspection + simulate
│   └── services/
│       ├── ai_classifier.py           # GROQ AI + keyword fallback classifier
│       ├── evolution_client.py        # HTTP client for Evolution API send
│       ├── openclaw_client.py         # HTTP client for OpenClaw send (legacy)
│       ├── policy_engine.py           # Central policy/safety engine
│       ├── response_generator.py      # WhatsApp reply text builder
│       ├── supervisor_parser.py       # Parses "42 resolved" style commands
│       ├── report_generator.py        # Daily report SQL aggregation
│       ├── scheduler.py               # APScheduler daily report job
│       └── group_filter.py            # Group allow-list helper
├── Dockerfile                         # Multi-stage production image
├── docker-compose.yml                 # Evolution API + FastAPI + volumes + network
├── requirements.txt                   # Pinned Python dependencies
└── .env.example                       # All environment variables documented
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Interactive Swagger UI |
| **Evolution API (primary)** | | |
| `POST` | `/evolution/events` | Main Evolution API webhook receiver |
| `GET` | `/evolution/status` | WhatsApp connection state of the instance |
| `GET` | `/evolution/qr` | Fetch QR code for WhatsApp linking |
| `GET` | `/evolution/config` | Show Evolution API + policy config |
| **Tickets** | | |
| `GET` | `/tickets` | List all tickets (filterable by status, category) |
| `GET` | `/tickets/{id}` | Get a single ticket |
| `PATCH` | `/tickets/{id}/status` | Update ticket status |
| **Supervisor** | | |
| `POST` | `/supervisor/command` | Process a supervisor command |
| **Reports** | | |
| `GET` | `/reports/daily` | Daily report as JSON |
| `GET` | `/reports/daily/text` | Daily report as formatted WhatsApp text |
| `POST` | `/reports/daily/send` | Manually send report to WhatsApp group now |
| `GET` | `/reports/scheduler/status` | Check scheduler next run time |
| **Policy** | | |
| `GET` | `/policy/` | Inspect all active policy rules |
| `POST` | `/policy/simulate` | Dry-run policy against a test message |
| **Testing / Legacy** | | |
| `POST` | `/webhook/message` | Direct webhook without Evolution API |
| `POST` | `/webhook/classify` | Classify a message — no DB writes |
| `POST` | `/openclaw/events` | OpenClaw webhook (alternative gateway) |

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

### Evolution API

| Variable | Default | Description |
|---|---|---|
| `EVOLUTION_SERVER_URL` | `http://localhost:8080` | Public URL of Evolution API (used by Evolution itself) |
| `EVOLUTION_API_KEY` | `change-me-strong-key-123` | API key — must match the value in docker-compose.yml |
| `EVOLUTION_INSTANCE` | `complaint-bot` | Instance name (auto-created on first run) |
| `EVOLUTION_TIMEOUT` | `10` | HTTP timeout in seconds for Evolution API calls |

> **Important:** Change `EVOLUTION_API_KEY` to a strong random string before deploying. The same value must be set in both the `evolution` service and the `api` service in docker-compose.yml.

### GROQ AI Classifier

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | _(empty)_ | Your GROQ API key — [get one free at console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | `llama3-8b-8192` | Model to use. Options: `llama3-70b-8192`, `mixtral-8x7b-32768`, `gemma2-9b-it` |

> **Note:** If `GROQ_API_KEY` is left blank the service falls back to a built-in keyword classifier automatically. No crash, no error.

### Policy Engine

| Variable | Default | Description |
|---|---|---|
| `READ_ONLY_MODE` | `false` | `true` = classify and log only, no tickets or replies ever sent |
| `MIN_CONFIDENCE` | `0.7` | Minimum AI confidence (0–1) to create a ticket |
| `ALLOW_CASUAL_REPLIES` | `false` | Send a polite reply to non-complaints too |
| `MAX_MESSAGE_LENGTH` | `2000` | Hard-reject messages longer than this (characters) |
| `ALLOWED_GROUPS` | `*` | Comma-separated group JIDs or names, `*` for all |
| `ALLOWED_SENDERS` | `*` | Comma-separated sender JIDs/phones, `*` for all |
| `BLOCK_KEYWORDS` | _(empty)_ | Comma-separated keywords — messages with any of these are rejected |

### Daily Report Scheduler

| Variable | Default | Description |
|---|---|---|
| `REPORT_GROUP_ID` | _(empty)_ | WhatsApp group JID to send the daily report to |
| `REPORT_CRON_HOUR` | `20` | Hour to send the report (24h format) |
| `REPORT_CRON_MINUTE` | `0` | Minute to send the report |
| `REPORT_TIMEZONE` | `Asia/Karachi` | Timezone for the cron schedule (any tz database name) |

---

## Running with Docker (Recommended)

This is the standard way to run the full stack. Both Evolution API and the complaint backend start together.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A WhatsApp number to use as the bot (a spare SIM or second number works fine)

### Step 1 — Configure environment

```bash
cd complaint-service
cp .env.example .env
```

Open `.env` and set at minimum:
```env
EVOLUTION_API_KEY=your-strong-random-key-here
GROQ_API_KEY=your-groq-api-key-here
```

Also update `docker-compose.yml` — find the two lines with `change-me-strong-key-123` and replace with the same key you put in `.env`:
```yaml
AUTHENTICATION_API_KEY: your-strong-random-key-here   # in evolution service
EVOLUTION_API_KEY: your-strong-random-key-here         # in api service
```

### Step 2 — Start the stack

```bash
docker compose up --build
```

Wait until you see both services healthy:
```
complaint_evolution  | Server is running on port 8080
complaint_api        | Application startup complete.
```

### Step 3 — Link your WhatsApp number (QR code scan)

This only needs to be done once. Evolution API stores the session in a Docker volume and reconnects automatically on future restarts.

**Option A — via the complaint API (easiest):**

Open this URL in your browser:
```
http://localhost:8000/evolution/qr
```
You will get a JSON response with a `qr_code_base64` string. Paste it into any [base64 image decoder](https://base64.guru/converter/decode/image) to see the QR code, then scan it with WhatsApp.

**Option B — via Evolution API Swagger UI:**

1. Open **http://localhost:8080/docs** in your browser
2. Click **Authorize** (top right) and enter your `EVOLUTION_API_KEY`
3. Find `GET /instance/connect/{instanceName}` → click **Try it out**
4. Enter instance name: `complaint-bot` → click **Execute**
5. The response includes a `base64` QR code image — copy and decode it

**Scanning the QR code in WhatsApp:**

1. Open WhatsApp on your phone
2. Tap **Settings** → **Linked Devices** → **Link a Device**
3. Scan the QR code
4. Done — the bot is now connected

### Step 4 — Verify the connection

```bash
curl http://localhost:8000/evolution/status
```

Expected response when connected:
```json
{
  "instance": "complaint-bot",
  "connection_state": {
    "instance": "complaint-bot",
    "state": "open"
  }
}
```

`"state": "open"` means the bot is live and ready to receive messages.

### Step 5 — Test it

Send a message to any WhatsApp group the bot number is a member of:
```
The lift on 3rd floor is broken and stuck
```

Within seconds you should see:
- A ticket created in the database
- A WhatsApp reply in the group confirming the ticket number
- A log line in `docker compose logs -f api`

---

## Running Locally (without Docker)

Use this if you want to run just the FastAPI backend during development (without Evolution API).

### Prerequisites

- Python 3.12+
- pip

### Steps

```bash
cd complaint-service

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env — GROQ_API_KEY is optional, everything else has safe defaults

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API live at **http://localhost:8000** — Swagger UI at **http://localhost:8000/docs**

> Note: Without Evolution API running, the bot cannot receive or send WhatsApp messages. Use `/webhook/classify` and `/webhook/message` to test the pipeline manually.

---

## Docker Commands Reference

```bash
# Start everything (first time — builds image)
docker compose up --build

# Start in background
docker compose up -d

# Follow logs for both services
docker compose logs -f

# Follow only the API logs
docker compose logs -f api

# Follow only the Evolution API logs
docker compose logs -f evolution

# Stop everything (keeps all data)
docker compose down

# Stop and wipe all data (SQLite DB + WhatsApp session)
docker compose down -v

# Rebuild after code changes
docker compose up --build api

# Restart just the API (after config changes)
docker compose restart api
```

---

## Verifying the Full Setup

```bash
# 1. Both containers healthy
docker compose ps
# Expected: STATUS = healthy for both

# 2. API health check
curl http://localhost:8000/health
# Expected: {"status": "ok"}

# 3. WhatsApp connection state
curl http://localhost:8000/evolution/status
# Expected: {"connection_state": {"state": "open"}}

# 4. Classify a test message (no DB writes, no WhatsApp)
curl -X POST http://localhost:8000/webhook/classify \
  -H "Content-Type: application/json" \
  -d '{"message_text": "The elevator on floor 3 is broken urgently"}'
# Expected: {"is_complaint": true, "category": "Lift", "priority": "High", ...}

# 5. View active policy rules
curl http://localhost:8000/policy/
# Expected: JSON with all policy rules and current values

# 6. Simulate a policy decision
curl -X POST http://localhost:8000/policy/simulate \
  -H "Content-Type: application/json" \
  -d '{"message_text": "hello how are you", "is_complaint": false, "confidence": 0.2}'
# Expected: {"final_outcome": {"will_create_ticket": false, "will_send_reply": false}}

# 7. Check the daily report scheduler
curl http://localhost:8000/reports/scheduler/status
# Expected: {"running": true, "next_run": "..."}
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

```bash
# Preview the report text (no sending)
curl http://localhost:8000/reports/daily/text

# Send it immediately to the configured WhatsApp group
curl -X POST http://localhost:8000/reports/daily/send
```

---

## Common Issues

**QR code not appearing / instance already exists**
Run `docker compose down -v` to wipe the Evolution volume, then `docker compose up --build` and scan again.

**`"state": "close"` after scanning**
The QR code expired before you scanned it. Fetch a fresh one from `http://localhost:8000/evolution/qr` and scan within 60 seconds.

**WhatsApp session lost after restart**
This should not happen — Evolution stores the session in the `evolution_data` Docker volume. If it does, the volume may have been deleted. Avoid `docker compose down -v` unless you want a full reset.

**No WhatsApp replies being sent**
Check that `EVOLUTION_API_KEY` matches in both `.env` and `docker-compose.yml`, and that `READ_ONLY_MODE` is not `true`. Visit `/evolution/config` to verify.

**GROQ API key not working**
The service falls back to the keyword classifier automatically. You will see a lower confidence score in responses. Get a free key at [console.groq.com](https://console.groq.com).

**Port 8080 already in use (Evolution API)**
Change the host port in `docker-compose.yml` from `"8080:8080"` to e.g. `"8081:8080"`, then access Evolution at `http://localhost:8081`.

**Port 8000 already in use (FastAPI)**
Change `"8000:8000"` to e.g. `"8001:8000"` in `docker-compose.yml`.

**Database is reset after restart**
This happens only if you run `docker compose down -v`. Omit the `-v` flag to keep all data.

**Wrong timezone on scheduled reports**
Set `REPORT_TIMEZONE` to a valid [tz database name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) such as `Asia/Karachi`, `UTC`, or `Asia/Dubai`.
