import { Router, type IRouter } from "express";
import { db, employeesTable, holidaysTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/employees", async (req, res): Promise<void> => {
  const rows = await db.select().from(employeesTable).orderBy(employeesTable.fullName);
  const result = rows.map(emp => {
    const manager = rows.find(e => e.id === emp.managerId);
    return {
      id: emp.id,
      full_name: emp.fullName,
      first_name: emp.firstName,
      last_name: emp.lastName,
      department: emp.department,
      role: emp.role,
      org_level: emp.orgLevel,
      manager_id: emp.managerId || null,
      manager_name: manager?.fullName || null,
      teams_user_id: emp.teamsUserId,
      email: emp.email,
    };
  });
  res.json(result);
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  const allEmployees = await db.select().from(employeesTable);
  const manager = allEmployees.find(e => e.id === emp.managerId);
  res.json({
    id: emp.id,
    full_name: emp.fullName,
    first_name: emp.firstName,
    last_name: emp.lastName,
    department: emp.department,
    role: emp.role,
    manager_id: emp.managerId || null,
    manager_name: manager?.fullName || null,
    teams_user_id: emp.teamsUserId,
    email: emp.email,
  });
});

router.get("/holidays", async (req, res): Promise<void> => {
  const rows = await db.select().from(holidaysTable).orderBy(holidaysTable.date);
  res.json(rows.map(h => ({ id: h.id, date: h.date, name: h.name, type: h.type })));
});

export default router;
