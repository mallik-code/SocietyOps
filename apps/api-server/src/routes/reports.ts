import { Router, type IRouter } from "express";
import { db, employeesTable, leaveRecordsTable } from "@workspace/db";

const router: IRouter = Router();

interface Employee {
  id: number;
  fullName: string;
  department: string;
  role: string;
  managerId: number | null;
  orgLevel: string;
  email: string;
}

interface LeaveRecord {
  id: number;
  employeeId: number;
  leaveDate: string;
  leaveType: string;
  status: string;
}

function getSubtreeIds(managerId: number, allEmployees: Employee[]): number[] {
  const result: number[] = [managerId];
  for (const e of allEmployees) {
    if (e.managerId === managerId) {
      result.push(...getSubtreeIds(e.id, allEmployees));
    }
  }
  return result;
}

function summarizeLeaves(
  employeeIds: Set<number>,
  leaves: LeaveRecord[],
  from: string,
  to: string,
  today: string,
) {
  const approved = leaves.filter(l => employeeIds.has(l.employeeId) && l.status === "approved");
  const inPeriod = approved.filter(l => l.leaveDate >= from && l.leaveDate <= to);
  const leavesToday = approved.filter(l => l.leaveDate === today).length;
  const byType: Record<string, number> = {};
  for (const l of inPeriod) {
    byType[l.leaveType] = (byType[l.leaveType] || 0) + 1;
  }
  return { leaves_in_period: inPeriod.length, leaves_today: leavesToday, by_type: byType };
}

router.get("/reports", async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  const rawFrom = req.query.from as string | undefined;
  const rawTo   = req.query.to   as string | undefined;

  const from = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom
    : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const to   = rawTo   && /^\d{4}-\d{2}-\d{2}$/.test(rawTo)   ? rawTo   : today;

  const allEmployees = await db.select().from(employeesTable);
  const allLeaves    = await db.select().from(leaveRecordsTable);

  const leaves: LeaveRecord[] = allLeaves.map(l => ({
    id: l.id,
    employeeId: l.employeeId,
    leaveDate: l.leaveDate,
    leaveType: l.leaveType,
    status: l.status,
  }));

  const employees: Employee[] = allEmployees.map(e => ({
    id: e.id,
    fullName: e.fullName,
    department: e.department,
    role: e.role,
    managerId: e.managerId,
    orgLevel: e.orgLevel,
    email: e.email,
  }));

  function buildManagerReport(manager: Employee) {
    const subtreeIds = new Set(getSubtreeIds(manager.id, employees));
    subtreeIds.delete(manager.id);
    const depts = new Set(employees.filter(e => subtreeIds.has(e.id)).map(e => e.department));
    return {
      manager: {
        id: manager.id,
        name: manager.fullName,
        role: manager.role,
        department: manager.department,
        email: manager.email,
        org_level: manager.orgLevel,
      },
      team_size: subtreeIds.size,
      departments: Array.from(depts),
      ...summarizeLeaves(subtreeIds, leaves, from, to, today),
    };
  }

  const allIds     = new Set(employees.map(e => e.id));
  const companySummary = summarizeLeaves(allIds, leaves, from, to, today);

  const orgHeads         = employees.filter(e => e.orgLevel === "org_head");
  const deliveryManagers = employees.filter(e => e.orgLevel === "delivery_manager");
  const accountManagers  = employees.filter(e => e.orgLevel === "account_manager");
  const flms             = employees.filter(e => e.orgLevel === "flm");

  const slmIds = new Set<number>();
  flms.forEach(f => { if (f.managerId) slmIds.add(f.managerId); });
  const slms = employees.filter(e => slmIds.has(e.id) && e.orgLevel !== "org_head");

  const depts = Array.from(new Set(employees.map(e => e.department)));
  const byDept = Object.fromEntries(
    depts.map(dept => {
      const ids = new Set(employees.filter(e => e.department === dept).map(e => e.id));
      return [dept, { employee_count: ids.size, ...summarizeLeaves(ids, leaves, from, to, today) }];
    })
  );

  res.json({
    period: { from, to, today },
    company: {
      total_employees: employees.length,
      ...companySummary,
      by_department: byDept,
    },
    org_head:         orgHeads.map(buildManagerReport),
    delivery_manager: deliveryManagers.map(buildManagerReport),
    account_manager:  accountManagers.map(buildManagerReport),
    slm:              slms.map(buildManagerReport),
    flm:              flms.map(buildManagerReport),
  });
});

export default router;
