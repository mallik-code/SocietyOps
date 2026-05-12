import { Request, Response } from "express";
import { ticketService } from "../services/ticket.service";
import { ticketRepository } from "../repositories/ticket.repository";
import { rawMessages } from "../routes/dashboard";

export class TicketController {
  public getStats = async (req: Request, res: Response): Promise<void> => {
    const stats = await ticketService.getDashboardStats();
    res.json({ ...stats, messages_processed_today: rawMessages.length });
  };

  public getCategories = async (req: Request, res: Response): Promise<void> => {
    const data = await ticketService.getCategoryBreakdown();
    res.json(data);
  };

  public getPriorities = async (req: Request, res: Response): Promise<void> => {
    const data = await ticketService.getPriorityBreakdown();
    res.json(data);
  };

  public getTrend = async (req: Request, res: Response): Promise<void> => {
    const data = await ticketService.getDailyTrend();
    res.json(data);
  };

  public getStatusBreakdown = async (req: Request, res: Response): Promise<void> => {
    const tickets = await ticketRepository.getAllTickets();
    const order = ["open", "in_progress", "resolved", "delayed", "closed"];
    const counts: Record<string, number> = {};
    for (const t of tickets) {
      if (!t.status) continue;
      const s = t.status.toLowerCase();
      counts[s] = (counts[s] ?? 0) + 1;
    }
    const data = order.map((status) => ({ status, count: counts[status] ?? 0 }));
    res.json(data);
  };

  public getRecentActivity = async (req: Request, res: Response): Promise<void> => {
    const data = await ticketService.getRecentActivity();
    res.json(data);
  };

  public listTickets = async (req: Request, res: Response): Promise<void> => {
    const { status, priority, category, limit } = req.query;
    const data = await ticketService.getTickets({
      status: status as string,
      priority: priority as string,
      category: category as string,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    res.json(data);
  };

  public getTicket = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const ticket = await ticketRepository.getTicketById(id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(ticket);
  };

  public updateStatus = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!status || typeof status !== "string") {
      res.status(400).json({ error: "status is required" });
      return;
    }
    const ticket = await ticketRepository.updateTicketStatus(id, status);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(ticket);
  };

  public deleteTicket = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const success = await ticketRepository.deleteTicket(id);
    if (!success) {
      res.status(404).json({ error: "Ticket not found or failed to delete" });
      return;
    }
    res.status(204).send();
  };
}

export const ticketController = new TicketController();
