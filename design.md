# Design — Teams AI Agent: Leave Management

## 1. System Architecture

```
┌─────────────────────────────────────────────┐
│              Browser (React + Vite)          │
│  artifacts/teams-ai-agent  [port: dynamic]   │
│                                              │
│  Dashboard │ Simulator │ Leave Records       │
│  Employees │ Channels  │ Reports │ Settings  │
└─────────────────────┬───────────────────────┘
                      │ /api/* (Vite proxy)
                      ▼
┌─────────────────────────────────────────────┐
│         Express API Server                   │
│         apps/api-server  [port: 8080]        │
│                                              │
│  /api/teams/*   /api/leave   /api/employees  │
│  /api/reports   /api/settings/llm            │
│  /api/holidays  /api/healthz                 │
└─────────────────────┬───────────────────────┘
                      │ Drizzle ORM
                      ▼
┌─────────────────────────────────────────────┐
│         PostgreSQL Database                  │
│         (Replit managed)                     │
└─────────────────────────────────────────────┘
                      │ HTTPS (at runtime)
                      ▼
┌─────────────────────────────────────────────┐
│         LLM Provider (user-configured)       │
│  OpenAI │ Anthropic │ Groq │ Google Gemini   │
└─────────────────────────────────────────────┘
```

The monorepo is managed by pnpm workspaces and consists of:

| Package | Path | Purpose |
|---------|------|---------|
| `@workspace/teams-ai-agent` | `artifacts/teams-ai-agent/` | React + Vite frontend |
| `@workspace/api-server` | `apps/api-server/` | Express REST API + AI agent |
| `@workspace/db` | `lib/db/` | Drizzle ORM schema + migrations |
| `@workspace/api-client-react` | `lib/api-client-react/` | Generated React Query hooks |

---

## 2. Database Schema

### 2.1 `employees`
| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `full_name` | TEXT | |
| `first_name` | TEXT | |
| `last_name` | TEXT | |
| `department` | TEXT | |
| `role` | TEXT | |
| `manager_id` | INTEGER | Self-referencing FK |
| `org_level` | TEXT | `individual \| flm \| delivery_manager \| account_manager \| org_head` |
| `teams_user_id` | TEXT UNIQUE | Used for webhook matching |
| `email` | TEXT UNIQUE | |
| `created_at` | TIMESTAMPTZ | |

### 2.2 `leave_records`
| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `employee_id` | INTEGER | FK → employees |
| `leave_date` | DATE | |
| `leave_type` | TEXT | `full_day \| half_day \| multiple_days` |
| `status` | TEXT | `pending \| approved \| rejected` |
| `approved_by_id` | INTEGER | FK → employees |
| `source_message` | TEXT | Original Teams message text |
| `message_log_id` | INTEGER | FK → message_log |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 2.3 `message_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `message_text` | TEXT | |
| `sender_id` | INTEGER | FK → employees |
| `channel` | TEXT | Channel ID string |
| `intent` | TEXT | `leave_notification \| not_leave_related \| not_processed` |
| `confidence` | REAL | 0.0 – 1.0 |
| `action_taken` | TEXT | See action enum below |
| `clarification_question` | TEXT | Nullable |
| `agent_output` | JSONB | Full LLM response object |
| `created_at` | TIMESTAMPTZ | |

`action_taken` values: `leave_recorded`, `clarification_requested`, `holiday_conflict`, `unauthorized_poster`, `ignored`, `agent_disabled`.

### 2.4 `teams_channels`
| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `name` | TEXT | Display name |
| `channel_id` | TEXT UNIQUE | Matches `channel` field in messages |
| `description` | TEXT | Nullable |
| `agent_enabled` | BOOLEAN | Default TRUE |
| `message_count` | INTEGER | Incremented on every incoming message |
| `created_at` | TIMESTAMPTZ | |

### 2.5 `holidays`
| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `date` | DATE UNIQUE | |
| `name` | TEXT | |
| `type` | TEXT | `public \| optional` |

### 2.6 `llm_settings`
| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `provider` | TEXT | `openai \| anthropic \| groq \| gemini` |
| `model` | TEXT | e.g. `gpt-4o-mini` |
| `api_key` | TEXT | Nullable; stored encrypted at rest by host |
| `updated_at` | TIMESTAMPTZ | |

---

## 3. Organisational Hierarchy

```
Alex Thompson (org_head / CEO)
├── Robert Williams (delivery_manager / CTO)
│   ├── Sarah Mitchell (flm)
│   │   ├── Mallik Reddy (individual)
│   │   ├── Priya Sharma (individual)
│   │   └── John Smith — Engineering (individual)
│   └── David Chen (flm)
│       ├── Lisa Park (individual)
│       └── John Smith — HR (individual)
└── Emma Davis (account_manager / VP Sales)
    └── Rahul Kumar (flm)
        ├── Ananya Patel (individual)
        └── Tom Wilson (individual)
