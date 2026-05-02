import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetWhatsappStatus } from "@workspace/api-client-react";
import { KPICards } from "./dashboard/KPICards";
import { Charts } from "./dashboard/Charts";
import { RecentActivity } from "./dashboard/RecentActivity";
import { TicketsTable } from "./dashboard/TicketsTable";
import { Printer, Sun, Moon, RefreshCw, ChevronDown, Check, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const INTERVAL_OPTIONS = [
  { label: "Off", ms: 0 },
  { label: "Every 15s", ms: 15 * 1000 },
  { label: "Every 30s", ms: 30 * 1000 },
  { label: "Every 1 min", ms: 60 * 1000 },
];

export function Dashboard() {
  const queryClient = useQueryClient();
  const [isDark, setIsDark] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIntervalMs, setSelectedIntervalMs] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: whatsappStatus, isFetching: waFetching } = useGetWhatsappStatus();

  // Handle dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Handle click outside for dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle auto-refresh
  useEffect(() => {
    if (selectedIntervalMs > 0) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries();
      }, selectedIntervalMs);
      return () => clearInterval(interval);
    }
  }, [selectedIntervalMs, queryClient]);

  const handleRefresh = () => {
    setIsSpinning(true);
    queryClient.invalidateQueries().finally(() => {
      setTimeout(() => setIsSpinning(false), 600);
    });
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background px-5 py-4 pt-[32px] pb-[32px] pl-[24px] pr-[24px]">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-bold text-[32px] leading-none">Complaint Operations</h1>
              {whatsappStatus && (
                <Badge 
                  variant={whatsappStatus.connected ? "default" : "destructive"}
                  className={`mt-1 gap-1 text-[12px] h-[24px] ${whatsappStatus.connected ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100" : ""}`}
                >
                  {whatsappStatus.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {whatsappStatus.instance} ({whatsappStatus.state})
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1.5 text-[14px]">Residential Building WhatsApp Gateway Operations</p>
          </div>

          <div className="flex items-center gap-3 pt-2 print:hidden">
            <div
              className="relative flex items-center rounded-[6px] overflow-hidden h-[26px] text-[12px] z-50"
              style={{
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2",
                color: isDark ? "#c8c9cc" : "#4b5563",
              }}
              ref={dropdownRef}
            >
              <button 
                onClick={handleRefresh} 
                className="flex items-center gap-1 px-2 h-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <div className="w-px h-4 shrink-0" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" }} />
              <button 
                onClick={() => setDropdownOpen((o) => !o)} 
                className="flex items-center justify-center px-1.5 h-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              
              {dropdownOpen && (
                <div className="absolute top-[30px] right-0 w-36 bg-popover text-popover-foreground border border-border shadow-md rounded-md overflow-hidden py-1">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.ms}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-muted"
                      onClick={() => {
                        setSelectedIntervalMs(opt.ms);
                        setDropdownOpen(false);
                      }}
                    >
                      {opt.label}
                      {selectedIntervalMs === opt.ms && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}
              aria-label="Export as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsDark((d) => !d)}
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-6">
          <KPICards />
        </div>

        {/* Charts & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <Charts isDark={isDark} />
          </div>
          <div className="lg:col-span-1">
            <RecentActivity />
          </div>
        </div>

        {/* Tickets Table */}
        <div className="mb-6">
          <TicketsTable />
        </div>

      </div>
    </div>
  );
}
