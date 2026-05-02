import { trackedGroups, trackedContacts, TrackedGroup, TrackedContact } from "../routes/policies";
import { pool } from "@workspace/db";

export class PolicyRepository {
  /**
   * Save a new group to DB and memory.
   */
  public async saveGroup(group: TrackedGroup): Promise<void> {
    try {
      await pool.query(
        "INSERT INTO tracked_groups (name, group_id, description, enabled, message_count, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [group.name, group.group_id, group.description, group.enabled, group.message_count, group.created_at]
      );
    } catch (err) {
      console.error("Failed to save group to DB", err);
    }
  }

  /**
   * Update a group in DB.
   */
  public async updateGroup(group: TrackedGroup): Promise<void> {
    try {
      await pool.query(
        "UPDATE tracked_groups SET name = $1, description = $2, enabled = $3, message_count = $4 WHERE group_id = $5",
        [group.name, group.description, group.enabled, group.message_count, group.group_id]
      );
    } catch (err) {
      console.error("Failed to update group in DB", err);
    }
  }

  /**
   * Delete a group from DB.
   */
  public async deleteGroup(groupId: string): Promise<void> {
    try {
      await pool.query("DELETE FROM tracked_groups WHERE group_id = $1", [groupId]);
    } catch (err) {
      console.error("Failed to delete group from DB", err);
    }
  }

  /**
   * Save a new contact to DB.
   */
  public async saveContact(contact: TrackedContact): Promise<void> {
    try {
      await pool.query(
        "INSERT INTO tracked_contacts (name, phone, description, enabled, message_count, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [contact.name, contact.phone, contact.description, contact.enabled, contact.message_count, contact.created_at]
      );
    } catch (err) {
      console.error("Failed to save contact to DB", err);
    }
  }

  /**
   * Update a contact in DB.
   */
  public async updateContact(contact: TrackedContact): Promise<void> {
    try {
      await pool.query(
        "UPDATE tracked_contacts SET name = $1, description = $2, enabled = $3, message_count = $4 WHERE phone = $5",
        [contact.name, contact.description, contact.enabled, contact.message_count, contact.phone]
      );
    } catch (err) {
      console.error("Failed to update contact in DB", err);
    }
  }

  /**
   * Delete a contact from DB.
   */
  public async deleteContact(phone: string): Promise<void> {
    try {
      await pool.query("DELETE FROM tracked_contacts WHERE phone = $1", [phone]);
    } catch (err) {
      console.error("Failed to delete contact from DB", err);
    }
  }

  /**
   * Load all policies from DB into memory.
   */
  public async loadFromDb(): Promise<void> {
    try {
      const gRes = await pool.query("SELECT * FROM tracked_groups ORDER BY created_at ASC");
      trackedGroups.splice(0, trackedGroups.length, ...gRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        group_id: r.group_id,
        description: r.description,
        enabled: r.enabled,
        message_count: r.message_count,
        created_at: r.created_at.toISOString()
      })));

      const cRes = await pool.query("SELECT * FROM tracked_contacts ORDER BY created_at ASC");
      trackedContacts.splice(0, trackedContacts.length, ...cRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        description: r.description,
        enabled: r.enabled,
        message_count: r.message_count,
        created_at: r.created_at.toISOString()
      })));
    } catch (err) {
      console.error("Failed to load policies from DB", err);
    }
  }

  /**
   * Clear all policies from DB.
   */
  public async clearAll(): Promise<void> {
    try {
      await pool.query("DELETE FROM tracked_groups");
      await pool.query("DELETE FROM tracked_contacts");
    } catch (err) {
      console.error("Failed to clear policies from DB", err);
    }
  }
}

export const policyRepository = new PolicyRepository();
