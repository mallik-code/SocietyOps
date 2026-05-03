import { useState, useMemo } from "react";
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getFilteredRowModel, 
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useListTickets, useUpdateTicketStatus } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";

export function TicketsTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const { data, isLoading, isFetching } = useListTickets({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    category: categoryFilter || undefined,
  });

  const loading = isLoading || isFetching;
  const updateStatus = useUpdateTicketStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStatusUpdate = (id: number, newStatus: any) => {
    updateStatus.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({ title: "Status updated successfully" });
          queryClient.invalidateQueries();
        },
        onError: (err: any) => {
          toast({ title: "Failed to update status", variant: "destructive" });
        }
      }
    );
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">#{row.original.id}</span>,
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => <span className="whitespace-nowrap">{format(new Date(row.original.created_at), "MMM d, yyyy")}</span>,
    },
    {
      accessorKey: "reporter_name",
      header: "Reporter",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.reporter_name || "Unknown"}</div>
          {row.original.location && <div className="text-xs text-muted-foreground">{row.original.location}</div>}
        </div>
      ),
    },
    {
      accessorKey: "message_text",
      header: "Description",
      cell: ({ row }) => <div className="max-w-[300px] truncate" title={row.original.message_text}>{row.original.message_text}</div>,
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <span className="px-2 py-1 bg-muted rounded text-xs">{row.original.category}</span>,
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        const p = row.original.priority?.toLowerCase() || '';
        let classes = "bg-muted text-muted-foreground";
        if (p === 'high') classes = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
        else if (p === 'medium') classes = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
        else if (p === 'low') classes = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
        
        return <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${classes}`}>{row.original.priority}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status?.toLowerCase() || '';
        let classes = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"; // open
        if (s === 'in_progress') classes = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
        else if (s === 'resolved') classes = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
        else if (s === 'delayed') classes = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
        else if (s === 'closed') classes = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
        
        return (
          <Select 
            value={s} 
            onValueChange={(val) => handleStatusUpdate(row.original.id, val)}
            disabled={updateStatus.isPending}
          >
            <SelectTrigger className={`h-8 border-0 ${classes}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="delayed">Delayed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: "confidence",
      header: "AI Conf.",
      cell: ({ row }) => {
        const conf = parseFloat(row.original.confidence || "0");
        if (!conf) return <span className="text-muted-foreground text-xs">—</span>;
        
        let colorClass = "text-muted-foreground";
        if (conf >= 0.9) colorClass = "text-emerald-600 dark:text-emerald-400";
        else if (conf >= 0.7) colorClass = "text-amber-600 dark:text-amber-400";
        else colorClass = "text-rose-600 dark:text-rose-400";

        return (
          <div className="flex flex-col gap-1">
            <div className={`text-xs font-bold ${colorClass}`}>
              {(conf * 100).toFixed(0)}%
            </div>
            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${conf >= 0.9 ? 'bg-emerald-500' : conf >= 0.7 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                style={{ width: `${conf * 100}%` }} 
              />
            </div>
          </div>
        );
      },
    },
  ], [updateStatus.isPending]);

  const table = useReactTable({
    data: data || [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <Card>
      <CardHeader className="px-5 pt-5 pb-4">
        <CardTitle className="text-lg">All Tickets</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between items-start sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_statuses">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[130px] h-9">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_priorities">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead 
                          key={header.id} 
                          onClick={header.column.getToggleSortingHandler()} 
                          className={`cursor-pointer select-none h-10 ${header.column.getCanSort() ? "hover:bg-muted/80" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        No tickets found matching the criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "}
                of {table.getFilteredRowModel().rows.length} results
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
