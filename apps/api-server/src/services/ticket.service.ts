import { ticketRepository } from "../repositories/ticket.repository";
import { Ticket } from "../routes/dashboard";

export class TicketService {
  /**
   * Get filtered tickets.
   */
  public async getTickets(filters: { status?: string; priority?: string; category?: string; limit?: number }) {
    let tickets = await ticketRepository.getAllTickets();

    if (filters.status && filters.status !== "all_statuses") {
      const s = filters.status.toLowerCase();
      tickets = tickets.filter((t) => t.status?.toLowerCase() === s);
    }
    if (filters.priority && filters.priority !== "all_priorities") {
      const p = filters.priority.toLowerCase();
      tickets = tickets.filter((t) => t.priority?.toLowerCase() === p);
    }
    if (filters.category && filters.category !== "all_categories") {
      const c = filters.category.toLowerCase();
      tickets = tickets.filter((t) => t.category?.toLowerCase() === c);
    }

    const n = filters.limit ?? 50;
    return tickets.slice(0, n);
  }

  /**
   * Get dashboard statistics from real ticket data.
   */
  public async getDashboardStats() {
    const tickets = await ticketRepository.getAllTickets();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const open = tickets.filter((t) => t.status?.toLowerCase() === "open").length;
    const inProgress = tickets.filter((t) => t.status?.toLowerCase() === "in_progress").length;
    const resolvedToday = tickets.filter((t) => {
      const s = t.status?.toLowerCase();
      if (s !== "resolved" && s !== "closed") return false;
      const updated = t.updated_at ? new Date(t.updated_at) : null;
      return updated && updated >= today;
    }).length;
    const highPriorityOpen = tickets.filter(
      (t) => t.priority?.toLowerCase() === "high" && (t.status?.toLowerCase() === "open" || t.status?.toLowerCase() === "in_progress")
    ).length;
    const closed = tickets.filter((t) => t.status?.toLowerCase() === "closed").length;

    const resolvedTickets = tickets.filter(
      (t) => t.updated_at && (t.status === "resolved" || t.status === "closed")
    );
    const avgResolutionHours =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => {
            const created = new Date(t.created_at).getTime();
            const updated = new Date(t.updated_at!).getTime();
            return sum + (updated - created) / 3600000;
          }, 0) / resolvedTickets.length
        : 0;

    return {
      total_tickets: tickets.length,
      open_tickets: open,
      in_progress_tickets: inProgress,
      resolved_today: resolvedToday,
      high_priority_open: highPriorityOpen,
      closed_tickets: closed,
      avg_resolution_hours: Math.round(avgResolutionHours * 10) / 10,
    };
  }

  /**
   * Get category breakdown.
   */
  public async getCategoryBreakdown() {
    const tickets = await ticketRepository.getAllTickets();
    const counts: Record<string, number> = {};
    for (const t of tickets) {
      const cat = t.category || "Other";
      // Normalize to TitleCase for display
      const normalized = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
      counts[normalized] = (counts[normalized] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));
  }

  /**
   * Get priority breakdown.
   */
  public async getPriorityBreakdown() {
    const tickets = await ticketRepository.getAllTickets();
    const order = ["High", "Medium", "Low"];
    const counts: Record<string, number> = {};
    for (const t of tickets) {
      if (!t.priority) continue;
      const p = t.priority.charAt(0).toUpperCase() + t.priority.slice(1).toLowerCase();
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return order
      .map((priority) => ({ priority, count: counts[priority] ?? 0 }));
  }

  /**
   * Get daily trend.
   */
  public async getDailyTrend() {
    const tickets = await ticketRepository.getAllTickets();
    const counts: Record<string, number> = {};
    
    // Initialize last 15 days with 0
    for (let i = 0; i < 15; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      counts[d.toISOString().slice(0, 10)] = 0;
    }

    for (const t of tickets) {
      const d = t.created_at.slice(0, 10);
      if (d in counts) counts[d]++;
    }

    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }

  /**
   * Get recent activity.
   */
  public async getRecentActivity() {
    const tickets = await ticketRepository.getAllTickets();
    return tickets
      .slice(0, 5)
      .map((t) => {
        const isResolved = t.status === "resolved" || t.status === "closed";
        return {
          id: t.id,
          ticket_id: t.id,
          event: isResolved ? "supervisor_action" : "created",
          description: isResolved ? `Ticket #${t.id} resolved` : `New ${t.category || "issue"} complaint submitted`,
          category: t.category,
          priority: t.priority,
          status: t.status,
          timestamp: t.updated_at || t.created_at,
        };
      });
  }
}

export const ticketService = new TicketService();
