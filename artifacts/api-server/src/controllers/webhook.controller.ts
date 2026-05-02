import { Request, Response } from "express";
import { webhookService } from "../services/webhook.service";
import { logger } from "../lib/logger";

export class WebhookController {
  public handleEvolutionWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = req.body;
      await webhookService.processEvolutionWebhook(payload);
      res.status(200).json({ success: true, message: "Webhook processed successfully" });
    } catch (error) {
      logger.error({ err: error }, "Error processing Evolution webhook");
      res.status(500).json({ success: false, error: "Failed to process webhook" });
    }
  };
}

export const webhookController = new WebhookController();
