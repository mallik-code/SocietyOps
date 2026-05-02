import { messageRepository } from "../repositories/message.repository";
import { logger } from "../lib/logger";
import { trackedGroups, trackedContacts } from "../routes/policies";

const COMPLAINT_SERVICE_URL = process.env.COMPLAINT_SERVICE_URL || "http://api:8000";

export class WebhookService {
  public async processEvolutionWebhook(payload: any): Promise<void> {
    // 1. Forward to the core complaint service (FastAPI)
    // We do this first so that tickets are created even if the dashboard logic fails.
    try {
      const response = await fetch(`${COMPLAINT_SERVICE_URL}/evolution/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        logger.warn(
          { status: response.status, url: response.url },
          "Failed to forward webhook to complaint-service"
        );
      }
    } catch (err) {
      logger.error({ err }, "Error forwarding webhook to complaint-service");
    }

    // 2. Process for the dashboard
    // We only care about messages.upsert for the dashboard view
    if (payload.event !== "messages.upsert") {
      return;
    }

    const data = payload.data;
    if (!data || !data.key || data.key.fromMe) {
      return; // Skip if no data or message is from the bot itself
    }

    // Extract text
    let text = "";
    if (data.message?.conversation) {
      text = data.message.conversation;
    } else if (data.message?.extendedTextMessage?.text) {
      text = data.message.extendedTextMessage.text;
    }

    if (!text) {
      return; // No text content
    }

    const isGroup = data.key.remoteJid?.endsWith("@g.us");
    const sender = data.pushName || data.key.participant || data.key.remoteJid || "Unknown";
    const groupName = isGroup ? data.key.remoteJid : null;

    const newMessage = {
      id: Date.now(),
      text: text.trim(),
      sender,
      group_name: groupName,
      category: null,
      timestamp: new Date().toISOString(),
    };

    // Save to repository (in-memory list)
    messageRepository.saveRawMessage(newMessage);

    // Update message counts for policies
    if (isGroup) {
      const group = trackedGroups.find(g => g.group_id === data.key.remoteJid);
      if (group) {
        group.message_count++;
      }
    } else {
      const contact = trackedContacts.find(c => c.phone === data.key.remoteJid?.split("@")[0]);
      if (contact) {
        contact.message_count++;
      }
    }
  }
}

export const webhookService = new WebhookService();
