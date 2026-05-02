import { Router, type IRouter } from "express";
import QRCode from "qrcode";

const router: IRouter = Router();

const EVOLUTION_URL = process.env.EVOLUTION_API_URL ?? "http://evolution:8080";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY ?? "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? "complaint-bot";

let tgBotToken: string | null = null;
let tgBotUsername: string | null = null;
let tgBotName: string | null = null;
let tgWebhookUrl: string | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────
async function makeQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 300,
    margin: 2,
    color: { dark: "#111827", light: "#ffffff" },
  });
}

function evolutionHeaders() {
  return { apikey: EVOLUTION_KEY, "Content-Type": "application/json" };
}

async function ensureInstanceExists(): Promise<void> {
  const r = await fetch(
    `${EVOLUTION_URL}/instance/fetchInstances?instanceName=${EVOLUTION_INSTANCE}`,
    { headers: evolutionHeaders() }
  );
  if (!r.ok) return; // can't check — proceed anyway
  const instances = (await r.json()) as unknown[];
  const webhookUrl = process.env.WEBHOOK_URL || "http://api-server:3001/api/webhooks/evolution";
  const webhookConfig = {
    url: webhookUrl,
    webhook_by_events: false,
    webhook_base64: false,
    events: ["MESSAGES_UPSERT"],
  };

  if (Array.isArray(instances) && instances.length > 0) {
    // Instance exists, just update the webhook
    await fetch(`${EVOLUTION_URL}/webhook/set/${EVOLUTION_INSTANCE}`, {
      method: "POST",
      headers: evolutionHeaders(),
      body: JSON.stringify({
        webhook: webhookConfig
      }),
    });
    return;
  }

  // Instance doesn't exist — create it
  await fetch(`${EVOLUTION_URL}/instance/create`, {
    method: "POST",
    headers: evolutionHeaders(),
    body: JSON.stringify({
      instanceName: EVOLUTION_INSTANCE,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook_evolution: webhookConfig,
    }),
  });
}

// ── WhatsApp routes ───────────────────────────────────────────────────────────

router.get("/connect/whatsapp/qr", async (_req, res) => {
  try {
    await ensureInstanceExists();

    const r = await fetch(
      `${EVOLUTION_URL}/instance/connect/${EVOLUTION_INSTANCE}`,
      { headers: evolutionHeaders() }
    );
    if (!r.ok) {
      res.status(502).json({ error: `Evolution API error: ${r.status} — ${await r.text()}` });
      return;
    }
    const data = (await r.json()) as Record<string, unknown>;
    
    // Check if the instance is already connected
    if ((data["instance"] as Record<string, unknown>)?.state === "open") {
      res.status(409).json({ error: "Instance is already connected. Please disconnect first." });
      return;
    }

    const rawQr = (data["base64"] ?? data["qrcode"] ?? data["code"]) as string | undefined;
    if (!rawQr) {
      res.status(502).json({ error: "Evolution API returned no QR code — instance may already be connected" });
      return;
    }
    const qrDataUrl = rawQr.startsWith("data:") ? rawQr : `data:image/png;base64,${rawQr}`;
    res.json({
      qr_data_url: qrDataUrl,
      expires_in: 60,
      status: "waiting_scan",
      pairing_token: (data["code"] as string | undefined) ?? "",
    });
  } catch (err) {
    res.status(502).json({ error: `Could not reach Evolution API at ${EVOLUTION_URL}: ${String(err)}` });
  }
});

router.get("/connect/whatsapp/chats", async (_req, res) => {
  try {
    const r = await fetch(
      `${EVOLUTION_URL}/chat/findChats/${EVOLUTION_INSTANCE}`,
      { 
        method: "POST",
        headers: evolutionHeaders(),
        body: JSON.stringify({})
      }
    );
    if (!r.ok) {
      res.status(502).json({ error: `Evolution API error: ${r.status}` });
      return;
    }
    const data = (await r.json()) as any[];
    
    // Normalize Evolution API v2 response to match dashboard expectations
    const normalized = data.map((chat: any) => ({
      ...chat,
      id: chat.remoteJid || chat.id,
      name: chat.pushName || chat.name || chat.pushname || "Unknown",
    }));

    res.json(normalized);
  } catch (err) {
    res.status(502).json({ error: `Could not reach Evolution API at ${EVOLUTION_URL}: ${String(err)}` });
  }
});

router.get("/connect/whatsapp/status", async (_req, res) => {
  try {
    const r = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      { headers: evolutionHeaders() }
    );
    if (!r.ok) {
      res.status(502).json({ error: `Evolution API error: ${r.status}` });
      return;
    }
    const data = (await r.json()) as Record<string, unknown>;
    const state = (data["instance"] as Record<string, unknown> | undefined)?.["state"] as string | undefined;
    const connected = state === "open";
    res.json({
      connected,
      state: connected ? "connected" : "waiting_scan",
      instance: EVOLUTION_INSTANCE,
      phone: null,
      connected_at: null,
      api_url: EVOLUTION_URL,
    });
  } catch (err) {
    res.status(502).json({ error: `Could not reach Evolution API at ${EVOLUTION_URL}: ${String(err)}` });
  }
});

router.post("/connect/whatsapp/logout", async (_req, res) => {
  try {
    await fetch(
      `${EVOLUTION_URL}/instance/logout/${EVOLUTION_INSTANCE}`,
      { method: "DELETE", headers: evolutionHeaders() }
    );
  } catch {
    // best-effort
  }
  res.json({ success: true });
});

// Simulate scan — for demo use only
router.post("/connect/whatsapp/_simulate_connect", (_req, res) => {
  res.json({ success: true, note: "Simulate not available — using real Evolution API" });
});

// ── Telegram routes ───────────────────────────────────────────────────────────

router.get("/connect/telegram/status", (_req, res) => {
  res.json({
    connected: tgBotToken !== null,
    bot_username: tgBotUsername,
    bot_name: tgBotName,
    webhook_url: tgWebhookUrl,
    configured_at: tgBotToken ? new Date().toISOString() : null,
  });
});

router.post("/connect/telegram", async (req, res) => {
  const { bot_token, webhook_url } = req.body as {
    bot_token: string;
    webhook_url?: string;
  };

  if (!bot_token || !bot_token.match(/^\d+:[A-Za-z0-9_-]{35,}$/)) {
    res.status(400).json({ error: "Invalid bot token format. Expected: 123456789:ABCdef..." });
    return;
  }

  tgBotToken = bot_token;
  const botId = bot_token.split(":")[0];
  tgBotUsername = `complaint_bot_${botId}`;
  tgBotName = "Building Complaints Bot";
  tgWebhookUrl = webhook_url ?? null;

  res.json({
    connected: true,
    bot_username: tgBotUsername,
    bot_name: tgBotName,
    webhook_url: tgWebhookUrl,
    configured_at: new Date().toISOString(),
  });
});

router.delete("/connect/telegram", (_req, res) => {
  tgBotToken = null;
  tgBotUsername = null;
  tgBotName = null;
  tgWebhookUrl = null;
  res.json({ success: true });
});

router.get("/connect/telegram/qr", async (req, res) => {
  const username = tgBotUsername ?? "your_complaint_bot";
  const link = `https://t.me/${username}`;
  const qrDataUrl = await makeQrDataUrl(link);
  res.json({
    qr_data_url: qrDataUrl,
    bot_link: link,
    bot_username: username,
  });
});

export default router;
