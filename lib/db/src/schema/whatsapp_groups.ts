import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const whatsappGroupsTable = pgTable("whatsapp_groups", {
  id: serial("id").primaryKey(),
  groupId: text("group_id").notNull().unique(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWhatsappGroupSchema = createInsertSchema(whatsappGroupsTable).omit({ id: true, updatedAt: true });
export type InsertWhatsappGroup = z.infer<typeof insertWhatsappGroupSchema>;
export type WhatsappGroup = typeof whatsappGroupsTable.$inferSelect;
