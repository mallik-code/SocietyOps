import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AppLayout } from "@/components/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { Simulator } from "@/pages/Simulator";
import { LeaveRecords } from "@/pages/LeaveRecords";
import { EmployeeDirectory } from "@/pages/EmployeeDirectory";
import { Settings } from "@/pages/Settings";
import { Reports } from "@/pages/Reports";
import { Channels } from "@/pages/Channels";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/simulator" component={Simulator} />
        <Route path="/leave" component={LeaveRecords} />
        <Route path="/employees" component={EmployeeDirectory} />
        <Route path="/channels" component={Channels} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
