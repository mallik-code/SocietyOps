import React from "react";
import { useGetLeaveStats, useListMessageLog, useListLeaveRecords } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetLeaveStats();
  const { data: messages, isLoading: messagesLoading } = useListMessageLog();
  const { data: leaves, isLoading: leavesLoading } = useListLeaveRecords();

  if (statsLoading || messagesLoading || leavesLoading) {
    return <div className="text-muted-foreground animate-pulse">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Real-time stats and recent AI operations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leaves This Month</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_leaves_this_month || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leaves Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_leaves_today || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending_approvals || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.messages_processed_today || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Messages Processed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {messages?.slice(0, 5).map((msg) => (
              <div key={msg.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card/50">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{msg.sender_name}</p>
                  <p className="text-sm text-muted-foreground line-clamp-1">{msg.message_text}</p>
                </div>
                <Badge variant={msg.action_taken === "leave_recorded" ? "default" : "secondary"}>
                  {msg.action_taken}
                </Badge>
              </div>
            ))}
            {(!messages || messages.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No messages processed recently.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Leave Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {leaves?.filter(l => new Date(l.leave_date).toDateString() === new Date().toDateString()).slice(0, 5).map((leave) => (
              <div key={leave.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card/50">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{leave.employee_name}</p>
                  <p className="text-sm text-muted-foreground">{leave.leave_type}</p>
                </div>
                <Badge variant={leave.status === "approved" ? "default" : leave.status === "rejected" ? "destructive" : "outline"}>
                  {leave.status}
                </Badge>
              </div>
            ))}
            {(!leaves || leaves.filter(l => new Date(l.leave_date).toDateString() === new Date().toDateString()).length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No leave activity today.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
