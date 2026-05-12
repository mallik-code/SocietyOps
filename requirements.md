# Requirements — Teams AI Agent: Leave Management

## 1. Overview

Teams AI Agent is a web application that monitors Microsoft Teams channels for employee leave notifications. It uses a configurable large language model (LLM) to detect leave messages, verify manager authorisation, cross-check company holidays, handle ambiguous employee names, and record approved leaves automatically. The system provides a full management interface covering employees, leave records, channel control, organisational reporting, and LLM configuration.

---

## 2. Functional Requirements

### 2.1 AI Agent — Message Processing

| ID | Requirement |
|----|-------------|
| F-01 | The system shall accept Teams messages via a simulation endpoint and a webhook endpoint. |
| F-02 | The agent shall classify each message as `leave_notification` or `not_leave_related`. |
| F-03 | The agent shall extract the employee name from the message and attempt to resolve it against the employee directory. |
| F-04 | If a name matches exactly one employee, the record shall be marked resolved. |
| F-05 | If a name matches two or more employees (ambiguous), the agent shall request clarification and list all candidates. |
| F-06 | The agent shall verify that the message sender is the direct manager of the named employee. Messages from unauthorised senders shall be rejected with action `unauthorized_poster`. |
| F-07 | The agent shall cross-check the requested leave date against the holidays table. If the date is a public holiday, the action shall be `holiday_conflict`. |
| F-08 | The agent shall parse relative dates ("today", "tomorrow") correctly against the current server date. |
| F-09 | Supported leave types are: `full_day`, `half_day`, `multiple_days`. |
| F-10 | A confidence score (0.0 – 1.0) shall be recorded for every processed message. |
| F-11 | Every message processed by the agent (or skipped due to a disabled channel) shall be persisted to the message log. |
| F-12 | When a leave is successfully approved and recorded the system shall create a corresponding leave record automatically. |

### 2.2 Channel Management

| ID | Requirement |
|----|-------------|
| F-13 | Administrators shall be able to view all registered Teams channels. |
| F-14 | Each channel shall have an independent AI agent ON/OFF toggle. |
| F-15 | When the agent is OFF for a channel, messages from that channel shall be logged with action `agent_disabled` and no LLM call shall be made. |
| F-16 | New channels seen for the first time (via simulator or webhook) shall be auto-registered with the agent enabled. |
| F-17 | The system shall maintain a message count per channel (total messages received regardless of agent status). |
| F-18 | Administrators shall be able to add new channels manually (name, channel ID, optional description). |
| F-19 | Administrators shall be able to delete channels. |
| F-20 | Channel IDs shall be unique; duplicate registration shall return HTTP 409. |

### 2.3 Employee Directory

| ID | Requirement |
|----|-------------|
| F-21 | The system shall store a company employee directory with full name, first name, last name, department, role, email, Teams user ID, manager reference, and organisational level. |
| F-22 | Org levels are: `individual`, `flm` (First Line Manager), `delivery_manager`, `account_manager`, `org_head`. |
| F-23 | The API shall expose a list-all and a get-by-ID endpoint for employees. |
| F-24 | The frontend shall display the full directory with manager names resolved. |

### 2.4 Leave Records

| ID | Requirement |
|----|-------------|
| F-25 | Leave records shall store: employee reference, leave date, leave type, status (pending / approved / rejected), approver reference, source message, and message log reference. |
| F-26 | Administrators shall be able to create leave records manually via the API. |
| F-27 | Administrators shall be able to update the status of any leave record (approve / reject). |
| F-28 | Administrators shall be able to delete leave records. |
| F-29 | The API shall support filtering leave records by employee ID and/or status. |
| F-30 | The frontend shall allow inline status changes (approve / reject) for pending records. |

### 2.5 Holidays

| ID | Requirement |
|----|-------------|
| F-31 | The system shall maintain a holidays table (date, name, type). |
| F-32 | Holidays shall be loaded into the LLM prompt so the agent can detect conflicts. |
| F-33 | The API shall expose a read-only holidays endpoint. |

### 2.6 Leave Reports

| ID | Requirement |
|----|-------------|
| F-34 | The system shall provide aggregated leave reports across six organisational levels: Company, Org Head, Delivery Manager, Account Manager, Second Line Manager, and First Line Manager. |
| F-35 | Reports shall be filterable by a date range with presets: Today, This Week, This Month, This Quarter, This Year, and Custom. |
| F-36 | Custom date range shall accept arbitrary from/to dates via date picker inputs. |
| F-37 | Company-level report shall include: total employees, on-leave today, leaves in selected period, leave type distribution, and a per-department breakdown. |
| F-38 | Manager-level reports shall show per-manager: team size, departments covered, on-leave today, leaves in period, and leave type distribution. |
| F-39 | Manager tables shall be sorted by leaves in period, descending. |
| F-40 | Department rows in the company view shall be sorted by leaves in period, descending. |

### 2.7 Dashboard

| ID | Requirement |
|----|-------------|
| F-41 | The dashboard shall display: leaves this month, leaves today, pending approvals, and messages processed today. |
| F-42 | The dashboard shall show the five most recent processed messages. |
| F-43 | The dashboard shall show today's leave activity. |

### 2.8 LLM Configuration

| ID | Requirement |
|----|-------------|
| F-44 | The system shall support four LLM providers: OpenAI, Anthropic, Groq, and Google Gemini. |
| F-45 | Provider, model name, and API key shall be configurable at runtime via the Settings page without a server restart. |
| F-46 | API keys shall be stored in the database and never returned in full to the frontend. The frontend shall only receive an `api_key_set` boolean flag. |
| F-47 | The Settings page shall provide a "Test Connection" action that sends a minimal test prompt and reports latency. |

### 2.9 Simulator

| ID | Requirement |
|----|-------------|
| F-48 | The Simulator page shall allow selection of a target channel from all registered channels. |
| F-49 | If the selected channel has the agent disabled, a warning shall be shown before the message is sent. |
| F-50 | The Simulator shall allow selection of any registered employee as the sender. |
| F-51 | The Simulator result view shall display intent, confidence, action taken, any clarification question, and the raw agent JSON. |

---

## 3. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NF-01 | The backend API shall respond to all read endpoints within 500 ms under normal load. |
| NF-02 | API keys shall never be logged or exposed in API responses. |
| NF-03 | All database schema changes shall be applied via idempotent migrations (using `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE … ADD COLUMN IF NOT EXISTS`). |
| NF-04 | The frontend shall display skeleton loading states while data is fetching. |
| NF-05 | The system shall function without any external services other than the chosen LLM provider. |
| NF-06 | The application shall be deployable as a pnpm monorepo on a single host with a PostgreSQL database. |
| NF-07 | LLM prompts shall use `temperature: 0.1` to maximise determinism. |

---

## 4. Constraints

- PostgreSQL is the only supported database.
- The LLM must be configured by the user; no default key is provided.
- The system simulates Teams integration; real Microsoft Graph/Teams webhook integration is out of scope for this version.
- WhatsApp-related routes exist in the API server but are outside the scope of this application.
