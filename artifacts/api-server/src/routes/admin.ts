import { Router, type IRouter } from "express";
import { tickets, rawMessages } from "./dashboard";
import { trackedGroups, trackedContacts } from "./policies";
import { loadTickets, loadRawMessages, loadTrackedGroups, loadTrackedContacts } from "../lib/csv-loader";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { ticketRepository } from "../repositories/ticket.repository";
import { messageRepository } from "../repositories/message.repository";


const router: IRouter = Router();

/** Mutate exported arrays in-place so all routes see the change immediately */
function replaceArray<T>(target: T[], source: T[]): void {
  target.splice(0, target.length, ...source);
}

// ─── POST /admin/seed  →  restore all test data from CSV files ────────────────

router.post("/admin/seed", (_req, res): void => {
  try {
    replaceArray(tickets as any[], loadTickets());
    replaceArray(rawMessages as any[], loadRawMessages());
    replaceArray(trackedGroups as any[], loadTrackedGroups());
    replaceArray(trackedContacts as any[], loadTrackedContacts());
    res.json({ success: true, message: "Test data imported from CSV files" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
});

// ─── DELETE /admin/seed  →  clear all data ────────────────────────────────────

router.delete("/admin/seed", async (_req, res): Promise<void> => {
  try {
    // 1. Clear in-memory arrays in Express
    replaceArray(tickets as any[], []);
    replaceArray(rawMessages as any[], []);
    replaceArray(trackedGroups as any[], []);
    replaceArray(trackedContacts as any[], []);

    // 2. Clear data in the repositories (includes calling Python core engine)
    messageRepository.clearAll();
    await ticketRepository.clearTickets();

    // 3. Clear DB tables (AI chat history)
    await db.delete(messages);
    await db.delete(conversations);

    res.json({ success: true, message: "All test data cleared" });
  } catch (err) {
    console.error("Failed to clear data", err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

export default router;
