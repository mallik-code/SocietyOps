import { useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Ticket, Activity, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export function RecentActivity() {
  const { data, isLoading, isFetching } = useGetRecentActivity();
  const loading = isLoading || isFetching;

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "resolved":
      case "closed": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "in_progress": return <Activity className="w-4 h-4 text-amber-500" />;
      case "delayed": return <Clock className="w-4 h-4 text-orange-500" />;
      default: return <AlertCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-5">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
            <Ticket className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((item, i) => (
              <div key={i} className="relative flex gap-4">
                {i !== data.length - 1 && (
                  <div className="absolute top-8 left-4 w-px h-[calc(100%-1rem)] bg-border" />
                )}
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 z-10">
                  {getStatusIcon(item.status)}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">Ticket #{item.ticket_id}</p>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {item.timestamp ? format(new Date(item.timestamp), "MMM d, h:mm a") : ""}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-muted rounded">
                      {item.category}
                    </span>
                    {item.priority === 'high' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded">
                        High Priority
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
