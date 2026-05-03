import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";

import LoginPage from "@/app/login/page";
import VerifyPage from "@/app/login/verify/page";
import RolePage from "@/app/onboarding/role/page";
import ClientOnboardingPage from "@/app/onboarding/client/page";
import WorkerOnboardingPage from "@/app/onboarding/worker/page";

import ClientPage from "@/app/client/page";
import ClientJobsPage from "@/app/client/jobs/page";
import NewJobPage from "@/app/client/jobs/new/page";
import ClientJobDetailPage from "@/app/client/jobs/[id]/page";
import ClientMilestonesPage from "@/app/client/jobs/[id]/milestones/page";
import ClientWalletPage from "@/app/client/wallet/page";

import WorkerPage from "@/app/worker/page";
import WorkerFeedPage from "@/app/worker/feed/page";
import WorkerApplicationsPage from "@/app/worker/applications/page";
import WorkerJobDetailPage from "@/app/worker/jobs/[id]/page";
import WorkerMilestonesPage from "@/app/worker/jobs/[id]/milestones/page";
import WorkerWalletPage from "@/app/worker/wallet/page";
import WorkerKycPendingPage from "@/app/worker/kyc-pending/page";

import AdminPage from "@/app/admin/page";
import NotFound from "@/pages/not-found";
import { BottomNav } from "@/components/BottomNav";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PUBLIC_PATHS = ["/", "/login", "/login/verify"];
const ONBOARDING_PATHS = ["/onboarding/role", "/onboarding/client", "/onboarding/worker"];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [authState, setAuthState] = useState<"loading" | "authed" | "anon">("loading");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setAuthState(data.session ? "authed" : "anon");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? "authed" : "anon");
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authState === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isPublic = PUBLIC_PATHS.includes(location) || ONBOARDING_PATHS.includes(location);

  if (authState === "anon" && !isPublic) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-4xl font-bold text-primary">Pakka</h1>
        <p className="mt-2 text-muted-foreground">
          India's trusted escrow marketplace for skilled workers.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <a
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Sign in
        </a>
        <p className="text-xs text-muted-foreground">
          Phone OTP · No password · Secure
        </p>
      </div>
    </main>
  );
}

function homeFromLocation(loc: string): string {
  if (loc.startsWith("/client")) return "/client/jobs";
  if (loc.startsWith("/worker")) return "/worker/feed";
  if (loc.startsWith("/admin")) return "/admin";
  return "/login";
}

function AppHeader() {
  const [location, navigate] = useLocation();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthed(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    navigate("/login");
  };

  const isHidden = ["/login", "/login/verify", "/onboarding/role", "/onboarding/client", "/onboarding/worker"].includes(location);

  if (isHidden) return null;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[640px] items-center justify-between px-4">
        <button
          onClick={() => navigate(homeFromLocation(location))}
          className="text-lg font-bold text-primary"
        >
          Pakka
        </button>
        {isAuthed && (
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}

function Router() {
  return (
    <AuthGuard>
      <AppHeader />
      <div className="pb-16">
      <Switch>
        <Route path="/" component={LandingPage} />

        <Route path="/login" component={LoginPage} />
        <Route path="/login/verify" component={VerifyPage} />

        <Route path="/onboarding/role" component={RolePage} />
        <Route path="/onboarding/client" component={ClientOnboardingPage} />
        <Route path="/onboarding/worker" component={WorkerOnboardingPage} />

        <Route path="/client" component={ClientPage} />
        <Route path="/client/jobs" component={ClientJobsPage} />
        <Route path="/client/jobs/new" component={NewJobPage} />
        <Route path="/client/jobs/:id/milestones" component={ClientMilestonesPage} />
        <Route path="/client/jobs/:id/fund">
          {(params) => <Redirect to={`/client/jobs/${params.id}/milestones`} />}
        </Route>
        <Route path="/client/jobs/:id" component={ClientJobDetailPage} />
        <Route path="/client/wallet" component={ClientWalletPage} />

        <Route path="/worker" component={WorkerPage} />
        <Route path="/worker/feed" component={WorkerFeedPage} />
        <Route path="/worker/applications" component={WorkerApplicationsPage} />
        <Route path="/worker/jobs/:id/milestones" component={WorkerMilestonesPage} />
        <Route path="/worker/jobs/:id" component={WorkerJobDetailPage} />
        {/* ADR-0036: /worker/jobs (no :id) was a 404 — redirect to Applications tab */}
        <Route path="/worker/jobs">
          {() => <Redirect to="/worker/applications" />}
        </Route>
        <Route path="/worker/wallet" component={WorkerWalletPage} />
        <Route path="/worker/kyc-pending" component={WorkerKycPendingPage} />

        <Route path="/admin" component={AdminPage} />

        <Route component={NotFound} />
      </Switch>
      </div>
      <BottomNav />
    </AuthGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster richColors closeButton position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
