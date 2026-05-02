import { rawMessages, tickets, Ticket } from "../routes/dashboard";

export class MessageRepository {
  /**
   * Save a raw message to the in-memory store.
   */
  public saveRawMessage(message: any): void {
    rawMessages.unshift(message);
  }

  /**
   * Optionally save a ticket if needed.
   */
  public saveTicket(ticket: Ticket): void {
    tickets.unshift(ticket);
  }

  /**
   * Get all raw messages
   */
  public getAllMessages() {
    return rawMessages;
  }
}

export const messageRepository = new MessageRepository();