```

The Reports module computes leave aggregates by walking the subtree rooted at each manager using a recursive `getSubtreeIds` function. The Second Line Manager (SLM) level is derived dynamically: any manager whose direct reports include at least one FLM, excluding the org head.

---

## 4. API Endpoints

### Teams & Channels
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/teams/simulate` | Simulate a Teams message through the AI agent |
| POST | `/api/teams/webhook` | Real Teams webhook receiver (matches by `teams_user_id`) |
| GET  | `/api/teams/message-log` | List all processed messages |
| GET  | `/api/teams/channels` | List all channels |
| POST | `/api/teams/channels` | Create a channel |
| PATCH | `/api/teams/channels/:id` | Update channel (toggle `agent_enabled`, rename, etc.) |
| DELETE | `/api/teams/channels/:id` | Delete a channel |

### Leave Records
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leave` | List leave records (`?employee_id=&status=`) |
| POST | `/api/leave` | Create leave record manually |
| PATCH | `/api/leave/:id` | Update leave record |
| DELETE | `/api/leave/:id` | Delete leave record |
| GET | `/api/leave/stats` | Dashboard statistics |

### Employees & Holidays
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employees` | List all employees (with resolved manager names) |
| GET | `/api/employees/:id` | Get employee by ID |
| GET | `/api/holidays` | List all holidays |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | Aggregated leave report across all org levels |

### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings/llm` | Get current LLM config (key masked) |
| PATCH | `/api/settings/llm` | Update LLM provider / model / key |
| POST | `/api/settings/llm/test` | Test LLM connection; returns latency |

---

## 5. AI Agent Pipeline

```
Incoming message (text, sender_id, channel)
            │
            ▼
  1. Resolve channel
     ├── Lookup teams_channels by channel_id
     ├── If not found → auto-create with agent_enabled = true
     └── Increment message_count
            │
            ▼
  2. Check agent_enabled
     ├── FALSE → log with action = "agent_disabled", return early
     └── TRUE → continue
            │
            ▼
  3. Build LLM prompt
     ├── Inject today's date, employee list (id, name, dept, role, manager_id)
     └── Inject holidays list
            │
            ▼
  4. Call LLM (provider-specific HTTP request, temperature = 0.1)
     └── Parse JSON response (strip markdown fences if present)
            │
            ▼
  5. Evaluate agent output
     ├── intent = not_leave_related          → action = "ignored"
     ├── clarification_needed OR ambiguous   → action = "clarification_requested"
     ├── is_holiday = true                   → action = "holiday_conflict"
     ├── poster.is_manager_of_employee = false → action = "unauthorized_poster"
     └── resolved = true + matched_employee  → action = "leave_recorded"
            │
            ▼
  6. Persist message_log row (all cases)
            │
            ▼
  7. If action = "leave_recorded" → insert leave_records row
```

### LLM Prompt Structure

The prompt is a single user message containing:
- Today's date
- Full employee roster with IDs, departments, roles, and manager IDs
- Holiday list for the current year
- The raw message text
- Strict instructions to return a single JSON object (no markdown)

The response JSON schema includes: `intent`, `confidence`, `employee` (name_extracted, resolved, ambiguous, candidates, matched_employee), `leave_date`, `leave_type`, `is_holiday`, `poster` (employee_id, name, is_manager_of_employee), `action`, `clarification_needed`, `clarification_question`.

