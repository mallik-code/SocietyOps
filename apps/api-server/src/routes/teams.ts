import { Router, type IRouter } from "express";
import { db, employeesTable, messageLogTable, leaveRecordsTable, holidaysTable, llmSettingsTable, teamsChannelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getLlmSettings() {
  const rows = await db.select().from(llmSettingsTable).limit(1);
  if (rows.length === 0) return { provider: "openai", model: "gpt-4o-mini", apiKey: null };
  return rows[0];
}

async function callLlm(prompt: string, settings: { provider: string; model: string; apiKey: string | null }): Promise<string> {
  const { provider, model, apiKey } = settings;
  const key = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
  if (!key) throw new Error(`No API key configured for provider: ${provider}`);

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.1 }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || "OpenAI API error");
    return data.choices[0].message.content;
  }
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || "Anthropic API error");
    return data.content[0].text;
  }
  if (provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.1 }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || "Groq API error");
    return data.choices[0].message.content;
  }
  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } }),
      }
    );
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || "Gemini API error");
    return data.candidates[0].content.parts[0].text;
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

function buildLeavePrompt(message: string, employees: any[], today: string, holidays: any[]): string {
  const employeeList = employees.map(e => `- ID:${e.id} | ${e.fullName} | ${e.department} | ${e.role} | Manager:${e.managerId || "none"}`).join("\n");
  const holidayList = holidays.map(h => `- ${h.date}: ${h.name}`).join("\n");
  return `You are an AI Leave Management Agent that monitors Microsoft Teams messages.

Today's date: ${today}

EMPLOYEES:
${employeeList}

HOLIDAYS THIS YEAR:
${holidayList}

TASK:
Analyze the following Teams message and determine if it is a leave notification.

MESSAGE: "${message}"

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "intent": "leave_notification" | "not_leave_related",
  "confidence": 0.0-1.0,
  "employee": {
    "name_extracted": "name found in message or empty string",
    "resolved": true/false,
    "ambiguous": true/false,
    "candidates": [{"id": 1, "full_name": "...", "department": "..."}],
    "matched_employee": {"id": 1, "full_name": "...", "department": "..."} or null
  },
  "leave_date": "YYYY-MM-DD or null",
  "leave_type": "full_day" | "half_day" | "multiple_days",
  "is_holiday": true/false,
  "poster": {
    "employee_id": <sender_employee_id>,
    "name": "sender name",
    "is_manager_of_employee": true/false
  },
  "action": "update_leave_table" | "ask_clarification" | "ignore" | "holiday_conflict" | "unauthorized_poster",
  "clarification_needed": true/false,
  "clarification_question": "question to ask or null"
}

RULES:
1. If the message is not about leave/absence, set intent to "not_leave_related"
2. If the name in the message matches exactly one employee by first name, last name, or full name, set resolved:true and matched_employee to that employee
3. If the name matches 2+ employees (ambiguous), set ambiguous:true, resolved:false, list all candidates, set action to "ask_clarification"
4. If the name matches no employee, set resolved:false, ambiguous:false, matched_employee:null
5. The poster's manager_id must be checked: is_manager_of_employee is true only if poster.manager_id == matched_employee.manager_id OR poster is the direct manager (poster.id == matched_employee.manager_id)
6. If leave_date is a holiday, set is_holiday:true and action to "holiday_conflict"
7. If poster is not the manager of the employee, set action to "unauthorized_poster"
8. For "today" in messages, use today's date: ${today}
9. For "tomorrow", use the next calendar day after today`;
}

async function getOrCreateChannel(channelId: string): Promise<{ agentEnabled: boolean }> {
  const existing = await db.select().from(teamsChannelsTable)
    .where(eq(teamsChannelsTable.channelId, channelId))
    .limit(1);

  if (existing.length > 0) {
    return { agentEnabled: existing[0].agentEnabled };
  }

  const [created] = await db.insert(teamsChannelsTable).values({
    name: channelId,
    channelId,
    agentEnabled: true,
  }).returning();

  return { agentEnabled: created.agentEnabled };
}

