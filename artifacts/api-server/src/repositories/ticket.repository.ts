import { Ticket } from "../routes/dashboard";
import { logger } from "../lib/logger";

const COMPLAINT_SERVICE_URL = process.env.COMPLAINT_SERVICE_URL || "http://api:8000";

export class TicketRepository {
  /**
   * Fetch all tickets from the core complaint service (Python).
   */
  public async getAllTickets(): Promise<Ticket[]> {
    try {
      const response = await fetch(`${COMPLAINT_SERVICE_URL}/tickets?limit=500`);
      if (!response.ok) {
        logger.error(
          { status: response.status, url: response.url },
          "Failed to fetch tickets from complaint-service"
        );
        return [];
      }
      return (await response.json()) as Ticket[];
    } catch (err) {
      logger.error({ err }, "Error connecting to complaint-service for tickets");
      return [];
    }
  }

  /**
   * Fetch a single ticket by ID.
   */
  public async getTicketById(id: number): Promise<Ticket | null> {
    try {
      const response = await fetch(`${COMPLAINT_SERVICE_URL}/tickets/${id}`);
      if (!response.ok) return null;
      return (await response.json()) as Ticket;
    } catch (err) {
      logger.error({ err, id }, "Error fetching ticket from complaint-service");
      return null;
    }
  }

  /**
   * Update a ticket status in the core service.
   */
  public async updateTicketStatus(id: number, status: string): Promise<Ticket | null> {
    try {
      const response = await fetch(`${COMPLAINT_SERVICE_URL}/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) return null;
      return (await response.json()) as Ticket;
    } catch (err) {
      logger.error({ err, id, status }, "Error updating ticket status in complaint-service");
    }
  }

  /**
   * Clear all tickets in the core service.
   */
  public async clearTickets(): Promise<void> {
    try {
      const response = await fetch(`${COMPLAINT_SERVICE_URL}/tickets`, {
        method: "DELETE",
      });
      if (!response.ok) {
        logger.error({ status: response.status }, "Failed to clear tickets in complaint-service");
      }
    } catch (err) {
      logger.error({ err }, "Error connecting to complaint-service to clear tickets");
    }
  }
}

export const ticketRepository = new TicketRepository();
