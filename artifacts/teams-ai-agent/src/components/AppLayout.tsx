import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, MessageSquare, CalendarClock, Users, Settings, BarChart3 } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Simulator", href: "/simulator", icon: MessageSquare },
    { name: "Leave Records", href: "/leave", icon: CalendarClock },
    { name: "Employees", href: "/employees", icon: Users },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-primary tracking-tight">Teams AI Agent</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Leave Management</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col">
        <header className="h-16 border-b border-border bg-card flex items-center px-6 md:hidden">
          <h1 className="font-bold text-primary">Teams AI Agent</h1>
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