async function incrementChannelMessageCount(channelId: string) {
  const rows = await db.select().from(teamsChannelsTable)
    .where(eq(teamsChannelsTable.channelId, channelId))
    .limit(1);
  if (rows.length > 0) {
    await db.update(teamsChannelsTable)
      .set({ messageCount: rows[0].messageCount + 1 })
      .where(eq(teamsChannelsTable.id, rows[0].id));
  }
}

async function processMessage(message: string, senderId: number, channel: string | null) {
  const employees = await db.select().from(employeesTable);
  const settings = await getLlmSettings();
  const today = new Date().toISOString().split("T")[0];

  let agentEnabled = true;
  if (channel) {
    const ch = await getOrCreateChannel(channel);
    agentEnabled = ch.agentEnabled;
    await incrementChannelMessageCount(channel);
  }

  if (!agentEnabled) {
    const [logEntry] = await db.insert(messageLogTable).values({
      messageText: message,
      senderId,
      channel,
      intent: "not_processed",
      confidence: 0,
      actionTaken: "agent_disabled",
      clarificationQuestion: null,
      agentOutput: { reason: "AI agent is disabled for this channel" },
    }).returning();

    const senderEmployee = employees.find(e => e.id === senderId);
    return {
      id: logEntry.id,
      message_text: message,
      sender_id: senderId,
      sender_name: senderEmployee?.fullName || "Unknown",
      channel,
      intent: "not_processed",
      confidence: 0,
      agent_output: { reason: "AI agent is disabled for this channel" },
      action_taken: "agent_disabled",
      clarification_question: null,
      created_at: logEntry.createdAt,
    };
  }

  const holidays = await db.select().from(holidaysTable);
  const prompt = buildLeavePrompt(message, employees, today, holidays);
  let agentOutput: any;

  try {
    const raw = await callLlm(prompt, settings);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    agentOutput = JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err }, "LLM call failed or returned invalid JSON");
    agentOutput = {
      intent: "not_leave_related",
      confidence: 0,
      employee: { name_extracted: "", resolved: false, ambiguous: false, candidates: [], matched_employee: null },
      leave_date: null,
      leave_type: "full_day",
      is_holiday: false,
      poster: { employee_id: senderId, name: "Unknown", is_manager_of_employee: false },
      action: "ignore",
      clarification_needed: false,
      clarification_question: null,
    };
  }

  const sender = employees.find(e => e.id === senderId);
  if (sender && agentOutput.poster) {
    agentOutput.poster.employee_id = senderId;
    agentOutput.poster.name = sender.fullName;
  }

  let actionTaken = "ignored";
  if (agentOutput.intent === "leave_notification") {
    if (agentOutput.clarification_needed || agentOutput.ambiguous) {
      actionTaken = "clarification_requested";
    } else if (agentOutput.is_holiday) {
      actionTaken = "holiday_conflict";
    } else if (!agentOutput.poster?.is_manager_of_employee) {
      actionTaken = "unauthorized_poster";
    } else if (agentOutput.employee?.resolved && agentOutput.employee?.matched_employee) {
      actionTaken = "leave_recorded";
    }
  }

  const [logEntry] = await db.insert(messageLogTable).values({
    messageText: message,
    senderId,
    channel,
    intent: agentOutput.intent,
    confidence: agentOutput.confidence,
    actionTaken,
    clarificationQuestion: agentOutput.clarification_question || null,
    agentOutput,
  }).returning();

  if (actionTaken === "leave_recorded" && agentOutput.employee?.matched_employee && agentOutput.leave_date) {
    await db.insert(leaveRecordsTable).values({
      employeeId: agentOutput.employee.matched_employee.id,
      leaveDate: agentOutput.leave_date,
      leaveType: agentOutput.leave_type || "full_day",
      status: "approved",
      approvedById: senderId,
      sourceMessage: message,
      messageLogId: logEntry.id,
    });
  }

  const senderEmployee = employees.find(e => e.id === senderId);
  return {
    id: logEntry.id,
    message_text: message,
    sender_id: senderId,
    sender_name: senderEmployee?.fullName || "Unknown",
    channel,
    intent: agentOutput.intent,
    confidence: agentOutput.confidence,
    agent_output: agentOutput,
    action_taken: actionTaken,
    clarification_question: agentOutput.clarification_question || null,
    created_at: logEntry.createdAt,
  };
}

