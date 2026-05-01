# Requirements — WhatsApp Complaint Management System

## 1. Project Overview

An AI-powered backend service that receives citizen complaints forwarded from WhatsApp groups via OpenClaw, automatically classifies them, stores them as tracked tickets, and provides reporting for supervisors.

---

## 2. Functional Requirements

### 2.1 Message Ingestion

| ID    | Requirement |
|-------|-------------|
| FR-01 | The system SHALL accept incoming messages via a REST webhook (`POST /webhook/message`). |
| FR-02 | Each incoming message SHALL be logged in `message_logs` before any processing begins. |
| FR-03 | The webhook SHALL return the created ticket ID, category, and priority in the response. |
| FR-04 | OpenClaw (or any HTTP client) SHALL be able to POST a JSON payload containing: `message_text`, `sender`, `group_name`, `reporter_name`, and optional `location`. |

### 2.2 AI Classification

| ID    | Requirement |
|-------|-------------|
| FR-05 | The system SHALL automatically classify each complaint into one of the predefined categories: Water Supply, Electricity, Road & Infrastructure, Garbage & Sanitation, Noise Pollution, Public Safety, Healthcare, Education, Housing, Transportation, Environment, Other. |
| FR-06 | The system SHALL assign a priority level: CRITICAL, HIGH, MEDIUM, or LOW. |
| FR-07 | When `OPENAI_API_KEY` is configured, the system SHALL use the OpenAI Chat Completions API for classification. |
| FR-08 | When no API key is configured, the system SHALL fall back to a keyword-based classifier with no external dependencies. |
| FR-09 | Classification failures SHALL NOT prevent ticket creation; the system SHALL default to category="Other" and priority="MEDIUM". |

### 2.3 Ticket Management

| ID    | Requirement |
|-------|-------------|
| FR-10 | The system SHALL create a ticket for every valid incoming message. |
| FR-11 | Tickets SHALL have a status of OPEN, IN_PROGRESS, or RESOLVED. |
| FR-12 | Supervisors SHALL be able to list tickets with filters for status, priority, category, and group name. |
| FR-13 | Supervisors SHALL be able to update a ticket's status, priority, category, and location. |
| FR-14 | Supervisors SHALL be able to delete a ticket. |

### 2.4 Supervisor Actions

| ID    | Requirement |
|-------|-------------|
| FR-15 | Supervisors SHALL log actions against a ticket: STARTED, RESOLVED, or DELAYED. |
| FR-16 | When action=STARTED is logged, the ticket status SHALL automatically change to IN_PROGRESS. |
| FR-17 | When action=RESOLVED is logged, the ticket status SHALL automatically change to RESOLVED. |
| FR-18 | All supervisor actions SHALL be timestamped and stored permanently for audit purposes. |

### 2.5 Reporting

| ID    | Requirement |
|-------|-------------|
| FR-19 | The system SHALL provide a daily report endpoint (`GET /reports/daily`). |
| FR-20 | The daily report SHALL include: total tickets, open/in-progress/resolved counts, breakdown by category, breakdown by priority, and average resolution time in hours. |
| FR-21 | The report date SHALL default to the current UTC day if not specified. |

---

## 3. Non-Functional Requirements

| ID     | Requirement |
|--------|-------------|
| NFR-01 | The API SHALL respond within 2 seconds for all endpoints under normal load. |
| NFR-02 | The system SHALL run with zero external infrastructure dependencies (SQLite, no external DB server). |
| NFR-03 | The application SHALL be fully containerised using Docker and deployable with a single `docker compose up` command. |
| NFR-04 | The system SHALL expose interactive API documentation at `/docs` (Swagger UI) and `/redoc`. |
| NFR-05 | All timestamps SHALL be stored and returned in UTC ISO-8601 format. |
| NFR-06 | The codebase SHALL be modular with clear separation between routers, services, models, and schemas. |
| NFR-07 | The system SHALL support horizontal configuration via environment variables. |
| NFR-08 | A health check endpoint (`GET /health`) SHALL return HTTP 200 when the service is running. |

---

## 4. Integration Requirements

| ID    | Requirement |
|-------|-------------|
| IR-01 | OpenClaw SHALL send complaint messages to `POST /webhook/message` as JSON. |
| IR-02 | The OpenAI API integration SHALL be opt-in via environment variable. |
| IR-03 | CORS headers SHALL be configurable to allow any dashboard or admin frontend to consume the API. |

---

## 5. Constraints

- Language: Python 3.12
- Framework: FastAPI
- Database: SQLite (single file, no migration tool required for v1)
- ORM: SQLAlchemy 2.x
- Validation: Pydantic v2
- Containerisation: Docker + Docker Compose
- AI provider: OpenAI (optional); built-in keyword classifier as fallback

---

## 6. Out of Scope (v1)

- User authentication / API key management
- Multi-tenant support
- Real-time push notifications
- SMS / email alerts
- Dashboard frontend
- PostgreSQL / MySQL support (planned for v2)
