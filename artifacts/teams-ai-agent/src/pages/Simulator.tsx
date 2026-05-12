import React, { useState } from "react";
import { useListEmployees, useSimulateTeamsMessage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function Simulator() {
  const { data: employees, isLoading: employeesLoading } = useListEmployees();
  const simulateMutation = useSimulateTeamsMessage();

  const [senderId, setSenderId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderId || !message) return;
    
    simulateMutation.mutate({
      data: {
        sender_id: Number(senderId),
        message: message,
        channel: "General"
      }
    }, {
      onSuccess: (data) => {
        setResult(data);
        setIsOpen(false);
      }
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
            <CardDescription>Select an employee and enter the message text.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    result.action_taken === "leave_recorded" ? "default" :
                    result.action_taken === "clarification_requested" ? "secondary" :
                    result.action_taken === "unauthorized_poster" ? "destructive" : "outline"
                  }>
                    {result.action_taken}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
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
