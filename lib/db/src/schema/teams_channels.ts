import { pgTable, text, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const teamsChannelsTable = pgTable("teams_channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channelId: text("channel_id").notNull().unique(),
  description: text("description"),
  agentEnabled: boolean("agent_enabled").notNull().default(true),
  messageCount: integer("message_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TeamsChannel = typeof teamsChannelsTable.$inferSelect;
