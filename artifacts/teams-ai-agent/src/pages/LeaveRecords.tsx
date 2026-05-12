import React from "react";
import { useListLeaveRecords, useUpdateLeaveRecord } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";

export function LeaveRecords() {
  const { data: leaves, isLoading, refetch } = useListLeaveRecords();
  const updateMutation = useUpdateLeaveRecord();
  const { toast } = useToast();

  const handleStatusChange = (id: number, status: string) => {
    updateMutation.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: "Status updated", description: `Leave record marked as ${status}.` });
        refetch();
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Failed to update record." });
      }
    });
  };

  if (isLoading) return <div className="animate-pulse">Loading leave records...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Leave Records</h2>
        <p className="text-muted-foreground mt-1">Audit log of all detected and manually entered leaves.</p>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves?.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.employee_name}</TableCell>
                <TableCell className="text-muted-foreground">{record.department}</TableCell>
                <TableCell>{new Date(record.leave_date).toLocaleDateString()}</TableCell>
                <TableCell className="capitalize">{record.leave_type.replace('_', ' ')}</TableCell>
                <TableCell>
                  <Badge variant={record.status === "approved" ? "default" : record.status === "rejected" ? "destructive" : "outline"}>
                    {record.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {record.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950" onClick={() => handleStatusChange(record.id, "approved")} disabled={updateMutation.isPending}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => handleStatusChange(record.id, "rejected")} disabled={updateMutation.isPending}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!leaves || leaves.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No leave records found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
