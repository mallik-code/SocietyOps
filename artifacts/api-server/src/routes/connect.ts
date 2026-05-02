import { Router, type IRouter } from "express";
import QRCode from "qrcode";

const router: IRouter = Router();

// ── Simulated state ─────────────────────────────────────────────────────────
let waState: "disconnected" | "waiting_scan" | "connected" = "waiting_scan";
let waPhone: string | null = null;
let waConnectedAt: string | null = null;

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

// ── WhatsApp routes ───────────────────────────────────────────────────────────

router.get("/connect/whatsapp/qr", async (req, res) => {
  const pairingToken = `EVO-${Date.now().toString(36).toUpperCase()}-BUILDINGMGMT`;
  const qrDataUrl = await makeQrDataUrl(pairingToken);
  res.json({
    qr_data_url: qrDataUrl,
    expires_in: 60,
    status: waState,
    pairing_token: pairingToken,
  });
});

router.get("/connect/whatsapp/status", (_req, res) => {
  res.json({
    connected: waState === "connected",
    state: waState,
    instance: "building-mgmt-wa",
    phone: waPhone,
    connected_at: waConnectedAt,
    api_url: process.env.EVOLUTION_API_URL ?? "http://evolution-api:8080",
  });
});

router.post("/connect/whatsapp/logout", (_req, res) => {
  waState = "disconnected";
  waPhone = null;
  waConnectedAt = null;
  res.json({ success: true });
});

// Simulate scan — for demo use only
router.post("/connect/whatsapp/_simulate_connect", (_req, res) => {
  waState = "connected";
  waPhone = "+971501234567";
  waConnectedAt = new Date().toISOString();
  res.json({ success: true });
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
