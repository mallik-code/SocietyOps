import { Router, type IRouter } from "express";

const router: IRouter = Router();

type TrackedGroup = {
  id: number;
  name: string;
  group_id: string;
  description: string | null;
  enabled: boolean;
  message_count: number;
  created_at: string;
};

type TrackedContact = {
  id: number;
  name: string;
  phone: string;
  description: string | null;
  enabled: boolean;
  message_count: number;
  created_at: string;
};

const trackedGroups: TrackedGroup[] = [
  {
    id: 1,
    name: "Block A Residents",
    group_id: "120363012345678901@g.us",
    description: "Main group for Block A residents — floors 1-8",
    enabled: true,
    message_count: 87,
    created_at: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
  },
  {
    id: 2,
    name: "Block B Residents",
    group_id: "120363098765432101@g.us",
    description: "Block B resident complaints and announcements",
    enabled: true,
    message_count: 64,
    created_at: new Date(Date.now() - 28 * 24 * 3600000).toISOString(),
  },
  {
    id: 3,
    name: "Block C Residents",
    group_id: "120363011122334455@g.us",
    description: null,
    enabled: true,
    message_count: 51,
    created_at: new Date(Date.now() - 25 * 24 * 3600000).toISOString(),
  },
  {
    id: 4,
    name: "Block D Residents",
    group_id: "120363055667788990@g.us",
    description: "Block D resident complaints group",
    enabled: false,
    message_count: 12,
    created_at: new Date(Date.now() - 10 * 24 * 3600000).toISOString(),
  },
  {
    id: 5,
    name: "Building Management Group",
    group_id: "120363019988776655@g.us",
    description: "Supervisors and building managers — priority escalations",
    enabled: true,
    message_count: 203,
    created_at: new Date(Date.now() - 45 * 24 * 3600000).toISOString(),
  },
  {
    id: 6,
    name: "Amenities Group",
    group_id: "120363033445566778@g.us",
    description: "Pool, gym and common area complaints",
    enabled: true,
    message_count: 38,
    created_at: new Date(Date.now() - 20 * 24 * 3600000).toISOString(),
  },
];

const trackedContacts: TrackedContact[] = [
  {
    id: 1,
    name: "Ahmed Al-Rashid",
    phone: "+971501234567",
    description: "Block A Committee Head — direct complaint forwarding",
    enabled: true,
    message_count: 34,
    created_at: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
  },
  {
    id: 2,
    name: "Fatima Khalid",
    phone: "+971509876543",
    description: "Block B liaison",
    enabled: true,
    message_count: 21,
    created_at: new Date(Date.now() - 20 * 24 * 3600000).toISOString(),
  },
  {
    id: 3,
    name: "Hassan Ali",
    phone: "+971507654321",
    description: "Parking and security coordinator",
    enabled: true,
    message_count: 17,
    created_at: new Date(Date.now() - 15 * 24 * 3600000).toISOString(),
  },
  {
    id: 4,
    name: "Sara Al-Amin",
    phone: "+971502345678",
    description: null,
    enabled: false,
    message_count: 5,
    created_at: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
  },
];

let groupIdCounter = trackedGroups.length + 1;
let contactIdCounter = trackedContacts.length + 1;

router.get("/policies/groups", (_req, res): void => {
  res.json(trackedGroups);
});

router.post("/policies/groups", (req, res): void => {
  const { name, group_id, description } = req.body as {
    name: string;
    group_id: string;
    description?: string;
  };

  if (!name || !group_id) {
    res.status(400).json({ error: "name and group_id are required" });
    return;
  }

  const existing = trackedGroups.find((g) => g.group_id === group_id);
  if (existing) {
    res.status(409).json({ error: "This group is already being tracked" });
    return;
  }

  const newGroup: TrackedGroup = {
    id: groupIdCounter++,
    name,
    group_id,
    description: description ?? null,
    enabled: true,
    message_count: 0,
    created_at: new Date().toISOString(),
  };
  trackedGroups.push(newGroup);
  res.status(201).json(newGroup);
});

router.patch("/policies/groups/:id", (req, res): void => {
  const id = parseInt(req.params.id, 10);
  const group = trackedGroups.find((g) => g.id === id);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const { enabled, name, description } = req.body as {
    enabled?: boolean;
    name?: string;
    description?: string;
  };
  if (enabled !== undefined) group.enabled = enabled;
  if (name !== undefined) group.name = name;
  if (description !== undefined) group.description = description;
  res.json(group);
});

router.delete("/policies/groups/:id", (req, res): void => {
  const id = parseInt(req.params.id, 10);
  const idx = trackedGroups.findIndex((g) => g.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  trackedGroups.splice(idx, 1);
  res.json({ deleted: true, id });
});

router.get("/policies/contacts", (_req, res): void => {
  res.json(trackedContacts);
});

router.post("/policies/contacts", (req, res): void => {
  const { name, phone, description } = req.body as {
    name: string;
    phone: string;
    description?: string;
  };

  if (!name || !phone) {
    res.status(400).json({ error: "name and phone are required" });
    return;
  }

  const existing = trackedContacts.find((c) => c.phone === phone);
  if (existing) {
    res.status(409).json({ error: "This contact is already being tracked" });
    return;
  }

  const newContact: TrackedContact = {
    id: contactIdCounter++,
    name,
    phone,
    description: description ?? null,
    enabled: true,
    message_count: 0,
    created_at: new Date().toISOString(),
  };
  trackedContacts.push(newContact);
  res.status(201).json(newContact);
});

router.patch("/policies/contacts/:id", (req, res): void => {
  const id = parseInt(req.params.id, 10);
  const contact = trackedContacts.find((c) => c.id === id);
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const { enabled, name, description } = req.body as {
    enabled?: boolean;
    name?: string;
    description?: string;
  };
  if (enabled !== undefined) contact.enabled = enabled;
  if (name !== undefined) contact.name = name;
  if (description !== undefined) contact.description = description;
  res.json(contact);
});

router.delete("/policies/contacts/:id", (req, res): void => {
  const id = parseInt(req.params.id, 10);
  const idx = trackedContacts.findIndex((c) => c.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  trackedContacts.splice(idx, 1);
  res.json({ deleted: true, id });
});

export default router;
