# SocietyOps — API ↔ File Map

Quick reference: every API endpoint, where it lives in source, and which frontend file calls it.

---

## Express API Server (`artifacts/api-server/`)

Entry point: `artifacts/api-server/src/index.ts`
All routes mounted under `/api/` via `artifacts/api-server/src/routes/`

### AI Chat — `routes/ai.ts`

| Method | Path | Line | Frontend Hook | Frontend Component |
|--------|------|------|---------------|--------------------|
| GET | `/api/ai/conversations` | 147 | `useListAiConversations` | `PromptPage.tsx:146` |
| POST | `/api/ai/conversations` | 162 | `useCreateAiConversation` | `PromptPage.tsx:152` |
| DELETE | `/api/ai/conversations/:id` | 177 | `useDeleteAiConversation` | `PromptPage.tsx:162` |
| GET | `/api/ai/conversations/:id/messages` | 187 | `useListAiMessages` | `PromptPage.tsx:147` |
| POST | `/api/ai/chat` | 211 | raw `fetch` SSE | `PromptPage.tsx:249` |

Model used: `process.env.AI_MODEL` (default `llama-3.3-70b-versatile`)
Provider: `AI_INTEGRATIONS_OPENAI_BASE_URL` (default Groq)

### Dashboard & Tickets — `routes/dashboard.ts`

| Method | Path | Line | Frontend Hook | Frontend Component |
|--------|------|------|---------------|--------------------|
| GET | `/api/dashboard/stats` | 213 | `useGetDashboardStats` | `dashboard/KPICards.tsx:7` |
| GET | `/api/dashboard/categories` | 255 | `useGetCategoryBreakdown` | `dashboard/Charts.tsx:78` |
| GET | `/api/dashboard/priorities` | 266 | `useGetPriorityBreakdown` | `dashboard/Charts.tsx:79` |
| GET | `/api/dashboard/trend` | 280 | `useGetDailyTrend` | `dashboard/Charts.tsx:77` |
| GET | `/api/dashboard/status-breakdown` | 310 | `useGetStatusBreakdown` | `dashboard/Charts.tsx:80` |
| GET | `/api/dashboard/whatsapp-status` | 322 | `useGetWhatsappStatus` | `dashboard/` |
| GET | `/api/dashboard/recent-activity` | 332 | `useGetRecentActivity` | `dashboard/RecentActivity.tsx:8` |
| GET | `/api/tickets` | 388 | `useListTickets` | `dashboard/TicketsTable.tsx:31` |
| GET | `/api/tickets/:id` | 410 | `useGetTicket` | — |
| PATCH | `/api/tickets/:id/status` | 420 | `useUpdateTicketStatus` | `dashboard/TicketsTable.tsx:38` |

### Connect (WhatsApp + Telegram) — `routes/connect.ts`

| Method | Path | Line | Frontend Hook | Frontend Component |
|--------|------|------|---------------|--------------------|
| GET | `/api/connect/whatsapp/qr` | 51 | `useGetWhatsappQr` | `ConnectPage.tsx:92` |
| GET | `/api/connect/whatsapp/status` | 81 | `useGetWhatsappConnectStatus` | `ConnectPage.tsx:88` |
| POST | `/api/connect/whatsapp/logout` | 107 | `useLogoutWhatsapp` | `ConnectPage.tsx:96` |
| POST | `/api/connect/whatsapp/_simulate_connect` | 120 | — | demo only |
| GET | `/api/connect/telegram/status` | 126 | `useGetTelegramStatus` | `ConnectPage.tsx:269` |
| POST | `/api/connect/telegram` | 136 | `useSetupTelegram` | `ConnectPage.tsx:277` |
| DELETE | `/api/connect/telegram` | 162 | — | — |
| GET | `/api/connect/telegram/qr` | 170 | `useGetTelegramQr` | `ConnectPage.tsx:273` |

### Policies (Groups + Contacts) — `routes/policies.ts`

| Method | Path | Line | Frontend Hook | Frontend Component |
|--------|------|------|---------------|--------------------|
| GET | `/api/policies/groups` | 124 | `useListTrackedGroups` | `PoliciesPage.tsx:432` |
| POST | `/api/policies/groups` | 128 | `useAddTrackedGroup` | `PoliciesPage.tsx:66` |
| PATCH | `/api/policies/groups/:id` | 159 | `useUpdateTrackedGroup` | `PoliciesPage.tsx:249` |
| DELETE | `/api/policies/groups/:id` | 177 | `useDeleteTrackedGroup` | `PoliciesPage.tsx:255` |
| GET | `/api/policies/contacts` | 188 | `useListTrackedContacts` | `PoliciesPage.tsx:433` |
| POST | `/api/policies/contacts` | 192 | `useAddTrackedContact` | `PoliciesPage.tsx:159` |
| PATCH | `/api/policies/contacts/:id` | 223 | `useUpdateTrackedContact` | `PoliciesPage.tsx:335` |
| DELETE | `/api/policies/contacts/:id` | 241 | `useDeleteTrackedContact` | `PoliciesPage.tsx:341` |

### Health — `routes/health.ts`

| Method | Path | Line | Frontend Hook |
|--------|------|------|---------------|
| GET | `/api/healthz` | 6 | `useHealthCheck` |

---

## FastAPI Complaint Service (`complaint-service/app/`)

Entry point: `complaint-service/app/main.py`
Routers in: `complaint-service/app/routers/`

