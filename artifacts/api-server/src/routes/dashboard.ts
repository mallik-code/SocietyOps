import { Router, type IRouter } from "express";
import {
  GetDashboardStatsResponse,
  GetCategoryBreakdownResponseItem,
  GetPriorityBreakdownResponseItem,
  GetStatusBreakdownResponseItem,
  GetDailyTrendResponseItem,
  GetWhatsappStatusResponse,
  GetRecentActivityResponseItem,
  ListTicketsResponseItem,
  UpdateTicketStatusBody,
  UpdateTicketStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

export type Ticket = {
  id: number;
  message_text: string;
  category: string;
  priority: string;
  status: string;
  location: string | null;
  reporter_name: string | null;
  group_name: string | null;
  created_at: string;
  updated_at: string | null;
};

export const tickets: Ticket[] = [
  {
    id: 1,
    message_text: "The lift in Block A has been stuck on floor 3 since yesterday morning. Several residents are unable to use it.",
    category: "Lift",
    priority: "High",
    status: "in_progress",
    location: "Block A, Floor 3",
    reporter_name: "Ahmed Al-Rashid",
    group_name: "Block A Residents",
    created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 3600000).toISOString(),
  },
  {
    id: 2,
    message_text: "Garbage has not been collected from the ground floor for 3 days. It's starting to smell.",
    category: "Garbage",
    priority: "High",
    status: "open",
    location: "Ground Floor, Block B",
    reporter_name: "Fatima Khalid",
    group_name: "Building Management Group",
    created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
    updated_at: null,
  },
  {
    id: 3,
    message_text: "Water leak in apartment 4B ceiling — drops are coming from above. Urgent!",
    category: "Water",
    priority: "High",
    status: "open",
    location: "Apartment 4B",
    reporter_name: "Omar Hassan",
    group_name: "Block B Residents",
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    updated_at: null,
  },
  {
    id: 4,
    message_text: "The hallway lights on floors 2 and 3 in Block C have been flickering for a week.",
    category: "Electrical",
    priority: "Medium",
    status: "in_progress",
    location: "Block C, Floors 2-3",
    reporter_name: "Layla Mansour",
    group_name: "Block C Residents",
    created_at: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
  },
  {
    id: 5,
    message_text: "The main gate intercom system is not working. Visitors can't buzz in.",
    category: "Security",
    priority: "High",
    status: "resolved",
    location: "Main Entrance",
    reporter_name: "Yousef Ibrahim",
    group_name: "Building Management Group",
    created_at: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
  },
  {
    id: 6,
    message_text: "The pool area has not been cleaned in two weeks. There is algae on the walls.",
    category: "Cleaning",
    priority: "Medium",
    status: "open",
    location: "Pool Area",
    reporter_name: "Sara Al-Amin",
    group_name: "Amenities Group",
    created_at: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
    updated_at: null,
  },
  {
    id: 7,
    message_text: "Lift in Block B making loud grinding noise. Safety concern for residents.",
    category: "Lift",
    priority: "High",
    status: "open",
    location: "Block B",
    reporter_name: "Khalid Nasser",
    group_name: "Block B Residents",
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: null,
  },
  {
    id: 8,
    message_text: "The rooftop water tank is making noise at night. Possible pump issue.",
    category: "Water",
    priority: "Medium",
    status: "delayed",
    location: "Rooftop",
    reporter_name: "Nour Al-Din",
    group_name: "Building Management Group",
    created_at: new Date(Date.now() - 10 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
  },
  {
    id: 9,
    message_text: "Parking barrier arm broken. Anyone can enter the lot without authorization.",
    category: "Security",
    priority: "Medium",
    status: "in_progress",
    location: "Basement Parking",
    reporter_name: "Hassan Ali",
    group_name: "Parking Group",
    created_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: 10,
    message_text: "Central AC in lobby is blowing hot air. Temperature is unbearable.",
    category: "Other",
    priority: "Medium",
    status: "resolved",
    location: "Lobby",
    reporter_name: "Mariam Farouk",
    group_name: "Block A Residents",
    created_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
  },
  {
    id: 11,
    message_text: "Corridor cleaning on floor 7 Block A hasn't been done since last Thursday.",
    category: "Cleaning",
    priority: "Low",
    status: "open",
    location: "Block A, Floor 7",
    reporter_name: "Amira Saleh",
    group_name: "Block A Residents",
    created_at: new Date(Date.now() - 6 * 24 * 3600000).toISOString(),
    updated_at: null,
  },
  {
    id: 12,
    message_text: "Power socket in gym not working. Treadmills and equipment cannot be used.",
    category: "Electrical",
    priority: "Medium",
    status: "closed",
    location: "Gym",
    reporter_name: "Tariq Bassam",
    group_name: "Amenities Group",
    created_at: new Date(Date.now() - 15 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 24 * 3600000).toISOString(),
  },
  {
    id: 13,
    message_text: "Water pressure very low in Block C apartments above floor 5.",
    category: "Water",
    priority: "High",
    status: "in_progress",
    location: "Block C, Floors 5-8",
    reporter_name: "Rania Qassem",
    group_name: "Block C Residents",
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 14,
    message_text: "CCTV cameras in Block D stairwell appear offline. Security concern.",
    category: "Security",
    priority: "High",
    status: "open",
    location: "Block D, Stairwell",
    reporter_name: "Jad Al-Haddad",
    group_name: "Building Management Group",
    created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    updated_at: null,
  },
  {
    id: 15,
    message_text: "Lift door in Block D is not closing properly — keeps reopening after 2 seconds.",
    category: "Lift",
    priority: "Medium",
    status: "resolved",
    location: "Block D",
    reporter_name: "Dina Sharaf",
    group_name: "Block D Residents",
    created_at: new Date(Date.now() - 9 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
  },
];

router.get("/dashboard/stats", (_req, res): void => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedToday = tickets.filter((t) => {
    if (t.status !== "resolved" && t.status !== "closed") return false;
    const updated = t.updated_at ? new Date(t.updated_at) : null;
    return updated && updated >= today;
  }).length;
  const highPriorityOpen = tickets.filter(
    (t) => t.priority === "High" && (t.status === "open" || t.status === "in_progress")
  ).length;
  const closed = tickets.filter((t) => t.status === "closed").length;

  const resolvedTickets = tickets.filter(
    (t) => t.updated_at && (t.status === "resolved" || t.status === "closed")
  );
  const avgResolutionHours =
    resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime();
          const updated = new Date(t.updated_at!).getTime();
          return sum + (updated - created) / 3600000;
        }, 0) / resolvedTickets.length
      : 0;

  const data = GetDashboardStatsResponse.parse({
    total_tickets: tickets.length,
    open_tickets: open,
    in_progress_tickets: inProgress,
    resolved_today: resolvedToday,
    high_priority_open: highPriorityOpen,
    closed_tickets: closed,
    messages_processed_today: 34,
    avg_resolution_hours: Math.round(avgResolutionHours * 10) / 10,
  });

  res.json(data);
});

