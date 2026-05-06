import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations, messages, insertConversationSchema, insertMessageSchema } from "@workspace/db/schema";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq, asc, desc } from "drizzle-orm";
import { ticketRepository } from "../repositories/ticket.repository";
import { trackedGroups, trackedContacts } from "./policies.js";

const router: IRouter = Router();
const KNOWLEDGE_SERVICE_URL = process.env.KNOWLEDGE_SERVICE_URL || "http://localhost:8000";

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant integrated into a WhatsApp-based building complaint management system called ComplaintOps.

You have access to live data from the system — tickets, groups, contacts, and statistics are provided to you as structured context before every message. Use this data to give accurate, specific answers.

You can help with:
- Analyzing and summarizing complaint tickets using the real ticket data
- Identifying trends, patterns, and problem areas from actual stats
- Suggesting priority levels and categories based on existing ticket patterns
- Drafting response templates for supervisors
- Recommending which issues need immediate escalation
- Answering questions about specific tickets, locations, or reporters by name

Be concise, professional, and helpful. Format responses clearly using markdown when appropriate. Always reference actual ticket IDs, locations, and reporters when relevant.`;

// ── RAG context builder ───────────────────────────────────────────────────────

type ContextMeta = {
  tickets: number;
  open_tickets: number;
  high_priority: number;
  groups: number;
  contacts: number;
};

async function buildRagContext(): Promise<{ context: string; meta: ContextMeta }> {
  const now = new Date().toISOString();
  const tickets = await ticketRepository.getAllTickets();

  // Stats
  const total = tickets.length;
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
  }

  const openCount = (byStatus["open"] ?? 0);
  const inProgressCount = (byStatus["in_progress"] ?? 0);
  const resolvedCount = (byStatus["resolved"] ?? 0);
  const delayedCount = (byStatus["delayed"] ?? 0);
  const closedCount = (byStatus["closed"] ?? 0);
  const highCount = (byPriority["High"] ?? 0);
  const mediumCount = (byPriority["Medium"] ?? 0);
  const lowCount = (byPriority["Low"] ?? 0);

  const openHighPriority = tickets.filter(
    (t) => t.priority === "High" && (t.status === "open" || t.status === "in_progress")
  );

  const resolvedTickets = tickets.filter(
    (t) => t.updated_at && (t.status === "resolved" || t.status === "closed")
  );
  const avgResHours =
    resolvedTickets.length > 0
      ? Math.round(
          resolvedTickets.reduce((sum, t) => {
            return sum + (new Date(t.updated_at!).getTime() - new Date(t.created_at).getTime()) / 3600000;
          }, 0) / resolvedTickets.length
        )
      : 0;

  const categoryLine = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => `${cat}: ${n}`)
    .join(" | ");

  // Ticket table
  const ticketRows = tickets
    .map((t) => {
      const hoursAgo = Math.round((Date.now() - new Date(t.created_at).getTime()) / 3600000);
      const age = hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(hoursAgo / 24)}d ago`;
      const location = t.location ?? "Unknown";
      const reporter = t.reporter_name ?? "Unknown";
      const group = t.group_name ?? "—";
      const msg = t.message_text.length > 90 ? t.message_text.slice(0, 90) + "…" : t.message_text;
      return `| #${t.id} | ${t.status} | ${t.priority} | ${t.category} | ${location} | ${reporter} | ${group} | ${age} | ${msg} |`;
    })
    .join("\n");

  // Groups
  const activeGroups = trackedGroups.filter((g) => g.enabled);
  const groupRows = trackedGroups
    .map((g) => `- ${g.name} [${g.enabled ? "ACTIVE" : "DISABLED"}] — ${g.message_count} msgs${g.description ? ` — ${g.description}` : ""}`)
    .join("\n");

  // Contacts
  const activeContacts = trackedContacts.filter((c) => c.enabled);
  const contactRows = trackedContacts
    .map((c) => `- ${c.name} (${c.phone}) [${c.enabled ? "ACTIVE" : "DISABLED"}] — ${c.message_count} msgs${c.description ? ` — ${c.description}` : ""}`)
    .join("\n");

  const context = `=== LIVE COMPLAINTOPS DATA (fetched at ${now}) ===

## Summary Statistics
- **Total tickets**: ${total}
- **By status**: Open: ${openCount} | In Progress: ${inProgressCount} | Delayed: ${delayedCount} | Resolved: ${resolvedCount} | Closed: ${closedCount}
- **By priority**: High: ${highCount} | Medium: ${mediumCount} | Low: ${lowCount}
- **High-priority unresolved**: ${openHighPriority.length} tickets
- **Avg resolution time**: ${avgResHours}h (across ${resolvedTickets.length} resolved/closed tickets)

## Tickets by Category
${categoryLine}

## High-Priority Unresolved Tickets
${openHighPriority.map((t) => `- #${t.id} [${t.status}] ${t.category} @ ${t.location ?? "Unknown"} — "${t.message_text.slice(0, 80)}…" (reporter: ${t.reporter_name ?? "Unknown"})`).join("\n") || "None"}

## All Tickets
| ID | Status | Priority | Category | Location | Reporter | Group | Age | Message |
|----|--------|----------|----------|----------|----------|-------|-----|---------|
${ticketRows}

