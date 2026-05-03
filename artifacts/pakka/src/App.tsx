import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import Login from "@/pages/login";
import VerifyOtp from "@/pages/verify-otp";
import OnboardingRole from "@/pages/onboarding/role";
import ClientOnboarding from "@/pages/onboarding/client";
import WorkerOnboarding from "@/pages/onboarding/worker";
import ClientJobs from "@/pages/client/jobs";
import ClientJobDetail from "@/pages/client/job-detail";
import ClientMilestones from "@/pages/client/milestones";
import NewJob from "@/pages/client/new-job";
import ClientWallet from "@/pages/client/wallet";
import WorkerFeed from "@/pages/worker/feed";
import WorkerJobDetail from "@/pages/worker/job-detail";
import WorkerMilestones from "@/pages/worker/milestones";
import WorkerApplications from "@/pages/worker/applications";
import WorkerWallet from "@/pages/worker/wallet";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/login" />} />

      <Route path="/login" component={Login} />
      <Route path="/verify-otp" component={VerifyOtp} />

      <Route path="/onboarding/role" component={OnboardingRole} />
      <Route path="/onboarding/client" component={ClientOnboarding} />
      <Route path="/onboarding/worker" component={WorkerOnboarding} />

      <Route path="/client/jobs/new" component={NewJob} />
      <Route path="/client/jobs/:id/milestones" component={ClientMilestones} />
      <Route path="/client/jobs/:id" component={ClientJobDetail} />
      <Route path="/client/jobs" component={ClientJobs} />
      <Route path="/client/wallet" component={ClientWallet} />

      <Route path="/worker/feed" component={WorkerFeed} />
      <Route path="/worker/jobs/:id/milestones" component={WorkerMilestones} />
      <Route path="/worker/jobs/:id" component={WorkerJobDetail} />
      <Route path="/worker/applications" component={WorkerApplications} />
      <Route path="/worker/wallet" component={WorkerWallet} />

      <Route path="/admin" component={Admin} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster position="top-center" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
