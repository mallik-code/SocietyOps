import { Router, type IRouter } from "express";
import {
  GetWhatsappStatusResponse,
} from "@workspace/api-zod";
import { loadTickets, loadRawMessages } from "../lib/csv-loader";
import { ticketController } from "../controllers/ticket.controller";

const router: IRouter = Router();

export type Ticket = {
  id: number;
  message_text: string;
  category: string;
  priority: string;
  status: string;
  location: string | null;
  reporter_name: string | null;
  group_name: string | null;
  created_at: string;
  updated_at: string | null;
};

// Seed data fallback
export const tickets: Ticket[] = loadTickets();
export const rawMessages = loadRawMessages() as Array<{
  id: number;
  text: string;
  sender: string;
  group_name: string | null;
  category: string | null;
  timestamp: string;
}>;

// Dashboard endpoints mapped to controller
router.get("/dashboard/stats", ticketController.getStats);
router.get("/dashboard/categories", ticketController.getCategories);
router.get("/dashboard/priorities", ticketController.getPriorities);
router.get("/dashboard/trend", ticketController.getTrend);
router.get("/dashboard/status-breakdown", ticketController.getStatusBreakdown);
router.get("/dashboard/recent-activity", ticketController.getRecentActivity);

// Ticket CRUD mapped to controller
router.get("/tickets", ticketController.listTickets);
router.get("/tickets/:id", ticketController.getTicket);
router.patch("/tickets/:id/status", ticketController.updateStatus);

// Evolution status
router.get("/dashboard/whatsapp-status", async (_req, res): Promise<void> => {
  try {
    const EVOLUTION_URL = process.env.EVOLUTION_API_URL || "http://evolution:8080";
    const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || "";
    const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "complaint-bot";

    const r = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      { headers: { apikey: EVOLUTION_KEY } }
    );
    
    let connected = false;
    let state = "disconnected";

    if (r.ok) {
      const data = (await r.json()) as any;
      const instanceState = data.instance?.state;
      connected = instanceState === "open";
      state = instanceState || "unknown";
    }

    const data = GetWhatsappStatusResponse.parse({
      connected,
      instance: EVOLUTION_INSTANCE,
      state: connected ? "open" : state,
      api_url: EVOLUTION_URL,
    });
    res.json(data);
  } catch (err) {
    res.json({
      connected: false,
      instance: process.env.EVOLUTION_INSTANCE || "complaint-bot",
      state: "error",
      api_url: process.env.EVOLUTION_API_URL || "http://evolution:8080",
    });
  }
});

router.get("/dashboard/messages", (_req, res): void => {
  res.json(rawMessages);
});

router.post("/dashboard/messages/classify", (_req, res): void => {
  for (const msg of rawMessages) {
    if (!msg.category) {
      const text = msg.text.toLowerCase();
      if (text.includes("water") || text.includes("leak") || text.includes("plumbing")) {
        msg.category = "Water";
      } else if (text.includes("garbage") || text.includes("smell") || text.includes("cleaning") || text.includes("clean")) {
        msg.category = "Cleaning";
      } else if (text.includes("noise") || text.includes("loud")) {
        msg.category = "Noise";
      } else {
        msg.category = "Other";
      }
    }
  }
  res.json({ success: true });
});

export default router;
