# Detailed System Design

This document outlines the features, functionalities, and detailed design choices for SocietyOps.

## 1. Core Features

### A. Intelligent Complaint Ingestion
The system automatically captures WhatsApp messages from tracked groups and determines if they represent a new issue.
*   **Design**: Uses a two-phase policy filter to ignore casual chat, spam, or messages from untracked senders before reaching the AI layer.
*   **Categories**: Lift, Garbage, Cleaning, Water, Electrical, Security, and Other.

### B. AI Classification & Priority
Every complaint is classified using Large Language Models (LLMs).
*   **Design**: 
    *   **Primary**: GROQ API with `llama-3.1-8b-instant`.
    *   **Fallback**: Regex-based keyword matcher for zero-downtime classification if the API is unreachable or the key is missing.
*   **Priority Logic**: AI evaluates urgency; if confidence is low, the policy engine can flag it for manual review.

### C. Automated Issue Resolution
The system can "understand" when a problem is fixed based on a follow-up message.
*   **Design**: 
    *   **Intent Detection**: AI identifies the `ISSUE_RESOLUTION` intent (e.g., *"Water brown colour issue resolved"*).
    *   **Semantic Matcher**: A dedicated service compares the resolution summary against all currently `open` or `in_progress` tickets.
    *   **Auto-Update**: If a match is found, the ticket status is updated to `resolved` and a supervisor action is logged.

### D. Supervisor Commands
Managers can control the system directly from WhatsApp using shorthand commands.
*   **Design**: Regex parser for patterns like `<ID> resolved`, `<ID> in_progress`, or `<ID> ignore`.
*   **Action Tracking**: Every command creates a record in the `supervisor_actions` table for auditing.

### E. Real-Time Dashboard
A single-pane-of-glass for tracking society operations.
*   **Key Metrics**: Total tickets, open vs. resolved ratio, daily trends, and category distribution.
*   **Activity Feed**: Live stream of incoming messages and ticket updates using Server-Sent Events (SSE).
*   **AI Assistant**: A built-in chat interface that allows managers to ask questions about the data (e.g., *"How many water issues did we have this week?"*).

## 2. Component Design

### Message Orchestrator Service
The central "Traffic Controller" for message processing.
*   **Logic Flow**:
    1.  `evaluate_inbound()`: Check if sender/group is allowed.
    2.  `classify_complaint()`: Call AI for categorization.
    3.  `handle_intent()`: Route to `ResolutionMatcher` or `TicketRepository`.
    4.  `generate_reply()`: Craft the WhatsApp response.
    5.  `db.commit()`: Finalize all changes atomically.

### Policy Engine
A rule-based validator that protects the system from noise.
*   **Configurable Rules**: 
    *   `MIN_CONFIDENCE`: Minimum AI score required to create a ticket (Default: 0.7).
    *   `ALLOWED_GROUPS`: List of WhatsApp JIDs allowed to trigger tickets.
    *   `READ_ONLY_MODE`: If true, the system logs messages but creates no tickets/replies.

### Dashboard Frontend
Built with **React 19** and **Tailwind CSS 4**.
*   **Data Fetching**: Uses Orval-generated React Query hooks for type-safe API interaction.
*   **State Management**: React Query cache for server state; local state for UI transitions.
*   **UI System**: shadcn/ui components built on Radix UI primitives.

## 3. Data Models

### Ticket
| Field | Description |
|---|---|
| `id` | Auto-incrementing primary key |
| `message_text` | Original WhatsApp text |
| `category` | AI-assigned category |
| `priority` | High/Medium/Low |
| `status` | open/in_progress/resolved/ignored |
| `reporter_name` | WhatsApp display name |
| `group_name` | Name of the group message arrived from |

### SupervisorAction
Tracks who did what to a ticket.
*   Fields: `id`, `ticket_id`, `action` (resolved, in_progress, etc.), `timestamp`.

## 4. Security Design
*   **API Keys**: All external API calls (Evolution, GROQ) are gated by environment variables.
*   **Input Sanitization**: Pydantic models at the router boundary ensure no malformed data reaches the service layer.
*   **Internal Isolation**: The Evolution API database (Postgres) is not exposed to the host machine; it is only reachable by the `evolution` container.
