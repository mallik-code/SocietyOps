import { pgTable, text, serial, integer, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messageLogTable = pgTable("message_log", {
  id: serial("id").primaryKey(),
  messageText: text("message_text").notNull(),
  senderId: integer("sender_id").notNull(),
  channel: text("channel"),
  intent: text("intent").notNull().default("unknown"),
  confidence: real("confidence").notNull().default(0),
  actionTaken: text("action_taken").notNull().default("ignored"),
  clarificationQuestion: text("clarification_question"),
  agentOutput: jsonb("agent_output"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageLogSchema = createInsertSchema(messageLogTable).omit({ id: true, createdAt: true });
export type InsertMessageLog = z.infer<typeof insertMessageLogSchema>;
export type MessageLog = typeof messageLogTable.$inferSelect;
