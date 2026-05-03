import { messageRepository } from "../repositories/message.repository";
import { policyRepository } from "../repositories/policy.repository";
import { logger } from "../lib/logger";
import { trackedGroups, trackedContacts } from "../routes/policies";

const COMPLAINT_SERVICE_URL = process.env.COMPLAINT_SERVICE_URL || "http://api:8000";

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

    if (!text) {
      logger.debug({ data }, "No text content found in message payload");
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

    // 2. Forward to the core complaint service (FastAPI)
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
          "Failed to forward webhook to complaint-service"
        );
      }
    } catch (err) {
      logger.error({ err }, "Error forwarding webhook to complaint-service");
    }

    logger.info({ sender, isGroup, text }, "Processing tracked message for dashboard");

    const newMessage = {
      id: Date.now(),
      text: text.trim(),
      sender,
      group_name: groupName,
      category: classificationResult?.classification?.category || null,
      priority: classificationResult?.classification?.priority || null,
      is_complaint: classificationResult?.is_complaint || false,
      confidence: classificationResult?.classification?.confidence?.toString() || null,
      timestamp: new Date().toISOString(),
    };

    // Save to repository (in-memory list and DB)
    await messageRepository.saveRawMessage(newMessage);
  }
}

export const webhookService = new WebhookService();
