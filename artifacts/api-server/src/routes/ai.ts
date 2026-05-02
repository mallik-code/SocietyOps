import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations, messages, insertConversationSchema, insertMessageSchema } from "@workspace/db/schema";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant integrated into a WhatsApp-based building complaint management system called ComplaintOps.

You can help with:
- Analyzing and summarizing complaint tickets
- Suggesting priority levels and categories for complaints
- Drafting response templates for supervisors
- Explaining system configuration and policies
- Answering questions about building management best practices

Be concise, professional, and helpful. Format responses clearly using markdown when appropriate.`;

// ── Conversations ─────────────────────────────────────────────────────────────

router.get("/ai/conversations", async (_req, res) => {
  const rows = await db
    .select()
    .from(conversations)
    .orderBy(asc(conversations.createdAt));
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
  const { conversation_id, message, system_prompt } = req.body as {
    conversation_id: number;
    message: string;
    system_prompt?: string;
  };

  if (!conversation_id || !message?.trim()) {
    res.status(400).json({ error: "conversation_id and message are required" });
    return;
  }

  // Fetch conversation history
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation_id))
    .orderBy(asc(messages.createdAt));

  // Persist the user message
  await db.insert(messages).values(
    insertMessageSchema.parse({
      conversationId: conversation_id,
      role: "user",
      content: message.trim(),
    })
  );

  // Build messages array for OpenAI
  const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system_prompt ?? DEFAULT_SYSTEM_PROMPT },
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

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
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
        conversationId: conversation_id,
        role: "assistant",
        content: fullResponse,
      })
    );

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