### WhatsApp Webhook — `routers/evolution.py`

| Method | Path | Line | Notes |
|--------|------|------|-------|
| POST | `/evolution/events` | 129 | Main inbound message handler — deduplicates by `message_id` |
| GET | `/evolution/status` | 310 | Evolution API instance status |
| GET | `/evolution/qr` | 325 | QR code for WhatsApp linking |
| GET | `/evolution/config` | 339 | Active Evolution configuration |

### OpenClaw Webhook — `routers/openclaw.py`

| Method | Path | Line | Notes |
|--------|------|------|-------|
| POST | `/openclaw/events` | 100 | Alternative WhatsApp provider webhook |
| GET | `/openclaw/config` | 243 | OpenClaw + policy configuration |

### Policy Engine — `routers/policy.py`

| Method | Path | Line | Notes |
|--------|------|------|-------|
| GET | `/policy/` | 13 | Active policy configuration |
| POST | `/policy/simulate` | 46 | Dry-run policy decision (no side effects) |

### Daily Reports — `routers/reports.py`

| Method | Path | Line | Notes |
|--------|------|------|-------|
| GET | `/reports/daily` | 20 | Daily report as JSON |
| GET | `/reports/daily/text` | 36 | Daily report as WhatsApp text |
| POST | `/reports/daily/send` | 60 | Trigger & send report now |
| GET | `/reports/scheduler/status` | 94 | Scheduler status & next run time |

### Supervisor — `routers/supervisor.py`

| Method | Path | Line | Notes |
|--------|------|------|-------|
| POST | `/supervisor/reply` | 35 | Free-text supervisor command (parsed by `supervisor_parser.py`) |
| POST | `/supervisor/actions` | 66 | Log a supervisor action on a ticket |
| GET | `/supervisor/actions` | 90 | List all supervisor actions |
| GET | `/supervisor/actions/ticket/{ticket_id}` | 99 | Actions for a specific ticket |

### Tickets — `routers/tickets.py`

| Method | Path | Line | Notes |
|--------|------|------|-------|
| GET | `/tickets` | 15 | List tickets (supports filters) |
| POST | `/tickets` | 37 | Create ticket manually |
| GET | `/tickets/{ticket_id}` | 46 | Get ticket by ID |
| PATCH | `/tickets/{ticket_id}` | 54 | Update ticket fields |
| DELETE | `/tickets/{ticket_id}` | 67 | Delete ticket |

### Direct Webhook — `routers/webhooks.py`

| Method | Path | Line | Notes |
|--------|------|------|-------|
| POST | `/webhook/message` | 35 | Receive WhatsApp message directly |
| POST | `/webhook/classify` | 142 | Classify without creating ticket |

---

## Frontend Component → API Map

`artifacts/dashboard/src/components/`

| Component | Hooks Used | Purpose |
|-----------|-----------|---------|
| `PromptPage.tsx` | `useListAiConversations`, `useCreateAiConversation`, `useDeleteAiConversation`, `useListAiMessages`, raw SSE fetch | AI chat interface |
| `ConnectPage.tsx` | `useGetWhatsappQr`, `useGetWhatsappConnectStatus`, `useLogoutWhatsapp`, `useGetTelegramStatus`, `useSetupTelegram`, `useGetTelegramQr` | Connect WhatsApp & Telegram |
| `PoliciesPage.tsx` | `useListTrackedGroups`, `useListTrackedContacts`, `useAddTrackedGroup`, `useUpdateTrackedGroup`, `useDeleteTrackedGroup`, `useAddTrackedContact`, `useUpdateTrackedContact`, `useDeleteTrackedContact` | Manage tracked groups & contacts |
| `dashboard/KPICards.tsx` | `useGetDashboardStats` | KPI metrics cards |
| `dashboard/Charts.tsx` | `useGetDailyTrend`, `useGetCategoryBreakdown`, `useGetPriorityBreakdown`, `useGetStatusBreakdown` | Dashboard charts |
| `dashboard/RecentActivity.tsx` | `useGetRecentActivity` | Timeline of last 5 events |
| `dashboard/TicketsTable.tsx` | `useListTickets`, `useUpdateTicketStatus` | Tickets table with filters |

---

## Generated Code (DO NOT HAND-EDIT)

All hooks above come from:
- `lib/api-client-react/src/generated/api.ts` — React Query hooks
- `lib/api-zod/src/generated/` — Zod schemas

Source of truth: `lib/api-spec/` (OpenAPI YAML)
Regenerate with: `pnpm codegen` from repo root

---

## Key Env Vars for AI/API

| Var | File Set | Purpose |
|-----|----------|---------|
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | `.env` | OpenAI-compatible base URL (Groq, OpenAI, local) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | `.env` | API key for above endpoint |
| `AI_MODEL` | `.env` | Model name (e.g. `llama-3.3-70b-versatile`, `gpt-4o`) |
| `GROQ_API_KEY` | `.env` | Groq key for FastAPI classifier |
| `GROQ_MODEL` | `.env` | Groq model for FastAPI classifier |

---

## Service Ports

| Service | Local URL | Docker host |
|---------|-----------|-------------|
| Dashboard (React) | http://localhost:3000 | `dashboard:80` |
| API Server (Express) | http://localhost:3001 | `api-server:3001` |
| FastAPI | http://localhost:8000 | `api:8000` |
| FastAPI docs | http://localhost:8000/docs | — |
| Evolution API | http://localhost:8080 | `evolution:8080` |
