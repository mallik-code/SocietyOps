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

router.post("/admin/seed", async (_req, res): Promise<void> => {
  try {
    const testTickets = loadTickets();
    const testMessages = loadRawMessages();
    const testGroups = loadTrackedGroups();
    const testContacts = loadTrackedContacts();

    replaceArray(tickets as any[], testTickets);
    replaceArray(rawMessages as any[], testMessages);
    replaceArray(trackedGroups as any[], testGroups);
    replaceArray(trackedContacts as any[], testContacts);

    // Also seed the Python service so the Tickets table is populated
    await ticketRepository.seedTickets(testTickets as any[]);

    res.json({ success: true, message: "Test data imported from CSV files" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
});

// ─── DELETE /admin/seed  →  clear only test data ────────────────────────────────────

router.delete("/admin/seed", async (_req, res): Promise<void> => {
  try {
    // 1. Clear in-memory arrays in Express (only items marked as is_test)
    replaceArray(tickets as any[], (tickets as any[]).filter((t: any) => !t.is_test));
    replaceArray(rawMessages as any[], (rawMessages as any[]).filter((m: any) => !m.is_test));
    replaceArray(trackedGroups as any[], (trackedGroups as any[]).filter((g: any) => !g.is_test));
    replaceArray(trackedContacts as any[], (trackedContacts as any[]).filter((c: any) => !c.is_test));

    // 2. Clear data in the repositories (includes calling Python core engine)
    await ticketRepository.clearTickets();

    res.json({ success: true, message: "Test data cleared, live configurations preserved" });
  } catch (err) {
    console.error("Failed to clear data", err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

export default router;
