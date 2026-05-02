import { Link } from "wouter";
import { Search, FileText, ArrowRight, Wallet } from "lucide-react";

export default function WorkerPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Worker Dashboard</h1>
        <p className="text-sm text-muted-foreground">Find jobs, apply, get paid.</p>
      </div>

      <div className="grid gap-3">
        <Link
          href="/worker/feed"
          className="flex items-center justify-between rounded-xl border bg-card px-5 py-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
              <Search className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold">Browse Jobs</p>
              <p className="text-xs text-muted-foreground">Explore open job listings</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link
          href="/worker/applications"
          className="flex items-center justify-between rounded-xl border bg-card px-5 py-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">My Applications</p>
              <p className="text-xs text-muted-foreground">Track application status</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link
          href="/worker/wallet"
          className="flex items-center justify-between rounded-xl border bg-card px-5 py-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <Wallet className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="font-semibold">Wallet</p>
              <p className="text-xs text-muted-foreground">Earnings & transactions</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      </div>
    </main>
  );
}