router.post("/teams/simulate", async (req, res): Promise<void> => {
  const { message, sender_id, channel } = req.body;
  if (!message || !sender_id) {
    res.status(400).json({ error: "message and sender_id are required" });
    return;
  }
  const result = await processMessage(message, sender_id, channel || null);
  res.json(result);
});

router.post("/teams/webhook", async (req, res): Promise<void> => {
  const { type, from, text } = req.body;
  if (!type || !from?.id || !text) {
    res.status(400).json({ error: "Invalid Teams webhook payload" });
    return;
  }
  const employees = await db.select().from(employeesTable);
  const sender = employees.find(e => e.teamsUserId === from.id);
  if (!sender) {
    req.log.warn({ teamsUserId: from.id }, "Teams webhook: unknown user");
    res.json({ success: true, message: "User not found in system" });
    return;
  }
  await processMessage(text, sender.id, null);
  res.json({ success: true, message: "Message processed" });
});

router.get("/teams/message-log", async (req, res): Promise<void> => {
  const logs = await db.select().from(messageLogTable).orderBy(messageLogTable.createdAt);
  const employees = await db.select().from(employeesTable);
  const result = logs.map(log => {
    const sender = employees.find(e => e.id === log.senderId);
    return {
      id: log.id,
      message_text: log.messageText,
      sender_id: log.senderId,
      sender_name: sender?.fullName || "Unknown",
      channel: log.channel,
      intent: log.intent,
      confidence: log.confidence,
      action_taken: log.actionTaken,
      clarification_question: log.clarificationQuestion,
      agent_output: log.agentOutput,
      created_at: log.createdAt,
    };
  });
  res.json(result);
});

router.get("/teams/channels", async (req, res): Promise<void> => {
  const channels = await db.select().from(teamsChannelsTable)
    .orderBy(teamsChannelsTable.createdAt);
  res.json(channels.map(c => ({
    id: c.id,
    name: c.name,
    channel_id: c.channelId,
    description: c.description,
    agent_enabled: c.agentEnabled,
    message_count: c.messageCount,
    created_at: c.createdAt,
  })));
});

router.post("/teams/channels", async (req, res): Promise<void> => {
  const { name, channel_id, description } = req.body;
  if (!name || !channel_id) {
    res.status(400).json({ error: "name and channel_id are required" });
    return;
  }
  try {
    const [created] = await db.insert(teamsChannelsTable).values({
      name,
      channelId: channel_id,
      description: description || null,
      agentEnabled: true,
    }).returning();
    res.status(201).json({
      id: created.id,
      name: created.name,
      channel_id: created.channelId,
      description: created.description,
      agent_enabled: created.agentEnabled,
      message_count: created.messageCount,
      created_at: created.createdAt,
    });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "A channel with that ID already exists" });
    } else {
      throw err;
    }
  }
});

router.patch("/teams/channels/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { agent_enabled, name, description } = req.body;
  const updates: Record<string, any> = {};
  if (typeof agent_enabled === "boolean") updates.agentEnabled = agent_enabled;
  if (typeof name === "string") updates.name = name;
  if (typeof description === "string") updates.description = description;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  const [updated] = await db.update(teamsChannelsTable)
    .set(updates)
    .where(eq(teamsChannelsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  res.json({
    id: updated.id,
    name: updated.name,
    channel_id: updated.channelId,
    description: updated.description,
    agent_enabled: updated.agentEnabled,
    message_count: updated.messageCount,
    created_at: updated.createdAt,
  });
});

router.delete("/teams/channels/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(teamsChannelsTable)
    .where(eq(teamsChannelsTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
