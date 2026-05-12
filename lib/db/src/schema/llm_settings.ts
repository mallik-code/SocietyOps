import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const llmSettingsTable = pgTable("llm_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("openai"),
  model: text("model").notNull().default("gpt-4o-mini"),
  apiKey: text("api_key"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLlmSettingsSchema = createInsertSchema(llmSettingsTable).omit({ id: true, updatedAt: true });
export type InsertLlmSettings = z.infer<typeof insertLlmSettingsSchema>;
export type LlmSettings = typeof llmSettingsTable.$inferSelect;
