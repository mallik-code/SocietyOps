# System Architecture

SocietyOps is a distributed system designed to bridge the gap between unstructured social communication (WhatsApp) and structured operational management (Ticketing System).

## 1. High-Level Component Map

The system consists of five primary containers orchestrated via Docker Compose:

1.  **FastAPI Complaint Engine (`api`)**: The "Brain" of the system. Handles AI classification, business logic, and ticket storage (SQLite).
2.  **FastAPI Knowledge Engine (`knowledge-service`)**: The "Memory" of the system. A standalone RAG microservice for community knowledge.
3.  **Express API Server (`api-server`)**: The "Gateway". Provides a unified API for the dashboard, proxies requests to the Python backend, and handles real-time message streams.
4.  **React Dashboard (`dashboard`)**: The "Interface". A modern React 19 SPA for visualizing data, managing policies, and connecting WhatsApp.
5.  **Evolution API (`evolution`)**: The "Bridge". A self-hosted WhatsApp gateway that manages sessions and provides a webhook/API interface for WhatsApp.
6.  **Postgres (`postgres`)**: The "Session Store". Stores Evolution API session data and dashboard policy configurations.

## 2. Internal Service Architecture (Python)

The Python backend follows a strict **Three-Layered Architecture** to ensure maintainability and testability:

### Controller Layer (`app/routers/`)
*   **Responsibility**: Entry points (HTTP/Webhooks).
*   **Rule**: Validates incoming request shapes (Pydantic) and delegates all business logic to the Service layer.
*   **Key Routers**: `evolution.py` (WhatsApp events), `tickets.py` (CRUD), `supervisor.py` (Admin commands).

### Service Layer (`app/services/`)
*   **Responsibility**: Business logic, workflow orchestration, and AI integration.
*   **Rule**: Coordinates between Repositories and external clients. Manages database transactions (`db.commit()`).
*   **Key Services**: 
    *   `MessageOrchestrator`: Coordinates the entire flow of an incoming message.
    *   `AIClassifier`: Interfaces with GROQ Llama 3 for classification.
    *   `ResolutionMatcher`: Performs semantic matching for automatic ticket closing.

### Repository Layer (`app/repositories/`)
*   **Responsibility**: Data access and persistence.
*   **Rule**: Encapsulates all SQLAlchemy queries. Returns domain models (`Ticket`, `MessageLog`). Does NOT manage transactions.
*   **Key Repository**: `TicketRepository`.

## 3. Data Flow

### Inbound Message Flow
1.  **Resident** sends a WhatsApp message.
2.  **Evolution API** receives the message and triggers a webhook to `api-server`.
3.  **api-server** forwards the raw event to the `complaint-service`.
4.  **MessageOrchestrator** (Python) processes the message:
    *   Checks **Policy Engine Phase 1** (Blocked senders, groups, keywords).
    *   Calls **AIClassifier** to determine `intent`, `category`, and `priority`.
    *   If `QUESTION`: Proxies search to **knowledge-service** to retrieve community answers.
    *   If `ISSUE_RESOLUTION`: Calls **ResolutionMatcher** to find the corresponding open ticket.
    *   If `NEW_COMPLAINT`: Checks **Policy Engine Phase 2** (Confidence score) and creates a new ticket.
5.  **knowledge-service** (Python):
    *   Generates vector embeddings (Gemini/Groq).
    *   Performs Hybrid Search (Vector + BM25) across the community brain.
6.  **Evolution API** sends a confirmation/reply back to the WhatsApp group.

## 4. Networking & Infrastructure
*   **Service Discovery**: Services communicate via container names:
    *   `http://api:8000` (complaint-service)
    *   `http://knowledge-service:8000` (knowledge-service)
*   **Storage**: 
    *   SQLite (`complaints.db`) for ticket data.
    *   PostgreSQL for Evolution session state and dashboard-specific configurations.
