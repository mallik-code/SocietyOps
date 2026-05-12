import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, TrendingUp, CalendarDays, Clock, BarChart3 } from "lucide-react";

const LEVELS = [
  { key: "company",          label: "Company",          icon: Building2,   description: "Organisation-wide leave summary" },
  { key: "org_head",         label: "Org Head",         icon: TrendingUp,  description: "Report per Org Head" },
  { key: "delivery_manager", label: "Delivery Manager", icon: BarChart3,   description: "Report per Delivery Manager" },
  { key: "account_manager",  label: "Account Manager",  icon: BarChart3,   description: "Report per Account Manager" },
  { key: "slm",              label: "Second Line Mgr",  icon: Users,       description: "Report per Second Line Manager" },
  { key: "flm",              label: "First Line Mgr",   icon: Users,       description: "Report per First Line Manager" },
] as const;

type LevelKey = typeof LEVELS[number]["key"];

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: number | string; icon: React.ElementType; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function CompanyView({ data }: { data: any }) {
  if (!data?.company) return null;
  const c = data.company;
  const depts = Object.entries(c.by_department || {}) as [string, any][];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Employees"  value={c.total_employees}   icon={Users}        />
        <StatCard label="On Leave Today"   value={c.leaves_today}      icon={Clock}        sub="approved leaves" />
        <StatCard label="Leaves This Month" value={c.leaves_this_month} icon={CalendarDays} sub={`since ${data.period?.month_start}`} />
        <StatCard label="Leaves YTD"       value={c.leaves_ytd}        icon={TrendingUp}   sub={`since ${data.period?.year_start}`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Department Breakdown</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Today</TableHead>
                <TableHead className="text-right">This Month</TableHead>
                <TableHead className="text-right">YTD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {depts.map(([dept, d]) => (
                <TableRow key={dept}>
                  <TableCell className="font-medium">{dept}</TableCell>
                  <TableCell className="text-right">{d.employee_count}</TableCell>
                  <TableCell className="text-right">{d.leaves_today}</TableCell>
                  <TableCell className="text-right">{d.leaves_this_month}</TableCell>
                  <TableCell className="text-right">{d.leaves_ytd}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {c.by_type && Object.keys(c.by_type).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Leave Type Distribution (YTD)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {Object.entries(c.by_type as Record<string, number>).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted/30">
                <span className="capitalize text-sm font-medium">{type.replace("_", " ")}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ManagerLevelView({ managers, levelLabel }: { managers: any[]; levelLabel: string }) {
  if (!managers || managers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No {levelLabel}s found in the system.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={`${levelLabel}s`}     value={managers.length}                              icon={Users} />
        <StatCard label="Team Members Total"   value={managers.reduce((s, m) => s + m.team_size, 0)} icon={Users} />
        <StatCard label="On Leave Today (Team)" value={managers.reduce((s, m) => s + m.leaves_today, 0)} icon={Clock} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Manager</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead className="text-right">Team Size</TableHead>
                <TableHead className="text-right">On Leave Today</TableHead>
                <TableHead className="text-right">This Month</TableHead>
                <TableHead className="text-right">YTD</TableHead>
                <TableHead>Leave Types</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map((m) => (
                <TableRow key={m.manager.id}>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-sm">{m.manager.name}</p>
                      <p className="text-xs text-muted-foreground">{m.manager.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.manager.role}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(m.departments || []).map((d: string) => (
                        <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{m.team_size}</TableCell>
                  <TableCell className="text-right">
                    <span className={m.leaves_today > 0 ? "font-bold text-primary" : "text-muted-foreground"}>
                      {m.leaves_today}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{m.leaves_this_month}</TableCell>
                  <TableCell className="text-right">{m.leaves_ytd}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(m.by_type || {}).map(([type, count]) => (
                        <Badge key={type} variant="secondary" className="text-xs capitalize">
                          {type.replace("_", " ")}: {count as number}
                        </Badge>
                      ))}
                      {Object.keys(m.by_type || {}).length === 0 && (
                        <span className="text-xs text-muted-foreground">No leaves</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function Reports() {
  const [activeLevel, setActiveLevel] = useState<LevelKey>("company");

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
    staleTime: 30_000,
  });

  const activeTab = LEVELS.find(l => l.key === activeLevel)!;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Leave Reports</h2>
        <p className="text-muted-foreground mt-1">Aggregated leave data across all organisational levels.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {LEVELS.map((level) => {
          const Icon = level.icon;
          const isActive = activeLevel === level.key;
          return (
            <button
              key={level.key}
              onClick={() => setActiveLevel(level.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                }`}
            >
              <Icon className="h-4 w-4" />
              {level.label}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="h-24 pt-5 animate-pulse bg-muted/30 rounded-lg" /></Card>
          ))}
        </div>
      )}

      {error && (
        <Card><CardContent className="py-8 text-center text-destructive">Failed to load report data. Please try again.</CardContent></Card>
      )}

      {!isLoading && !error && data && (
        <div>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">{activeTab.description}</p>
          </div>

          {activeLevel === "company" && <CompanyView data={data} />}
          {activeLevel === "org_head"         && <ManagerLevelView managers={data.org_head}         levelLabel="Org Head" />}
          {activeLevel === "delivery_manager" && <ManagerLevelView managers={data.delivery_manager} levelLabel="Delivery Manager" />}
          {activeLevel === "account_manager"  && <ManagerLevelView managers={data.account_manager}  levelLabel="Account Manager" />}
          {activeLevel === "slm"              && <ManagerLevelView managers={data.slm}               levelLabel="Second Line Manager" />}
          {activeLevel === "flm"              && <ManagerLevelView managers={data.flm}               levelLabel="First Line Manager" />}
        </div>
      )}
    </div>
  );
}
