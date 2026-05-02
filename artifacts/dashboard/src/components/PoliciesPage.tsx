import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTrackedGroups,
  useListTrackedContacts,
  useAddTrackedGroup,
  useAddTrackedContact,
  useUpdateTrackedGroup,
  useUpdateTrackedContact,
  useDeleteTrackedGroup,
  useDeleteTrackedContact,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  User,
  Plus,
  Trash2,
  MessageSquare,
  Calendar,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

type Tab = "groups" | "contacts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        {tab === "groups" ? (
          <Users className="w-5 h-5 text-muted-foreground" />
        ) : (
          <User className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <p className="text-sm font-medium text-foreground mb-1">
        No {tab === "groups" ? "groups" : "contacts"} tracked yet
      </p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Add a {tab === "groups" ? "WhatsApp group" : "contact"} below to start tracking their messages for complaints.
      </p>
    </div>
  );
}

function AddGroupForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const { mutate, isPending } = useAddTrackedGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/policies/groups"] });
        onClose();
      },
      onError: (err: any) => {
        setError(err?.response?.data?.error ?? "Failed to add group");
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !groupId.trim()) {
      setError("Name and Group ID are required");
      return;
    }
    setError("");
    mutate({ data: { name: name.trim(), group_id: groupId.trim(), description: description.trim() || null } });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
      <p className="text-sm font-semibold text-foreground">Add WhatsApp Group</p>
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Block E Residents"
            className="w-full rounded-md border border-border bg-background text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            WhatsApp Group ID *
            <span className="ml-1 text-muted-foreground/60 font-normal">(JID ending in @g.us)</span>
          </label>
          <input
            type="text"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder="e.g. 120363012345678901@g.us"
            className="w-full rounded-md border border-border bg-background text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief note about this group…"
          className="w-full rounded-md border border-border bg-background text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60"
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Adding…" : "Add Group"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddContactForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const { mutate, isPending } = useAddTrackedContact({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/policies/contacts"] });
        onClose();
      },
      onError: (err: any) => {
        setError(err?.response?.data?.error ?? "Failed to add contact");
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required");
      return;
    }
    setError("");
    mutate({ data: { name: name.trim(), phone: phone.trim(), description: description.trim() || null } });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
      <p className="text-sm font-semibold text-foreground">Add Individual Contact</p>
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Khalid Nasser"
            className="w-full rounded-md border border-border bg-background text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Phone Number *
            <span className="ml-1 text-muted-foreground/60 font-normal">(E.164 format)</span>
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +971501234567"
            className="w-full rounded-md border border-border bg-background text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief note about this contact…"
          className="w-full rounded-md border border-border bg-background text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60"
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Adding…" : "Add Contact"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function GroupRow({ group }: { group: { id: number; name: string; group_id: string; description?: string | null; enabled: boolean; message_count: number; created_at: string } }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const { mutate: toggle, isPending: toggling } = useUpdateTrackedGroup({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/policies/groups"] }),
    },
  });

  const { mutate: remove, isPending: removing } = useDeleteTrackedGroup({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/policies/groups"] }),
    },
  });

  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{group.name}</span>
          <Badge
            variant={group.enabled ? "default" : "secondary"}
            className={`text-[10px] h-[18px] px-1.5 ${group.enabled ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-100" : "text-muted-foreground"}`}
          >
            {group.enabled ? "Active" : "Paused"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{group.group_id}</p>
        {group.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{group.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            {group.message_count.toLocaleString()} messages
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="w-3 h-3" />
            Added {formatDate(group.created_at)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        <button
          onClick={() => toggle({ id: group.id, data: { enabled: !group.enabled } })}
          disabled={toggling}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title={group.enabled ? "Pause tracking" : "Resume tracking"}
        >
          {group.enabled ? (
            <><ToggleRight className="w-3.5 h-3.5 text-green-600" /> Pause</>
          ) : (
            <><ToggleLeft className="w-3.5 h-3.5" /> Resume</>
          )}
        </button>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => remove({ id: group.id })}
              disabled={removing}
              className="px-2.5 py-1 text-xs rounded-md bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
            title="Remove from tracking"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ContactRow({ contact }: { contact: { id: number; name: string; phone: string; description?: string | null; enabled: boolean; message_count: number; created_at: string } }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const { mutate: toggle, isPending: toggling } = useUpdateTrackedContact({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/policies/contacts"] }),
    },
  });

  const { mutate: remove, isPending: removing } = useDeleteTrackedContact({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/policies/contacts"] }),
    },
  });

  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-xs font-semibold text-primary">
          {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{contact.name}</span>
          <Badge
            variant={contact.enabled ? "default" : "secondary"}
            className={`text-[10px] h-[18px] px-1.5 ${contact.enabled ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-100" : "text-muted-foreground"}`}
          >
            {contact.enabled ? "Active" : "Paused"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{contact.phone}</p>
        {contact.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{contact.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            {contact.message_count.toLocaleString()} messages
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="w-3 h-3" />
            Added {formatDate(contact.created_at)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        <button
          onClick={() => toggle({ id: contact.id, data: { enabled: !contact.enabled } })}
          disabled={toggling}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title={contact.enabled ? "Pause tracking" : "Resume tracking"}
        >
          {contact.enabled ? (
            <><ToggleRight className="w-3.5 h-3.5 text-green-600" /> Pause</>
          ) : (
            <><ToggleLeft className="w-3.5 h-3.5" /> Resume</>
          )}
        </button>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => remove({ id: contact.id })}
              disabled={removing}
              className="px-2.5 py-1 text-xs rounded-md bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
            title="Remove from tracking"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

interface PoliciesPageProps {
  isDark: boolean;
  onToggleDark: () => void;
}

export function PoliciesPage({ isDark, onToggleDark }: PoliciesPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("groups");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  const { data: groups, isLoading: groupsLoading } = useListTrackedGroups();
  const { data: contacts, isLoading: contactsLoading } = useListTrackedContacts();

  const activeGroups = groups?.filter((g) => g.enabled).length ?? 0;
  const activeContacts = contacts?.filter((c) => c.enabled).length ?? 0;
  const totalMessages =
    (groups?.reduce((s, g) => s + g.message_count, 0) ?? 0) +
    (contacts?.reduce((s, c) => s + c.message_count, 0) ?? 0);

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-[1000px] mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-bold text-[28px] leading-none text-foreground">Tracking Policies</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Configure which WhatsApp groups and individual contacts are monitored for complaints.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">Active Groups</p>
              <div className="text-2xl font-bold text-primary">
                {groupsLoading ? <Skeleton className="h-7 w-8" /> : activeGroups}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                of {groups?.length ?? 0} configured
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">Active Contacts</p>
              <div className="text-2xl font-bold text-primary">
                {contactsLoading ? <Skeleton className="h-7 w-8" /> : activeContacts}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                of {contacts?.length ?? 0} configured
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Messages Processed</p>
              <div className="text-2xl font-bold text-primary">
                {groupsLoading || contactsLoading ? <Skeleton className="h-7 w-12" /> : totalMessages.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">across all sources</div>
            </CardContent>
          </Card>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            onClick={() => { setActiveTab("groups"); setShowAddGroup(false); setShowAddContact(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "groups"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" />
            WhatsApp Groups
            {groups && (
              <span className="text-[11px] rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground font-normal">
                {groups.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("contacts"); setShowAddGroup(false); setShowAddContact(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "contacts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-4 h-4" />
            Individual Contacts
            {contacts && (
              <span className="text-[11px] rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground font-normal">
                {contacts.length}
              </span>
            )}
          </button>
        </div>

        {/* Groups tab */}
        {activeTab === "groups" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Tracked Groups</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Messages from these groups are scanned for complaints and classified by AI.
                </p>
              </div>
              <button
                onClick={() => setShowAddGroup((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Add Group
              </button>
            </div>

            {showAddGroup && (
              <AddGroupForm onClose={() => setShowAddGroup(false)} />
            )}

            <Card>
              <CardContent className="p-0">
                {groupsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-64" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-7 w-16" />
                      </div>
                    ))}
                  </div>
                ) : groups && groups.length > 0 ? (
                  <div className="px-4">
                    {groups.map((g) => (
                      <GroupRow key={g.id} group={g} />
                    ))}
                  </div>
                ) : (
                  <EmptyState tab="groups" />
                )}
              </CardContent>
            </Card>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex gap-2">
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">How to find your WhatsApp Group ID</p>
                  <p className="text-xs text-muted-foreground">
                    The Group ID (JID) is available in your Evolution API dashboard under <span className="font-mono bg-muted px-1 rounded">Instances → Chats</span>. It typically looks like <span className="font-mono bg-muted px-1 rounded">120363012345678901@g.us</span>. You can also retrieve it via the Evolution API <span className="font-mono bg-muted px-1 rounded">GET /chat/findChats/{"{instance}"}</span> endpoint.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contacts tab */}
        {activeTab === "contacts" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Tracked Contacts</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct messages from these individuals are also scanned for complaints.
                </p>
              </div>
              <button
                onClick={() => setShowAddContact((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            </div>

            {showAddContact && (
              <AddContactForm onClose={() => setShowAddContact(false)} />
            )}

            <Card>
              <CardContent className="p-0">
                {contactsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-7 w-16" />
                      </div>
                    ))}
                  </div>
                ) : contacts && contacts.length > 0 ? (
                  <div className="px-4">
                    {contacts.map((c) => (
                      <ContactRow key={c.id} contact={c} />
                    ))}
                  </div>
                ) : (
                  <EmptyState tab="contacts" />
                )}
              </CardContent>
            </Card>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex gap-2">
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Phone number format</p>
                  <p className="text-xs text-muted-foreground">
                    Enter phone numbers in E.164 format including the country code, e.g. <span className="font-mono bg-muted px-1 rounded">+971501234567</span>. This must match the number registered on WhatsApp for messages to be correctly attributed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
