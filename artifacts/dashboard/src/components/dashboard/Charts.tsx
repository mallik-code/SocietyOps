import { 
  useGetCategoryBreakdown, 
  useGetPriorityBreakdown, 
  useGetStatusBreakdown, 
  useGetDailyTrend 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CSVLink } from "react-csv";
import { Download } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

const CHART_COLORS = {
  blue: "#0079F2",
  purple: "#795EFF",
  green: "#009118",
  red: "#A60808",
  pink: "#ec4899",
  orange: "#f59e0b",
  slate: "#64748b",
  amber: "#f59e0b",
  gray: "#6b7280"
};

const CHART_COLOR_LIST = [
  CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.green, CHART_COLORS.red, CHART_COLORS.pink,
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "6px", padding: "10px 14px", border: "1px solid #e0e0e0", color: "#1a1a1a", fontSize: "13px" }}>
      <div style={{ marginBottom: "6px", fontWeight: 500 }}>{label}</div>
      {payload.map((entry: any, index: number) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", backgroundColor: entry.color || entry.payload.fill, flexShrink: 0 }} />
          <span style={{ color: "#444" }}>{entry.name}</span>
          <span style={{ marginLeft: "auto", fontWeight: 600 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ payload }: any) {
  if (!payload || payload.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 16px", fontSize: "13px", marginTop: "10px" }}>
      {payload.map((entry: any, index: number) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", backgroundColor: entry.color, flexShrink: 0 }} />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

export function Charts({ isDark }: { isDark: boolean }) {
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  const { data: trendData, isLoading: loadingTrend, isFetching: fetchingTrend } = useGetDailyTrend();
  const { data: categoryData, isLoading: loadingCat, isFetching: fetchingCat } = useGetCategoryBreakdown();
  const { data: priorityData, isLoading: loadingPri, isFetching: fetchingPri } = useGetPriorityBreakdown();
  const { data: statusData, isLoading: loadingStat, isFetching: fetchingStat } = useGetStatusBreakdown();

  const isTrendLoading = loadingTrend || fetchingTrend;
  const isCatLoading = loadingCat || fetchingCat;
  const isPriLoading = loadingPri || fetchingPri;
  const isStatLoading = loadingStat || fetchingStat;

  // Format trend data dates
  const formattedTrendData = trendData?.map(d => ({
    ...d,
    dateLabel: d.date ? format(parseLocalDate(d.date), "MMM d") : ""
  })) || [];

  // Sort priority data to ensure consistent colors
  const sortedPriorityData = [...(priorityData || [])].sort((a, b) => b.count - a.count);
  const getPriorityColor = (priority: string) => {
    const p = priority.toLowerCase();
    if (p.includes('high')) return CHART_COLORS.red;
    if (p.includes('med')) return CHART_COLORS.amber;
    if (p.includes('low')) return CHART_COLORS.slate;
    return CHART_COLORS.blue;
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('open')) return CHART_COLORS.blue;
    if (s.includes('progress')) return CHART_COLORS.amber;
    if (s.includes('resolv')) return CHART_COLORS.green;
    if (s.includes('delay')) return CHART_COLORS.orange;
    if (s.includes('clos')) return CHART_COLORS.gray;
    return CHART_COLORS.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Daily Trend */}
      <Card className="md:col-span-2">
        <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Daily Ticket Volume (Last 14 Days)</CardTitle>
          {!isTrendLoading && formattedTrendData.length > 0 && (
            <CSVLink data={formattedTrendData} filename="daily-trend.csv" className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }} aria-label="Export chart data as CSV">
              <Download className="w-3.5 h-3.5" />
            </CSVLink>
          )}
        </CardHeader>
        <CardContent className="px-2 pb-5">
          {isTrendLoading ? <Skeleton className="w-full h-[280px] mx-4" /> : (
            <ResponsiveContainer width="100%" height={280} debounce={0}>
              <AreaChart data={formattedTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ fill: 'rgba(0,0,0,0.05)', stroke: 'none' }} />
                <Area type="monotone" dataKey="count" name="Tickets" fill="url(#gradientTrend)" stroke={CHART_COLORS.blue} fillOpacity={1} strokeWidth={2} activeDot={{ r: 5, fill: CHART_COLORS.blue, stroke: '#ffffff', strokeWidth: 3 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Tickets by Category</CardTitle>
          {!isCatLoading && (categoryData?.length ?? 0) > 0 && (
            <CSVLink data={categoryData || []} filename="category-breakdown.csv" className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }} aria-label="Export chart data as CSV">
              <Download className="w-3.5 h-3.5" />
            </CSVLink>
          )}
        </CardHeader>
        <CardContent className="px-2 pb-5">
          {isCatLoading ? <Skeleton className="w-full h-[240px] mx-4" /> : (
            <ResponsiveContainer width="100%" height={240} debounce={0}>
              <BarChart data={categoryData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} axisLine={false} tickLine={false} />
                <YAxis dataKey="category" type="category" width={90} tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} isAnimationActive={false} cursor={false} />
                <Bar dataKey="count" name="Tickets" fill={CHART_COLORS.blue} fillOpacity={0.8} activeBar={{ fillOpacity: 1 }} radius={[0, 2, 2, 0]} isAnimationActive={false} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Priority Breakdown */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Tickets by Priority</CardTitle>
          {!isPriLoading && (priorityData?.length ?? 0) > 0 && (
            <CSVLink data={priorityData || []} filename="priority-breakdown.csv" className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }} aria-label="Export chart data as CSV">
              <Download className="w-3.5 h-3.5" />
            </CSVLink>
          )}
        </CardHeader>
        <CardContent className="pb-5">
          {isPriLoading ? <Skeleton className="w-full h-[240px]" /> : (
            <ResponsiveContainer width="100%" height={240} debounce={0}>
              <PieChart>
                <Pie data={sortedPriorityData} dataKey="count" nameKey="priority" cx="50%" cy="45%" innerRadius={60} outerRadius={85} cornerRadius={2} paddingAngle={2} isAnimationActive={false} stroke="none">
                  {sortedPriorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getPriorityColor(entry.priority)} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card className="md:col-span-2">
        <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Current Status Distribution</CardTitle>
          {!isStatLoading && (statusData?.length ?? 0) > 0 && (
            <CSVLink data={statusData || []} filename="status-breakdown.csv" className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }} aria-label="Export chart data as CSV">
              <Download className="w-3.5 h-3.5" />
            </CSVLink>
          )}
        </CardHeader>
        <CardContent className="px-2 pb-5">
          {isStatLoading ? <Skeleton className="w-full h-[240px] mx-4" /> : (
            <ResponsiveContainer width="100%" height={240} debounce={0}>
              <BarChart data={statusData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip content={<CustomTooltip />} isAnimationActive={false} cursor={false} />
                <Bar dataKey="count" name="Tickets" radius={[4, 4, 0, 0]} isAnimationActive={false} barSize={40}>
                  {(statusData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
