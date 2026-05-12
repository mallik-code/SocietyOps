import { Router, type IRouter } from "express";
import { db, llmSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getOrCreateSettings() {
  const rows = await db.select().from(llmSettingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [row] = await db.insert(llmSettingsTable).values({
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: null,
  }).returning();
  return row;
}

router.get("/settings/llm", async (req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json({
    provider: settings.provider,
    model: settings.model,
    api_key_set: !!settings.apiKey,
  });
});

router.patch("/settings/llm", async (req, res): Promise<void> => {
  const { provider, model, api_key } = req.body;
  const current = await getOrCreateSettings();

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (provider) updates.provider = provider;
  if (model) updates.model = model;
  if (api_key !== undefined) updates.apiKey = api_key || null;

  const [updated] = await db.update(llmSettingsTable)
    .set(updates)
    .where(eq(llmSettingsTable.id, current.id))
    .returning();

  res.json({
    provider: updated.provider,
    model: updated.model,
    api_key_set: !!updated.apiKey,
  });
});

router.post("/settings/llm/test", async (req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  const key = settings.apiKey || process.env[`${settings.provider.toUpperCase()}_API_KEY`] || "";

  if (!key) {
    res.json({
      success: false,
      message: `No API key configured for provider: ${settings.provider}. Please add your API key in settings.`,
      provider: settings.provider,
      model: settings.model,
      latency_ms: null,
    });
    return;
  }

  const startTime = Date.now();
  try {
    let testPassed = false;

    if (settings.provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: settings.model, messages: [{ role: "user", content: "Say OK" }], max_tokens: 5 }),
      });
      testPassed = r.ok;
    } else if (settings.provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: settings.model, max_tokens: 5, messages: [{ role: "user", content: "Say OK" }] }),
      });
      testPassed = r.ok;
    } else if (settings.provider === "groq") {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: settings.model, messages: [{ role: "user", content: "Say OK" }], max_tokens: 5 }),
      });
      testPassed = r.ok;
    } else if (settings.provider === "gemini") {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }] }),
        }
      );
      testPassed = r.ok;
    }

    const latency = Date.now() - startTime;
    res.json({
      success: testPassed,
      message: testPassed ? "Connection successful" : "Connection failed - check your API key",
      provider: settings.provider,
      model: settings.model,
      latency_ms: latency,
    });
  } catch (err) {
    logger.error({ err }, "LLM test failed");
    res.json({
      success: false,
      message: `Connection failed: ${(err as Error).message}`,
      provider: settings.provider,
      model: settings.model,
      latency_ms: null,
    });
  }
});

export default router;
