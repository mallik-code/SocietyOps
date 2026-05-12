import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Hash, Plus, Trash2, Bot, BotOff } from "lucide-react";

interface Channel {
  id: number;
  name: string;
  channel_id: string;
  description: string | null;
  agent_enabled: boolean;
  message_count: number;
  created_at: string;
}

async function fetchChannels(): Promise<Channel[]> {
  const res = await fetch("/api/teams/channels");
  if (!res.ok) throw new Error("Failed to fetch channels");
  return res.json();
}

async function createChannel(body: { name: string; channel_id: string; description?: string }): Promise<Channel> {
  const res = await fetch("/api/teams/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to create channel");
  }
  return res.json();
}

async function toggleChannel(id: number, agentEnabled: boolean): Promise<Channel> {
  const res = await fetch(`/api/teams/channels/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent_enabled: agentEnabled }),
  });
  if (!res.ok) throw new Error("Failed to update channel");
  return res.json();
}

async function deleteChannel(id: number): Promise<void> {
  const res = await fetch(`/api/teams/channels/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete channel");
}

export function Channels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newName, setNewName]         = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newDesc, setNewDesc]         = useState("");
  const [showForm, setShowForm]       = useState(false);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["teams-channels"],
    queryFn: fetchChannels,
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: createChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams-channels"] });
      setNewName(""); setNewChannelId(""); setNewDesc(""); setShowForm(false);
      toast({ title: "Channel added", description: "The channel is now being monitored." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => toggleChannel(id, enabled),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["teams-channels"] });
      toast({
        title: updated.agent_enabled ? "Agent enabled" : "Agent disabled",
        description: updated.agent_enabled
          ? `AI agent is now active in ${updated.name}.`
          : `AI agent is paused for ${updated.name}.`,
      });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Could not update channel." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams-channels"] });
      toast({ title: "Channel removed" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Could not delete channel." });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newChannelId.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      channel_id: newChannelId.trim(),
      description: newDesc.trim() || undefined,
    });
  };

  const enabledCount  = channels.filter(c => c.agent_enabled).length;
  const disabledCount = channels.filter(c => !c.agent_enabled).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Teams Channels</h2>
          <p className="text-muted-foreground mt-1">Control which channels the AI agent monitors for leave notifications.</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add Channel
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Channels</p>
            <p className="text-3xl font-bold mt-1">{channels.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Agent Active</p>
            <p className="text-3xl font-bold mt-1 text-green-600">{enabledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Agent Paused</p>
            <p className="text-3xl font-bold mt-1 text-muted-foreground">{disabledCount}</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">New Channel</CardTitle>
            <CardDescription>Add a Teams channel or group for the agent to monitor.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Display Name <span className="text-destructive">*</span></label>
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Engineering Team"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Channel ID <span className="text-destructive">*</span></label>
                  <Input
                    value={newChannelId}
                    onChange={e => setNewChannelId(e.target.value)}
                    placeholder="e.g. engineering-general"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Used to match incoming messages to this channel.</p>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Channel"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="h-20 pt-5 animate-pulse bg-muted/30 rounded-lg" /></Card>
          ))}
        </div>
      )}

      {!isLoading && channels.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Hash className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No channels configured</p>
            <p className="text-sm mt-1">Add a channel above or send a message via the Simulator — channels are created automatically.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && channels.length > 0 && (
        <div className="space-y-3">
          {channels.map(channel => (
            <Card key={channel.id} className={`transition-opacity ${channel.agent_enabled ? "" : "opacity-70"}`}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${channel.agent_enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {channel.agent_enabled ? <Bot className="h-5 w-5" /> : <BotOff className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{channel.name}</span>
                      <Badge variant="outline" className="text-xs font-mono">{channel.channel_id}</Badge>
                      {channel.agent_enabled
                        ? <Badge className="text-xs bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Agent ON</Badge>
                        : <Badge variant="secondary" className="text-xs">Agent OFF</Badge>
                      }
                    </div>
                    {channel.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{channel.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {channel.message_count} {channel.message_count === 1 ? "message" : "messages"} processed
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {channel.agent_enabled ? "On" : "Off"}
                      </span>
                      <Switch
                        checked={channel.agent_enabled}
                        onCheckedChange={checked =>
                          toggleMutation.mutate({ id: channel.id, enabled: checked })
                        }
                        disabled={toggleMutation.isPending}
                        aria-label={`Toggle agent for ${channel.name}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(channel.id)}
                      disabled={deleteMutation.isPending}
                      aria-label="Delete channel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