### Manager Authorisation Rule

`is_manager_of_employee` is true when:
- `poster.id == matched_employee.manager_id` (poster is the direct manager), OR
- `poster.manager_id == matched_employee.manager_id` (poster and employee share the same manager — peer-level approval, by LLM interpretation)

---

## 6. Reports Module

### Date Range Filtering

The `GET /api/reports` endpoint accepts optional `from` and `to` query parameters (ISO date strings). Defaults: `from` = first day of current month, `to` = today.

### Frontend Presets

| Preset | `from` | `to` |
|--------|--------|------|
| Today | today | today |
| This Week | Monday of current week | today |
| This Month | 1st of current month | today |
| This Quarter | 1st of current quarter | today |
| This Year | 1 Jan of current year | today |
| Custom | user input | user input |

### Aggregation Algorithm

```typescript
function getSubtreeIds(managerId, allEmployees): number[] {
  // Recursive DFS: returns managerId + all descendant IDs
}

function summarizeLeaves(employeeIds, leaves, from, to, today) {
  // Returns: leaves_in_period, leaves_today, by_type
  // Filters by status = "approved" and date range
}
```

The SLM (Second Line Manager) set is computed as: all managers whose `id` appears as `manager_id` of any FLM, excluding org heads.

---

## 7. Frontend Structure

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Dashboard` | Stats cards + recent messages + today's leave |
| `/simulator` | `Simulator` | Compose and send test messages with channel + sender selectors |
| `/leave` | `LeaveRecords` | Full leave record table with inline approve/reject |
| `/employees` | `EmployeeDirectory` | Company directory table |
| `/channels` | `Channels` | Channel list with ON/OFF toggle per channel |
| `/reports` | `Reports` | Multi-level leave reports with timeline filter |
| `/settings` | `Settings` | LLM provider/model/key configuration |

### State Management

- All server state is managed by **TanStack Query** (React Query).
- The generated `@workspace/api-client-react` package provides typed `useQuery` and `useMutation` hooks for all existing endpoints.
- The Channels page and the Simulator's channel dropdown use direct `fetch` calls (not generated hooks) since the channels API was added after code generation.

### Key UI Patterns

- **Loading**: skeleton/pulse cards while queries are in-flight
- **Errors**: inline destructive alert cards
- **Mutations**: toast notifications on success and failure (via shadcn/ui `Toaster`)
- **Toggle**: shadcn/ui `Switch` component used for channel agent ON/OFF
- **Tabs**: custom `<button>` tab bars (not Radix tabs) for level and preset switching

---

## 8. LLM Provider Integration

Each provider uses its own HTTP API format:

| Provider | Base URL | Auth Header | Response Path |
|----------|----------|-------------|---------------|
| OpenAI | `api.openai.com/v1/chat/completions` | `Authorization: Bearer` | `choices[0].message.content` |
| Anthropic | `api.anthropic.com/v1/messages` | `x-api-key` | `content[0].text` |
| Groq | `api.groq.com/openai/v1/chat/completions` | `Authorization: Bearer` | `choices[0].message.content` |
| Gemini | `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=` | query param | `candidates[0].content.parts[0].text` |

The API key is resolved by priority: stored DB value → environment variable `{PROVIDER_API_KEY}`.

---

## 9. Migrations Strategy

All migrations are written as idempotent SQL in `lib/db/src/index.ts` → `runMigrations()`, executed at server startup. Every statement uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, ensuring safe re-runs on restart.

Schema types are defined in `lib/db/src/schema/` as individual Drizzle table files, exported via `lib/db/src/schema/index.ts`.

---

## 10. Deployment

- Frontend: Vite dev server proxying `/api/*` to `http://localhost:8080`
- Backend: Node.js with esbuild bundle (`build.mjs`), runs on `PORT` env var (default 8080)
- Database: `DATABASE_URL` environment variable → Replit managed PostgreSQL
- Secrets: API keys stored in the `llm_settings` DB table; never written to environment files
