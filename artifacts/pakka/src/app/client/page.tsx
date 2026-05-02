import { Link } from "wouter";
import { Briefcase, Plus, ArrowRight, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ClientPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Client Dashboard</h1>
        <p className="text-sm text-muted-foreground">Post jobs, manage milestones, pay workers.</p>
      </div>

      <div className="grid gap-3">
        <Link
          href="/client/jobs"
          className="flex items-center justify-between rounded-xl border bg-card px-5 py-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">My Jobs</p>
              <p className="text-xs text-muted-foreground">View and manage posted jobs</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link
          href="/client/wallet"
          className="flex items-center justify-between rounded-xl border bg-card px-5 py-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <Wallet className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="font-semibold">Wallet</p>
              <p className="text-xs text-muted-foreground">Balances, escrow & transactions</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      </div>

      <Link href="/client/jobs/new" className={cn(buttonVariants(), "w-full gap-2")}>
        <Plus className="h-4 w-4" />
        Post a New Job
      </Link>
    </main>
  );
}
