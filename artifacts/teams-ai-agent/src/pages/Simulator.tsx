import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListEmployees, useSimulateTeamsMessage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown, BotOff, Hash } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Channel {
  id: number;
  name: string;
  channel_id: string;
  agent_enabled: boolean;
}

async function fetchChannels(): Promise<Channel[]> {
  const res = await fetch("/api/teams/channels");
  if (!res.ok) return [];
  return res.json();
}

export function Simulator() {
  const { data: employees, isLoading: employeesLoading } = useListEmployees();
  const simulateMutation = useSimulateTeamsMessage();

  const { data: channels = [] } = useQuery({
    queryKey: ["teams-channels"],
    queryFn: fetchChannels,
    staleTime: 15_000,
  });

  const [senderId, setSenderId]     = useState<string>("");
  const [message, setMessage]       = useState<string>("");
  const [channelId, setChannelId]   = useState<string>("General");
  const [result, setResult]         = useState<any>(null);
  const [isOpen, setIsOpen]         = useState(false);

  const selectedChannel = channels.find(c => c.channel_id === channelId);
  const agentDisabledWarning = selectedChannel && !selectedChannel.agent_enabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderId || !message) return;
    simulateMutation.mutate({
      data: { sender_id: Number(senderId), message, channel: channelId || "General" }
    }, {
      onSuccess: (data) => { setResult(data); setIsOpen(false); }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Message Simulator</h2>
        <p className="text-muted-foreground mt-1">Test the AI agent by simulating Microsoft Teams messages.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Compose Message</CardTitle>
            <CardDescription>Select a channel, sender and enter the message text.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  Channel
                </label>
                <div className="flex gap-2">
                  <Select value={channelId} onValueChange={setChannelId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select or type channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map(c => (
                        <SelectItem key={c.channel_id} value={c.channel_id}>
                          <span className="flex items-center gap-2">
                            {c.name}
                            {!c.agent_enabled && (
                              <Badge variant="secondary" className="text-xs ml-1">Agent OFF</Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                      {channels.length === 0 && (
                        <SelectItem value="General">General</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {agentDisabledWarning && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <BotOff className="h-3.5 w-3.5" />
                    AI agent is OFF for this channel — message will be logged but not processed.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sender</label>
                <Select value={senderId} onValueChange={setSenderId}>
                  <SelectTrigger>
                    <SelectValue placeholder={employeesLoading ? "Loading..." : "Select sender"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.full_name} ({emp.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message Text</label>
                <Textarea
                  placeholder="e.g. I am taking tomorrow off for sick leave..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[150px] font-mono text-sm"
                />
              </div>

              <Button type="submit" disabled={!senderId || !message || simulateMutation.isPending} className="w-full">
                {simulateMutation.isPending ? "Processing..." : "Simulate Message"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <Card className="border-primary/50">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-lg flex items-center justify-between">
                  Analysis Result
                  <Badge variant={
                    result.action_taken === "leave_recorded"           ? "default"     :
                    result.action_taken === "clarification_requested"  ? "secondary"   :
                    result.action_taken === "unauthorized_poster"      ? "destructive" :
                    result.action_taken === "agent_disabled"           ? "outline"     : "outline"
                  }>
                    {result.action_taken}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">

                {result.action_taken === "agent_disabled" && (
                  <Alert className="bg-muted border-border">
                    <BotOff className="h-4 w-4" />
                    <AlertTitle>Agent Disabled</AlertTitle>
                    <AlertDescription>
                      The AI agent is turned OFF for the <strong>{result.channel}</strong> channel. Message was logged but not analysed.
                      Enable it from the <strong>Channels</strong> page.
                    </AlertDescription>
                  </Alert>
                )}

                {result.action_taken === "clarification_requested" && result.clarification_question && (
                  <Alert variant="default" className="bg-secondary text-secondary-foreground border-border">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Clarification Needed</AlertTitle>
                    <AlertDescription>{result.clarification_question}</AlertDescription>
                  </Alert>
                )}

                {result.action_taken === "leave_recorded" && (
                  <Alert className="bg-primary/10 text-primary border-primary/20">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Leave Recorded</AlertTitle>
                    <AlertDescription>
                      Successfully recorded {result.agent_output.leave_type} for {result.agent_output.employee.name_extracted} on {result.agent_output.leave_date}.
                    </AlertDescription>
                  </Alert>
                )}

                {result.action_taken === "holiday_conflict" && (
                  <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Holiday Conflict</AlertTitle>
                    <AlertDescription>The requested date falls on a company holiday.</AlertDescription>
                  </Alert>
                )}

                {result.action_taken === "unauthorized_poster" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Unauthorized</AlertTitle>
                    <AlertDescription>The sender is not authorized to request leave for this employee.</AlertDescription>
                  </Alert>
                )}

                {result.action_taken !== "agent_disabled" && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Intent:</span>
                      <p className="font-medium">{result.intent}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Confidence:</span>
                      <p className="font-medium">{(result.confidence * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                )}

                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-6">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full flex items-center justify-between">
                      View Raw JSON Output
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(result.agent_output, null, 2)}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
