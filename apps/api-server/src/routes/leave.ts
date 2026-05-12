import { Router, type IRouter } from "express";
import { db, leaveRecordsTable, employeesTable, messageLogTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/leave/stats", async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [leavesToday] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leaveRecordsTable)
    .where(eq(leaveRecordsTable.leaveDate, today));

  const [leavesMonth] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leaveRecordsTable)
    .where(
      and(
        gte(leaveRecordsTable.leaveDate, firstOfMonth),
        lte(leaveRecordsTable.leaveDate, today)
      )
    );

  const [pendingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leaveRecordsTable)
    .where(eq(leaveRecordsTable.status, "pending"));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [msgToday] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messageLogTable)
    .where(gte(messageLogTable.createdAt, todayStart));

  const deptRows = await db
    .select({
      department: employeesTable.department,
      count: sql<number>`count(*)::int`,
    })
    .from(leaveRecordsTable)
    .innerJoin(employeesTable, eq(leaveRecordsTable.employeeId, employeesTable.id))
    .where(
      and(
        gte(leaveRecordsTable.leaveDate, firstOfMonth),
        lte(leaveRecordsTable.leaveDate, today)
      )
    )
    .groupBy(employeesTable.department);

  res.json({
    total_leaves_this_month: leavesMonth?.count ?? 0,
    total_leaves_today: leavesToday?.count ?? 0,
    pending_approvals: pendingCount?.count ?? 0,
    messages_processed_today: msgToday?.count ?? 0,
    top_departments: deptRows.map(r => ({ department: r.department, count: r.count })),
  });
});

router.get("/leave", async (req, res): Promise<void> => {
  const { employee_id, status } = req.query;
  const employees = await db.select().from(employeesTable);

  let rows = await db.select().from(leaveRecordsTable).orderBy(leaveRecordsTable.createdAt);

  if (employee_id) {
    const eid = parseInt(employee_id as string, 10);
    rows = rows.filter(r => r.employeeId === eid);
  }
  if (status) {
    rows = rows.filter(r => r.status === status);
  }

  const result = rows.map(row => {
    const emp = employees.find(e => e.id === row.employeeId);
    const approver = employees.find(e => e.id === row.approvedById);
    return {
      id: row.id,
      employee_id: row.employeeId,
      employee_name: emp?.fullName || "Unknown",
      department: emp?.department || "Unknown",
      leave_date: row.leaveDate,
      leave_type: row.leaveType,
      status: row.status,
      approved_by_id: row.approvedById || null,
      approved_by_name: approver?.fullName || null,
      source_message: row.sourceMessage || null,
      message_log_id: row.messageLogId || null,
      created_at: row.createdAt,
    };
  });

  res.json(result);
});

router.post("/leave", async (req, res): Promise<void> => {
  const { employee_id, leave_date, leave_type, approved_by_id, source_message } = req.body;
  if (!employee_id || !leave_date || !leave_type) {
    res.status(400).json({ error: "employee_id, leave_date, and leave_type are required" });
    return;
  }

  const [row] = await db.insert(leaveRecordsTable).values({
    employeeId: employee_id,
    leaveDate: leave_date,
    leaveType: leave_type,
    status: "approved",
    approvedById: approved_by_id || null,
    sourceMessage: source_message || null,
  }).returning();

  const employees = await db.select().from(employeesTable);
  const emp = employees.find(e => e.id === row.employeeId);
  const approver = employees.find(e => e.id === row.approvedById);

  res.status(201).json({
    id: row.id,
    employee_id: row.employeeId,
    employee_name: emp?.fullName || "Unknown",
    department: emp?.department || "Unknown",
    leave_date: row.leaveDate,
    leave_type: row.leaveType,
    status: row.status,
    approved_by_id: row.approvedById || null,
    approved_by_name: approver?.fullName || null,
    source_message: row.sourceMessage || null,
    message_log_id: row.messageLogId || null,
    created_at: row.createdAt,
  });
});

router.patch("/leave/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { leave_date, leave_type, status } = req.body;

  const updates: Record<string, any> = {};
  if (leave_date) updates.leaveDate = leave_date;
  if (leave_type) updates.leaveType = leave_type;
  if (status) updates.status = status;

  const [row] = await db.update(leaveRecordsTable).set(updates).where(eq(leaveRecordsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Leave record not found" });
    return;
  }

  const employees = await db.select().from(employeesTable);
  const emp = employees.find(e => e.id === row.employeeId);
  const approver = employees.find(e => e.id === row.approvedById);

  res.json({
    id: row.id,
    employee_id: row.employeeId,
    employee_name: emp?.fullName || "Unknown",
    department: emp?.department || "Unknown",
    leave_date: row.leaveDate,
    leave_type: row.leaveType,
    status: row.status,
    approved_by_id: row.approvedById || null,
    approved_by_name: approver?.fullName || null,
    source_message: row.sourceMessage || null,
    message_log_id: row.messageLogId || null,
    created_at: row.createdAt,
  });
});

router.delete("/leave/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [row] = await db.delete(leaveRecordsTable).where(eq(leaveRecordsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Leave record not found" });
    return;
  }
  res.json({ success: true, message: "Leave record deleted" });
});

export default router;
