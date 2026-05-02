import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, AlertCircle, Clock, CheckCircle2, Ticket, AlertTriangle, Activity } from "lucide-react";

export function KPICards() {
  const { data, isLoading, isFetching } = useGetDashboardStats();
  const loading = isLoading || isFetching;

  const kpis = [
    { title: "Total Tickets", value: data?.total_tickets, icon: Ticket, color: "#0079F2" },
    { title: "Open", value: data?.open_tickets, icon: AlertCircle, color: "#0079F2" },
    { title: "In Progress", value: data?.in_progress_tickets, icon: Activity, color: "#0079F2" },
    { title: "High Priority", value: data?.high_priority_open, icon: AlertTriangle, color: "#A60808" },
    { title: "Resolved Today", value: data?.resolved_today, icon: CheckCircle2, color: "#009118" },
    { title: "Avg Resolution", value: data?.avg_resolution_hours != null ? `${data.avg_resolution_hours.toFixed(1)}h` : null, icon: Clock, color: "#0079F2" },
    { title: "Messages Today", value: data?.messages_processed_today, icon: MessageSquare, color: "#0079F2" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {kpis.map((kpi, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1 line-clamp-1" title={kpi.title}>{kpi.title}</p>
                {loading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold" style={{ color: kpi.color }}>
                    {kpi.value ?? "--"}
                  </p>
                )}
              </div>
              <div className="p-2 bg-muted/50 rounded-md">
                <kpi.icon className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
