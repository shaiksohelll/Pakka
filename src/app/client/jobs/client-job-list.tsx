"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Briefcase, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type JobStatus = "open" | "assigned" | "in_progress" | "completed" | "cancelled" | "disputed";

type Job = {
  id: string;
  title: string;
  category: string;
  status: JobStatus;
  total_budget: number;
  created_at: string;
  milestone_count: number;
  application_count: number;
};

const FILTER_TABS: { label: string; value: JobStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Assigned", value: "assigned" },
  { label: "Completed", value: "completed" },
];

export function ClientJobList() {
  const [activeFilter, setActiveFilter] = useState<JobStatus | "all">("all");
  const { user } = useUser();

  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ["client-jobs", user?.id],
    staleTime: 10_000,
    enabled: !!user?.id,
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("jobs")
        .select(`
          id, title, category, status, total_budget, created_at,
          milestones(id),
          job_applications(id)
        `)
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((j) => ({
        id: j.id,
        title: j.title,
        category: j.category,
        status: j.status as JobStatus,
        total_budget: Number(j.total_budget),
        created_at: j.created_at,
        milestone_count: (j.milestones as unknown[]).length,
        application_count: (j.job_applications as unknown[]).length,
      })) satisfies Job[];
    },
  });

  const filtered = activeFilter === "all"
    ? (jobs ?? [])
    : (jobs ?? []).filter((j) => j.status === activeFilter);

  if (isLoading) return <ClientJobListSkeleton />;
  if (error) {
    return (
      <div className="rounded-xl border bg-destructive/5 p-6 text-center text-destructive">
        Failed to load jobs. Please refresh.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTER_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              activeFilter === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {filtered.map((job) => (
            <li key={job.id}>
              <Link
                href={`/client/jobs/${job.id}`}
                className="flex items-start justify-between rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge variant={job.status} />
                    <span className="text-xs text-muted-foreground capitalize">
                      {CATEGORY_LABELS[job.category] ?? job.category}
                    </span>
                  </div>
                  <p className="font-semibold leading-snug text-foreground line-clamp-1">
                    {job.title}
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="font-medium text-primary">
                      {formatInr(job.total_budget)}
                    </span>
                    <span>{job.milestone_count} milestone{job.milestone_count !== 1 ? "s" : ""}</span>
                    <span>{job.application_count} application{job.application_count !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {relativeTime(job.created_at)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Briefcase className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">No jobs yet</p>
        <p className="text-sm text-muted-foreground">Post your first job to get started.</p>
      </div>
      <Link href="/client/jobs/new" className={cn(buttonVariants(), "gap-2")}>
        <Plus className="h-4 w-4" />
        Post a Job
      </Link>
    </div>
  );
}

function ClientJobListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
