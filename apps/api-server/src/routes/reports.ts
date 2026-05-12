import { Router, type IRouter } from "express";
import { db, employeesTable, leaveRecordsTable } from "@workspace/db";
import { gte, lte, and, eq } from "drizzle-orm";

const router: IRouter = Router();

type OrgLevel = "individual" | "flm" | "delivery_manager" | "account_manager" | "org_head";

interface Employee {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
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
  const directReports = allEmployees.filter(e => e.managerId === managerId);
  const result: number[] = [managerId];
  for (const report of directReports) {
    result.push(...getSubtreeIds(report.id, allEmployees));
  }
  return result;
}

function summarizeLeaves(employeeIds: Set<number>, leaves: LeaveRecord[], today: string, monthStart: string, yearStart: string) {
  const teamLeaves = leaves.filter(l => employeeIds.has(l.employeeId) && l.status === "approved");
  const leavesToday = teamLeaves.filter(l => l.leaveDate === today).length;
  const leavesMonth = teamLeaves.filter(l => l.leaveDate >= monthStart && l.leaveDate <= today).length;
  const leavesYear = teamLeaves.filter(l => l.leaveDate >= yearStart && l.leaveDate <= today).length;
  const byType: Record<string, number> = {};
  for (const l of teamLeaves) {
    byType[l.leaveType] = (byType[l.leaveType] || 0) + 1;
  }
  return { leaves_today: leavesToday, leaves_this_month: leavesMonth, leaves_ytd: leavesYear, by_type: byType };
}

router.get("/reports", async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];

  const allEmployees = await db.select().from(employeesTable);
  const allLeaves = await db.select().from(leaveRecordsTable);

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
    firstName: e.firstName,
    lastName: e.lastName,
    department: e.department,
    role: e.role,
    managerId: e.managerId,
    orgLevel: e.orgLevel,
    email: e.email,
  }));

  function buildManagerReport(manager: Employee) {
    const subtreeIds = new Set(getSubtreeIds(manager.id, employees));
    subtreeIds.delete(manager.id);
    const teamSize = subtreeIds.size;
    const summary = summarizeLeaves(subtreeIds, leaves, today, monthStart, yearStart);
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
      team_size: teamSize,
      departments: Array.from(depts),
      ...summary,
    };
  }

  const allIds = new Set(employees.map(e => e.id));
  const companyLeavesSummary = summarizeLeaves(allIds, leaves, today, monthStart, yearStart);

  const orgHeads = employees.filter(e => e.orgLevel === "org_head");
  const deliveryManagers = employees.filter(e => e.orgLevel === "delivery_manager");
  const accountManagers = employees.filter(e => e.orgLevel === "account_manager");
  const flms = employees.filter(e => e.orgLevel === "flm");

  const slmIds = new Set<number>();
  flms.forEach(flm => {
    if (flm.managerId) slmIds.add(flm.managerId);
  });
  const slms = employees.filter(e => slmIds.has(e.id) && e.orgLevel !== "org_head");

  res.json({
    period: { today, month_start: monthStart, year_start: yearStart },
    company: {
      total_employees: employees.length,
      ...companyLeavesSummary,
      by_department: Object.fromEntries(
        Array.from(new Set(employees.map(e => e.department))).map(dept => {
          const deptIds = new Set(employees.filter(e => e.department === dept).map(e => e.id));
          const s = summarizeLeaves(deptIds, leaves, today, monthStart, yearStart);
          return [dept, { employee_count: deptIds.size, ...s }];
        })
      ),
    },
    org_head: orgHeads.map(buildManagerReport),
    delivery_manager: deliveryManagers.map(buildManagerReport),
    account_manager: accountManagers.map(buildManagerReport),
    slm: slms.map(buildManagerReport),
    flm: flms.map(buildManagerReport),
  });
});

export default router;