## Tracked WhatsApp Groups (${trackedGroups.length} total, ${activeGroups.length} active)
${groupRows}

## Tracked Contacts (${trackedContacts.length} total, ${activeContacts.length} active)
${contactRows}

=== END OF LIVE DATA ===`;

  return {
    context,
    meta: {
      tickets: total,
      open_tickets: openCount,
      high_priority: openHighPriority.length,
      groups: trackedGroups.length,
      contacts: trackedContacts.length,
    },
  };
}

async function buildResearchContext(query: string, collection_id: string): Promise<{ context: string; sources: any[] }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(
      `${KNOWLEDGE_SERVICE_URL}/search?query=${encodeURIComponent(query)}&limit=10&collection_id=${collection_id}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Knowledge service error (${response.status}): ${errorText}`);
    }
    
    const results = await response.json();
    console.log(`Research context for "${query}" in ${collection_id}: ${results.length} results found`);
    
    if (results.length === 0) {
      console.warn(`No research results found for query: ${query}`);
    }

    const context = `=== RESEARCH DOCUMENTS CONTEXT (Notebook: ${collection_id}) ===\n\n` + 
      results.map((r: any, i: number) => `[Source ${i+1}: ${r.source_name}, p.${r.page_number}]: ${r.content}`).join("\n\n") +
      "\n\n=== END OF RESEARCH CONTEXT ===";
    
    return { context, sources: results };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error("Knowledge service request timed out after 30s");
    } else {
      console.error("Error building research context:", err);
    }
    return { context: "The knowledge search timed out or failed. Proceeding with general knowledge.", sources: [] };
  }
}

// ── Conversations ─────────────────────────────────────────────────────────────

router.get("/ai/conversations", async (_req, res) => {
  const rows = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt));
  res.json(
    rows.map((c) => ({
      id: c.id,
      title: c.title,
      created_at: c.createdAt.toISOString(),
      updated_at: null,
    }))
  );
});

router.post("/ai/conversations", async (req, res) => {
  const parsed = insertConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [row] = await db.insert(conversations).values(parsed.data).returning();
  res.status(201).json({
    id: row.id,
    title: row.title,
    created_at: row.createdAt.toISOString(),
    updated_at: null,
  });
});

router.delete("/ai/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(conversations).where(eq(conversations.id, id));
  res.json({ success: true });
});

router.get("/ai/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json(
    rows.map((m) => ({
      id: m.id,
      conversation_id: m.conversationId,
      role: m.role,
      content: m.content,
      created_at: m.createdAt.toISOString(),
    }))
  );
});

// ── Chat (SSE streaming) ──────────────────────────────────────────────────────

router.post("/ai/chat", async (req, res) => {
  const { conversation_id, message, system_prompt, collection_id } = req.body as {
    conversation_id: number;
    message: string;
    system_prompt?: string;
    collection_id?: string;
  };

  if (!conversation_id || !message?.trim()) {
    res.status(400).json({ error: "conversation_id and message are required" });
    return;
  }

  try {
    // Build RAG context
    let ragContext = "";
    let contextMeta: any = null;
    let sources: any[] = [];

    if (collection_id) {
      const res = await buildResearchContext(message, collection_id);
      ragContext = res.context;
      sources = res.sources;
      contextMeta = { type: "research", collection_id, source_count: sources.length };
    } else {
      const res = await buildRagContext();
      ragContext = res.context;
      contextMeta = { type: "tickets", ...res.meta };
    }

    // Verify conversation exists or create one
    let currentConversationId = conversation_id;
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversation_id))
      .limit(1);

    if (!conversation) {
      console.log(`Conversation ${conversation_id} not found. Creating a new default one.`);
      const [newRow] = await db.insert(conversations).values({
        title: "Research Assistant",
      }).returning();
      currentConversationId = newRow.id;
      console.log(`Using new conversation ID: ${currentConversationId}`);
    }

    // Fetch conversation history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, currentConversationId))
      .orderBy(asc(messages.createdAt));

    // Persist the user message
    await db.insert(messages).values(
      insertMessageSchema.parse({
        conversationId: currentConversationId,
        role: "user",
        content: message.trim(),
      })
    );

    // Build messages array: system prompt → RAG context → conversation history → new user message
    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: system_prompt ?? DEFAULT_SYSTEM_PROMPT },
      { role: "system", content: ragContext },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user", content: message.trim() },
    ];

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let fullResponse = "";

    const model = process.env.AI_MODEL ?? "llama-3.3-70b-versatile";
    const stream = await openai.chat.completions.create({
      model,
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Persist assistant response
    await db.insert(messages).values(
      insertMessageSchema.parse({
        conversationId: currentConversationId,
        role: "assistant",
        content: fullResponse,
      })
    );

    // Send done event with context metadata so the UI can show grounding info
    res.write(`data: ${JSON.stringify({ done: true, context_meta: contextMeta, sources })}\n\n`);
  } catch (err) {
    console.error("AI chat error:", err);
    
    // If headers already sent, we are in the middle of a stream
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "An error occurred while generating the response." })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Failed to process AI chat request" });
    }
  } finally {
    if (!res.writableEnded && res.headersSent) {
      res.end();
    }
  }
});

export default router;
