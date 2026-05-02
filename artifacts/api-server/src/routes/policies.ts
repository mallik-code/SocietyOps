import { Router, type IRouter } from "express";
import { policyRepository } from "../repositories/policy.repository";

const router: IRouter = Router();


export type TrackedGroup = {
  id: number;
  name: string;
  group_id: string;
  description: string | null;
  enabled: boolean;
  message_count: number;
  created_at: string;
};

export type TrackedContact = {
  id: number;
  name: string;
  phone: string;
  description: string | null;
  enabled: boolean;
  message_count: number;
  created_at: string;
};

// Initialized to empty — populated from DB on startup in src/index.ts
export const trackedGroups: TrackedGroup[] = [];

// Initialized to empty — populated from DB on startup in src/index.ts
export const trackedContacts: TrackedContact[] = [];

let groupIdCounter = 1;
let contactIdCounter = 1;


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
  policyRepository.saveGroup(newGroup);
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
  
  policyRepository.updateGroup(group);
  res.json(group);
});

router.delete("/policies/groups/:id", (req, res): void => {
  const id = parseInt(req.params.id, 10);
  const idx = trackedGroups.findIndex((g) => g.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const group = trackedGroups[idx];
  trackedGroups.splice(idx, 1);
  policyRepository.deleteGroup(group.group_id);
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
  policyRepository.saveContact(newContact);
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
  
  policyRepository.updateContact(contact);
  res.json(contact);
});

router.delete("/policies/contacts/:id", (req, res): void => {
  const id = parseInt(req.params.id, 10);
  const idx = trackedContacts.findIndex((c) => c.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const contact = trackedContacts[idx];
  trackedContacts.splice(idx, 1);
  policyRepository.deleteContact(contact.phone);
  res.json({ deleted: true, id });
});

export default router;
