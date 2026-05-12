import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull(),
  managerId: integer("manager_id"),
  orgLevel: text("org_level").notNull().default("individual"),
  teamsUserId: text("teams_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
