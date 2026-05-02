import { Link } from "wouter";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClientJobList } from "./client-job-list";

export default function ClientJobsPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">My Jobs</h1>
          <p className="text-sm text-muted-foreground">Manage your job postings</p>
        </div>
        <Link href="/client/jobs/new" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </div>

      <ClientJobList />
    </main>
  );
}
