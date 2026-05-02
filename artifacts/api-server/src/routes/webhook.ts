import { Router, type IRouter } from "express";
import { webhookController } from "../controllers/webhook.controller";

const router: IRouter = Router();

router.post("/webhooks/evolution", webhookController.handleEvolutionWebhook);

export default router;
