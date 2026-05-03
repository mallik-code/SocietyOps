import { Request, Response } from "express";
import { ticketService } from "../services/ticket.service";
import { ticketRepository } from "../repositories/ticket.repository";
import { 
  UpdateTicketStatusBody, 
  UpdateTicketStatusResponse, 
  ListTicketsResponseItem,
  GetDashboardStatsResponse,
  GetCategoryBreakdownResponseItem,
  GetPriorityBreakdownResponseItem,
  GetDailyTrendResponseItem,
  GetStatusBreakdownResponseItem,
  GetRecentActivityResponseItem
} from "@workspace/api-zod";
import { rawMessages } from "../routes/dashboard";

export class TicketController {
  public getStats = async (req: Request, res: Response): Promise<void> => {
    const stats = await ticketService.getDashboardStats();
    res.json(GetDashboardStatsResponse.parse({
      ...stats,
      messages_processed_today: rawMessages.length,
    }));
  };

  public getCategories = async (req: Request, res: Response): Promise<void> => {
    const data = await ticketService.getCategoryBreakdown();
    res.json(data.map(item => GetCategoryBreakdownResponseItem.parse(item)));
  };

  public getPriorities = async (req: Request, res: Response): Promise<void> => {
    const data = await ticketService.getPriorityBreakdown();
    res.json(data.map(item => GetPriorityBreakdownResponseItem.parse(item)));
  };

  public getTrend = async (req: Request, res: Response): Promise<void> => {
    const data = await ticketService.getDailyTrend();
    res.json(data.map(item => GetDailyTrendResponseItem.parse(item)));
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
    const data = order
      .map((status) => GetStatusBreakdownResponseItem.parse({ status, count: counts[status] ?? 0 }));
    res.json(data);
  };

  public getRecentActivity = async (req: Request, res: Response): Promise<void> => {
    const data = await ticketService.getRecentActivity();
    res.json(data.map(item => GetRecentActivityResponseItem.parse(item)));
  };

  public listTickets = async (req: Request, res: Response): Promise<void> => {
    const { status, priority, category, limit } = req.query;
    const data = await ticketService.getTickets({
      status: status as string,
      priority: priority as string,
      category: category as string,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    res.json(data.map(item => ListTicketsResponseItem.parse(item)));
  };

  public getTicket = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const ticket = await ticketRepository.getTicketById(id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(ListTicketsResponseItem.parse(ticket));
  };

  public updateStatus = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const body = UpdateTicketStatusBody.parse(req.body);
    const ticket = await ticketRepository.updateTicketStatus(id, body.status);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(UpdateTicketStatusResponse.parse(ticket));
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