router.get("/dashboard/categories", (_req, res): void => {
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  const data = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => GetCategoryBreakdownResponseItem.parse({ category, count }));
  res.json(data);
});

router.get("/dashboard/priorities", (_req, res): void => {
  const order = ["High", "Medium", "Low"];
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    counts[t.priority] = (counts[t.priority] ?? 0) + 1;
  }
  const data = order
    .filter((p) => counts[p])
    .map((priority) =>
      GetPriorityBreakdownResponseItem.parse({ priority, count: counts[priority] })
    );
  res.json(data);
});

router.get("/dashboard/trend", (_req, res): void => {
  const counts: Record<string, number> = {
    [formatDate(14)]: 2,
    [formatDate(13)]: 3,
    [formatDate(12)]: 1,
    [formatDate(11)]: 4,
    [formatDate(10)]: 2,
    [formatDate(9)]: 5,
    [formatDate(8)]: 3,
    [formatDate(7)]: 2,
    [formatDate(6)]: 4,
    [formatDate(5)]: 6,
    [formatDate(4)]: 3,
    [formatDate(3)]: 2,
    [formatDate(2)]: 4,
    [formatDate(1)]: 5,
    [formatDate(0)]: 0,
  };

  for (const t of tickets) {
    const d = t.created_at.slice(0, 10);
    if (d in counts) counts[d]++;
  }

  const data = Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => GetDailyTrendResponseItem.parse({ date, count }));
  res.json(data);
});

router.get("/dashboard/status-breakdown", (_req, res): void => {
  const order = ["open", "in_progress", "resolved", "delayed", "closed"];
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  const data = order
    .filter((s) => counts[s])
    .map((status) => GetStatusBreakdownResponseItem.parse({ status, count: counts[status] }));
  res.json(data);
});

router.get("/dashboard/whatsapp-status", (_req, res): void => {
  const data = GetWhatsappStatusResponse.parse({
    connected: true,
    instance: "building-mgmt-wa",
    state: "open",
    api_url: "http://evolution-api:8080",
  });
  res.json(data);
});

router.get("/dashboard/recent-activity", (_req, res): void => {
  const recentEvents = [
    {
      id: 1,
      ticket_id: 3,
      event: "created",
      description: "New water leak complaint submitted via WhatsApp",
      category: "Water",
      priority: "High",
      status: "open",
      timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
      id: 2,
      ticket_id: 7,
      event: "created",
      description: "Lift grinding noise complaint received",
      category: "Lift",
      priority: "High",
      status: "open",
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: 3,
      ticket_id: 13,
      event: "status_changed",
      description: "Water pressure issue escalated to in_progress",
      category: "Water",
      priority: "High",
      status: "in_progress",
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: 4,
      ticket_id: 14,
      event: "created",
      description: "CCTV offline — security complaint logged",
      category: "Security",
      priority: "High",
      status: "open",
      timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
    },
    {
      id: 5,
      ticket_id: 5,
      event: "supervisor_action",
      description: "Intercom issue resolved by maintenance team",
      category: "Security",
      priority: "High",
      status: "resolved",
      timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    },
  ].map((e) => GetRecentActivityResponseItem.parse(e));
  res.json(recentEvents);
});

router.get("/tickets", (req, res): void => {
  let result = [...tickets];

  const { status, priority, category, limit } = req.query;

  if (status && typeof status === "string") {
    result = result.filter((t) => t.status === status);
  }
  if (priority && typeof priority === "string") {
    result = result.filter((t) => t.priority === priority);
  }
  if (category && typeof category === "string") {
    result = result.filter((t) => t.category === category);
  }

  const n = limit ? parseInt(String(limit), 10) : 50;
  result = result.slice(0, n);

  const data = result.map((t) => ListTicketsResponseItem.parse(t));
  res.json(data);
});

router.get("/tickets/:id", (req, res): void => {
  const id = parseInt(req.params.id, 10);
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json(ListTicketsResponseItem.parse(ticket));
});

router.patch("/tickets/:id/status", (req, res): void => {
  const id = parseInt(req.params.id, 10);
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const body = UpdateTicketStatusBody.parse(req.body);
  ticket.status = body.status;
  ticket.updated_at = new Date().toISOString();
  res.json(UpdateTicketStatusResponse.parse(ticket));
});

function formatDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default router;
