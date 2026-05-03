# Requirements: Knowledge Preservation System (KPS)

## 1. Problem Statement
Community groups (e.g., WhatsApp) suffer from "Knowledge Decay." Valuable information provided in response to a query is lost in the chat history. Subsequent members asking the same question often go unanswered because the knowledgeable members are busy or have left, leading to frustration and inefficiency.

## 2. Objective
To build an intelligent system that:
1.  **Extracts** and saves useful information from group conversations.
2.  **Monitors** unanswered questions.
3.  **Responds** automatically using a combination of internal knowledge and external search (Google, Gemini, Groq) when humans do not intervene.
4.  **Validates** responses to maintain social harmony and accuracy.

## 3. Functional Requirements

### 3.1 Knowledge Capture (The Harvester)
- **Automatic Extraction:** The system must identify "Question-Answer" pairs in the chat and store them.
- **Manual Tagging:** Admins should be able to tag a specific message as "Knowledge" via the dashboard.
- **Categorization:** Knowledge should be categorized (e.g., Contacts, Procedures, Rules, General).

### 3.2 Question Monitoring (The Sentinel)
- **Detection:** Identify when a message is a request for information.
- **Timeout Mechanism:** Wait for a configurable period (e.g., 10-30 mins). If no human responds, trigger the AI.
- **Context Awareness:** Recognize if a follow-up question is related to a previous answer.

### 3.3 AI Response Generation (The Assistant)
- **Hybrid Retrieval:** 
    - Use **Semantic Search** (Vector) for understanding intent.
    - Use **Keyword Search** (BM25) for specific terms (e.g., specific error codes, names, or item names).
- **Multi-Source Search:** 
    - Priority 1: Internal Society Knowledge Base.
    - Priority 2: External Search (Google, LLMs like Gemini/Groq).
- **Temporal Relevance (Boosting):** Prioritize more recent information over older data using metadata boosting.
- **Synthesis:** Combine information into a concise, helpful response.
- **Source Attribution:** Clearly state where the information came from (e.g., "According to past discussions..." or "According to Google...").

### 3.4 Validation & Safety (The Diplomat)
- **Tone Check:** Ensure the response is polite, helpful, and community-centric.
- **Sensitive Content Filter:** Do not respond to political, religious, or inflammatory topics.
- **Hallucination Check:** Validate factual claims (especially phone numbers or dates) before posting.

## 4. Non-Functional Requirements
- **Low Intrusiveness:** The bot should not clutter the chat; it only speaks when necessary.
- **Accuracy:** Better to say "I don't know" than to give wrong information.
- **Privacy:** Personal private chats should never be harvested; only public group knowledge.

## 5. User Roles
- **Residents:** Benefit from instant answers.
- **Admins:** Curate the knowledge base and set bot personality.
- **System Bot:** Performs the harvesting and responding.
