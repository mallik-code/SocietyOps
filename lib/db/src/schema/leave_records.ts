import { pgTable, text, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leaveRecordsTable = pgTable("leave_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  leaveDate: date("leave_date").notNull(),
  leaveType: text("leave_type").notNull().default("full_day"),
  status: text("status").notNull().default("approved"),
  approvedById: integer("approved_by_id"),
  sourceMessage: text("source_message"),
  messageLogId: integer("message_log_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeaveRecordSchema = createInsertSchema(leaveRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLeaveRecord = z.infer<typeof insertLeaveRecordSchema>;
export type LeaveRecord = typeof leaveRecordsTable.$inferSelect;
