import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dashboard } from "@/components/Dashboard";
import { PoliciesPage } from "@/components/PoliciesPage";
import { ConnectPage } from "@/components/ConnectPage";
import { PromptPage } from "@/components/PromptPage";
import NotFound from "@/pages/not-found";
import { LayoutDashboard, ShieldCheck, Sun, Moon, Wifi, WifiOff, PlugZap, Sparkles } from "lucide-react";
import { useGetWhatsappStatus } from "@workspace/api-client-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function NavBar({ isDark, onToggleDark }: { isDark: boolean; onToggleDark: () => void }) {
  const [location] = useLocation();
  const { data: wa } = useGetWhatsappStatus();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm print:hidden">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">ComplaintOps</span>
        </div>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              location === "/"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/policies"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              location === "/policies"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Policies
          </Link>
          <Link
            href="/connect"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              location === "/connect"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <PlugZap className="w-4 h-4" />
            Connect
          </Link>
          <Link
            href="/ai"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              location === "/ai"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI Assistant
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {wa && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                wa.connected
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {wa.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {wa.connected ? `${wa.instance} · ${wa.state}` : "Disconnected"}
            </div>
          )}
          <button
            onClick={onToggleDark}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function AppShell() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggleDark = () => setIsDark((d) => !d);

  return (
    <div className="min-h-screen bg-background">
      <NavBar isDark={isDark} onToggleDark={toggleDark} />
      <Switch>
        <Route path="/">
          <Dashboard isDark={isDark} />
        </Route>
        <Route path="/policies">
          <PoliciesPage isDark={isDark} onToggleDark={toggleDark} />
        </Route>
        <Route path="/connect">
          <ConnectPage isDark={isDark} />
        </Route>
        <Route path="/ai">
          <PromptPage isDark={isDark} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppShell />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
