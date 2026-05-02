import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KPICards } from "./dashboard/KPICards";
import { Charts } from "./dashboard/Charts";
import { RecentActivity } from "./dashboard/RecentActivity";
import { TicketsTable } from "./dashboard/TicketsTable";
import { Printer, RefreshCw, ChevronDown, Check } from "lucide-react";

const INTERVAL_OPTIONS = [
  { label: "Off", ms: 0 },
  { label: "Every 15s", ms: 15 * 1000 },
  { label: "Every 30s", ms: 30 * 1000 },
  { label: "Every 1 min", ms: 60 * 1000 },
];

interface DashboardProps {
  isDark: boolean;
}

export function Dashboard({ isDark }: DashboardProps) {
  const queryClient = useQueryClient();
  const [isSpinning, setIsSpinning] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIntervalMs, setSelectedIntervalMs] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <div className="bg-background px-6 pt-8 pb-10">
      <div className="max-w-[1400px] mx-auto">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
          <div>
            <h1 className="font-bold text-[28px] leading-none text-foreground">Complaint Operations</h1>
            <p className="text-muted-foreground mt-2 text-sm">Residential Building WhatsApp Gateway Overview</p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {/* Split refresh */}
            <div
              className="relative flex items-center rounded-[6px] overflow-visible h-[30px] text-[12px] border border-border"
              style={{ color: isDark ? "#c8c9cc" : "#4b5563" }}
              ref={dropdownRef}
            >
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-3 h-full hover:bg-muted transition-colors rounded-l-[6px]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <div className="w-px h-4 shrink-0 bg-border" />
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center justify-center px-1.5 h-full hover:bg-muted transition-colors rounded-r-[6px]"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {dropdownOpen && (
                <div className="absolute top-[34px] right-0 w-40 bg-popover text-popover-foreground border border-border rounded-md overflow-hidden py-1 z-50">
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

            {/* PDF export */}
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center w-[30px] h-[30px] rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Export as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-6">
          <KPICards />
        </div>

        {/* Charts + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <Charts isDark={isDark} />
          </div>
          <div className="lg:col-span-1">
            <RecentActivity />
          </div>
        </div>

        {/* Tickets table */}
        <div className="mb-6">
          <TicketsTable />
        </div>
      </div>
    </div>
  );
}
