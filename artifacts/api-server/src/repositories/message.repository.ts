import { rawMessages, tickets, Ticket } from "../routes/dashboard";
import { pool } from "@workspace/db";

export class MessageRepository {
  /**
   * Save a raw message to the in-memory store and database.
   */
  public async saveRawMessage(message: any): Promise<void> {
    rawMessages.unshift(message);
    try {
      await pool.query(
        "INSERT INTO raw_messages (text, sender, group_name, category, priority, is_complaint, confidence, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [message.text, message.sender, message.group_name, message.category, message.priority, message.is_complaint, message.confidence, message.timestamp]
      );
    } catch (err) {
      console.error("Failed to save message to DB", err);
    }
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

  /**
   * Clear all raw messages and database entries.
   */
  public async clearAll(): Promise<void> {
    rawMessages.splice(0, rawMessages.length);
    try {
      await pool.query("DELETE FROM raw_messages");
    } catch (err) {
      console.error("Failed to clear messages from DB", err);
    }
  }

  /**
   * Load messages from DB into memory on startup.
   */
  public async loadFromDb(): Promise<void> {
    try {
      const res = await pool.query("SELECT * FROM raw_messages ORDER BY timestamp DESC LIMIT 100");
      rawMessages.splice(0, rawMessages.length, ...res.rows.map(r => ({
        id: r.id,
        text: r.text,
        sender: r.sender,
        group_name: r.group_name,
        category: r.category,
        priority: r.priority,
        is_complaint: r.is_complaint,
        confidence: r.confidence,
        timestamp: r.timestamp.toISOString()
      })));
    } catch (err) {
      console.error("Failed to load messages from DB", err);
    }
  }
}

export const messageRepository = new MessageRepository();
