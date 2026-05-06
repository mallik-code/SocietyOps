import { messageRepository } from "../repositories/message.repository";
import { policyRepository } from "../repositories/policy.repository";
import { logger } from "../lib/logger";
import { trackedGroups, trackedContacts } from "../routes/policies";
import type { RawMessageMedia } from "../routes/dashboard";

const COMPLAINT_SERVICE_URL = process.env.COMPLAINT_SERVICE_URL || "http://api:8000";
const EVOLUTION_URL = process.env.EVOLUTION_API_URL || "http://evolution:8080";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "complaint-bot";

const MEDIA_MESSAGE_KEYS = [
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "stickerMessage",
] as const;

type MediaMessageKey = (typeof MEDIA_MESSAGE_KEYS)[number];

function mediaTypeFromKey(key: MediaMessageKey): RawMessageMedia["type"] {
  if (key === "imageMessage") return "image";
  if (key === "videoMessage") return "video";
  if (key === "audioMessage") return "audio";
  if (key === "documentMessage") return "document";
  if (key === "stickerMessage") return "sticker";
  return "unknown";
}

function buildDataUrl(value: unknown, mimetype: string | null): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.startsWith("data:")) return value;
  if (/^https?:\/\//i.test(value)) return null;

  return `data:${mimetype || "application/octet-stream"};base64,${value}`;
}

function findBase64Value(value: unknown): string | null {
  if (typeof value === "string") {
    if (value.startsWith("data:")) return value;
    if (/^https?:\/\//i.test(value)) return null;
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.replace(/\s/g, "").length > 128) {
      return value;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["base64", "data", "media"]) {
    const found = findBase64Value(record[key]);
    if (found) return found;
  }

  for (const nested of Object.values(record)) {
    const found = findBase64Value(nested);
    if (found) return found;
  }

  return null;
}

async function fetchMediaDataUrl(data: any, mimetype: string | null): Promise<string | null> {
  if (!EVOLUTION_KEY || !data?.key?.id) return null;

  try {
    const response = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_KEY,
      },
      body: JSON.stringify({
        message: {
          key: data.key,
        },
        convertToMp4: false,
      }),
    });

    if (!response.ok) {
      logger.warn(
        { status: response.status, messageId: data.key.id },
        "Evolution media base64 fallback failed"
      );
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    const base64 = findBase64Value(payload);

    return buildDataUrl(base64, mimetype);
  } catch (err) {
    logger.warn({ err, messageId: data.key.id }, "Error fetching media base64 from Evolution");
    return null;
  }
}

async function getMediaPayload(message: any, data: any): Promise<RawMessageMedia | null> {
  if (!message) return null;

  for (const key of MEDIA_MESSAGE_KEYS) {
    const media = message[key];
    if (!media) continue;

    const mimetype = media.mimetype ?? null;
    const dataUrl =
      buildDataUrl(media.base64, mimetype) ??
      buildDataUrl(media.media, mimetype) ??
      buildDataUrl(media.data, mimetype) ??
      buildDataUrl(message.base64, mimetype) ??
      buildDataUrl(data?.base64, mimetype) ??
      (await fetchMediaDataUrl(data, mimetype));

    const fileSize = Number(media.fileLength ?? media.file_size ?? media.fileSize);
    const seconds = Number(media.seconds);

    return {
      type: mediaTypeFromKey(key),
      mimetype,
      file_name: media.fileName ?? media.filename ?? media.title ?? null,
      caption: media.caption ?? null,
      url: media.url ?? media.mediaUrl ?? (typeof media.media === "string" && /^https?:\/\//i.test(media.media) ? media.media : null),
      data_url: dataUrl,
      seconds: Number.isFinite(seconds) ? seconds : null,
      file_size: Number.isFinite(fileSize) ? fileSize : null,
    };
  }

  return null;
}

function describeMedia(media: RawMessageMedia | null): string {
  if (!media) return "";
  const label = media.type.charAt(0).toUpperCase() + media.type.slice(1);
  return media.file_name ? `[${label}: ${media.file_name}]` : `[${label} message]`;
}

export class WebhookService {
  public async processEvolutionWebhook(payload: any): Promise<void> {
    const event = payload.event || payload.type;
    logger.info({ event, instance: payload.instance }, "Received Evolution webhook");

    // Handle both v1 (messages.upsert) and v2 (MESSAGES_UPSERT)
    if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") {
      return;
    }

    const data = payload.data;
    if (!data || !data.key || data.key.fromMe) {
      logger.debug("Skipping message: no data or from me");
      return;
    }

    // Extract text from various possible locations in Evolution payload
    let text = "";
    const message = data.message;
    const media = await getMediaPayload(message, data);
    if (message) {
      if (message.conversation) {
        text = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        text = message.extendedTextMessage.text;
      } else if (message.imageMessage?.caption) {
        text = message.imageMessage.caption;
      } else if (message.videoMessage?.caption) {
        text = message.videoMessage.caption;
      } else if (message.buttonsResponseMessage?.selectedButtonId) {
        text = message.buttonsResponseMessage.selectedButtonId;
      } else if (message.templateButtonReplyMessage?.selectedId) {
        text = message.templateButtonReplyMessage.selectedId;
      }
    }

    if (!text && media?.caption) {
      text = media.caption;
    }

    if (!text && media) {
      text = describeMedia(media);
    }

    if (!text) {
      logger.debug({ data }, "No text or media content found in message payload");
      return;
    }

    const remoteJid = data.key.remoteJid;
    const isGroup = remoteJid?.endsWith("@g.us");
    const sender = data.pushName || data.key.participant || remoteJid || "Unknown";
    const groupName = isGroup ? remoteJid : null;

    // 1. Check if the sender/group is tracked in Policies
    let isTracked = false;
    if (isGroup) {
      const group = trackedGroups.find(g => g.group_id === remoteJid);
      if (group && group.enabled) {
        isTracked = true;
        group.message_count++;
        policyRepository.updateGroup(group);
        logger.info({ groupId: remoteJid }, "Incremented group message count");
      }
    } else {
      const phone = remoteJid?.split("@")[0].replace(/\+/g, "");
      const contact = trackedContacts.find(c => c.phone.replace(/\+/g, "") === phone);
      if (contact && contact.enabled) {
        isTracked = true;
        contact.message_count++;
        policyRepository.updateContact(contact);
        logger.info({ phone }, "Incremented contact message count");
      }
    }

    if (!isTracked) {
      logger.info({ remoteJid, sender }, "Ignoring message: not in tracked Policies");
      return;
    }

    // 2. Forward to the core societyops service (FastAPI)
    let classificationResult: any = null;
    try {
      const response = await fetch(`${COMPLAINT_SERVICE_URL}/evolution/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        classificationResult = await response.json();
      } else {
        logger.warn(
          { status: response.status, url: response.url },
          "Failed to forward webhook to societyops-service"
        );
      }
    } catch (err) {
      logger.error({ err }, "Error forwarding webhook to societyops-service");
    }

    logger.info({ sender, isGroup, text, mediaType: media?.type }, "Processing tracked message for dashboard");

    const newMessage = {
      id: Date.now(),
      text: text.trim(),
      sender,
      group_name: groupName,
      category: classificationResult?.classification?.category || null,
      priority: classificationResult?.classification?.priority || null,
      is_complaint: classificationResult?.is_complaint || false,
      confidence: classificationResult?.classification?.confidence?.toString() || null,
      media,
      timestamp: new Date().toISOString(),
    };

    // Save to repository (in-memory list and DB)
    await messageRepository.saveRawMessage(newMessage);
  }
}

export const webhookService = new WebhookService();
