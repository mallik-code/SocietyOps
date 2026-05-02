import { pool } from "@workspace/db";

export type WhatsappGroup = {
  id?: number;
  groupId: string;
  name: string;
  updatedAt?: string;
};

export class WhatsappGroupRepository {
  /**
   * Save multiple groups to the database, updating if they already exist.
   */
  public async syncGroups(groups: { id: string; name: string }[]): Promise<void> {
    try {
      // Use a transaction for efficiency
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        
        for (const group of groups) {
          await client.query(
            `INSERT INTO whatsapp_groups (group_id, name, updated_at) 
             VALUES ($1, $2, NOW()) 
             ON CONFLICT (group_id) DO UPDATE SET name = $2, updated_at = NOW()`,
            [group.id, group.name]
          );
        }
        
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Failed to sync whatsapp groups to DB", err);
    }
  }

  /**
   * Get all stored whatsapp groups.
   */
  public async getAllGroups(): Promise<WhatsappGroup[]> {
    try {
      const res = await pool.query("SELECT id, group_id as \"groupId\", name, updated_at as \"updatedAt\" FROM whatsapp_groups ORDER BY name ASC");
      return res.rows;
    } catch (err) {
      console.error("Failed to fetch whatsapp groups from DB", err);
      return [];
    }
  }
}

export const whatsappGroupRepository = new WhatsappGroupRepository();
