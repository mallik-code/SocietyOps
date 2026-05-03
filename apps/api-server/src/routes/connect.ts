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

export async function ensureInstanceExists(): Promise<void> {
  const r = await fetch(
    `${EVOLUTION_URL}/instance/fetchInstances?instanceName=${EVOLUTION_INSTANCE}`,
    { headers: evolutionHeaders() }
  );
  if (!r.ok) {
    console.error(`Failed to fetch instances: ${r.status}`);
    return;
  }
  const instances = (await r.json()) as unknown[];
  const webhookUrl = process.env.WEBHOOK_URL || "http://api-server:3001/api/webhooks/evolution";
  const webhookConfig = {
    url: webhookUrl,
    enabled: true,
    webhook_by_events: true,
    webhook_base64: false,
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
  };

  if (Array.isArray(instances) && instances.length > 0) {
    // Instance exists, just update the webhook
    console.log(`Instance ${EVOLUTION_INSTANCE} exists. Syncing webhook to ${webhookUrl}...`);
    const wr = await fetch(`${EVOLUTION_URL}/webhook/set/${EVOLUTION_INSTANCE}`, {
      method: "POST",
      headers: evolutionHeaders(),
      body: JSON.stringify({
        webhook: webhookConfig
      }),
    });
    if (wr.ok) {
      console.log(`Webhook successfully synced for ${EVOLUTION_INSTANCE}`);
    } else {
      console.error(`Failed to sync webhook: ${wr.status} - ${await wr.text()}`);
    }
    return;
  }

  // Instance doesn't exist — create it
  console.log(`Instance ${EVOLUTION_INSTANCE} does not exist. Creating with webhook ${webhookUrl}...`);
  const cr = await fetch(`${EVOLUTION_URL}/instance/create`, {
    method: "POST",
    headers: evolutionHeaders(),
    body: JSON.stringify({
      instanceName: EVOLUTION_INSTANCE,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook_evolution: webhookConfig,
    }),
  });
  if (cr.ok) {
    console.log(`Instance ${EVOLUTION_INSTANCE} successfully created.`);
  } else {
    console.error(`Failed to create instance: ${cr.status} - ${await cr.text()}`);
  }
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

router.post("/connect/whatsapp/refresh-groups", async (_req, res) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout for Evolution calls

  try {
    const { whatsappGroupRepository } = await import("../repositories/whatsapp-group.repository");
    const chatMap = new Map<string, { id: string; name: string }>();

    // 1. Try fetchAllGroups (more thorough but can be slow)
    try {
      const groupsRes = await fetch(`${EVOLUTION_URL}/group/fetchAllGroups/${EVOLUTION_INSTANCE}?getParticipants=false`, {
        headers: evolutionHeaders(),
        signal: controller.signal
      });
      if (groupsRes.ok) {
        const groups = (await groupsRes.json()) as any[];
        groups.forEach((group: any) => {
          const jid = group.id || group.remoteJid;
          if (jid && jid.endsWith("@g.us")) {
            chatMap.set(jid, { id: jid, name: group.subject || group.name || "Unknown Group" });
          }
        });
      }
    } catch (e) {
      console.warn("fetchAllGroups timed out or failed, falling back to findChats", e);
    }

    // 2. Try findChats (usually faster, gets recent activity)
    try {
      const chatsRes = await fetch(`${EVOLUTION_URL}/chat/findChats/${EVOLUTION_INSTANCE}`, {
        method: "POST",
        headers: evolutionHeaders(),
        body: JSON.stringify({}),
        signal: controller.signal
      });
      if (chatsRes.ok) {
        const chats = (await chatsRes.json()) as any[];
        chats.forEach((chat: any) => {
          const jid = chat.remoteJid || chat.id;
          if (jid && jid.endsWith("@g.us")) {
            // Only add if not already present or if we have a better name
            if (!chatMap.has(jid) || chat.pushName || chat.name) {
              chatMap.set(jid, {
                id: jid,
                name: chat.pushName || chat.name || chat.pushname || chatMap.get(jid)?.name || "Unknown",
              });
            }
          }
        });
      }
    } catch (e) {
      console.warn("findChats timed out or failed", e);
    }

    clearTimeout(timeoutId);

    const groupList = Array.from(chatMap.values());
    if (groupList.length > 0) {
      await whatsappGroupRepository.syncGroups(groupList);
    }

    res.json({ success: true, count: groupList.length, totalFetched: groupList.length });
  } catch (err) {
    clearTimeout(timeoutId);
    res.status(502).json({ error: `Refresh failed: ${String(err)}` });
  }
});

router.get("/connect/whatsapp/chats", async (_req, res) => {
  try {
    const { whatsappGroupRepository } = await import("../repositories/whatsapp-group.repository");
    const groups = await whatsappGroupRepository.getAllGroups();
    
    // Format to match expected frontend structure
    res.json(groups.map(g => ({
      id: g.groupId,
      name: g.name,
      updatedAt: g.updatedAt
    })));
  } catch (err) {
    res.status(500).json({ error: `Database error: ${String(err)}` });
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
