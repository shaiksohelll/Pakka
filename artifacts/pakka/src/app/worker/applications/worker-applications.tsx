import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AppStatus = "pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn";

type WorkerApplication = {
  id: string;
  job_id: string;
  bid_amount: number;
  eta_days: number;
  message: string | null;
  status: AppStatus;
  created_at: string;
  job_title: string;
  job_category: string;
  job_total_budget: number;
};

const STATUS_GROUPS: { label: string; statuses: AppStatus[] }[] = [
  { label: "Pending", statuses: ["pending", "shortlisted"] },
  { label: "Accepted", statuses: ["accepted"] },
  { label: "Rejected / Withdrawn", statuses: ["rejected", "withdrawn"] },
];

export function WorkerApplications() {
  const queryClient = useQueryClient();

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ["worker-applications"],
    staleTime: 10_000,
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("job_applications")
        .select(`
          id, job_id, bid_amount, eta_days, message, status, created_at,
          jobs!job_applications_job_id_fkey(title, category, total_budget)
        `)
        .eq("worker_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((a) => ({
        id: a.id,
        job_id: a.job_id,
        bid_amount: Number(a.bid_amount),
        eta_days: a.eta_days,
        message: a.message,
        status: a.status as AppStatus,
        created_at: a.created_at,
        job_title: (a.jobs as unknown as { title: string } | null)?.title ?? "Job",
        job_category: (a.jobs as unknown as { category: string } | null)?.category ?? "",
        job_total_budget: Number((a.jobs as unknown as { total_budget: number } | null)?.total_budget ?? 0),
      })) satisfies WorkerApplication[];
    },
  });

  // ADR-0037 Part 1.5: Realtime subscription for accept/reject decisions on this
  // worker's applications. H3: filter is a string. H4: removeChannel + status log.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      channel = supabase
        .channel(`worker-applications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "job_applications",
            filter: `worker_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["worker-applications"] });
            // Also invalidate applied-jobs set so feed badges update
            queryClient.invalidateQueries({ queryKey: ["worker-applied-jobs"] });
          },
        )
        .subscribe((status) => console.log("[worker-applications]", status));
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isLoading) return <ApplicationsSkeleton />;
  if (error) {
    return (
      <div className="rounded-xl border bg-destructive/5 p-6 text-center text-destructive">
        Failed to load applications. Please refresh.
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">No applications yet</p>
          <p className="text-sm text-muted-foreground">
            Browse open jobs and apply to get started.
          </p>
        </div>
        <Link
          href="/worker/feed"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Browse Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {STATUS_GROUPS.map(({ label, statuses }) => {
        const group = applications.filter((a) => statuses.includes(a.status));
        if (group.length === 0) return null;

        return (
          <section key={label}>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              {label} ({group.length})
            </h2>
            <ul className="space-y-3">
              {group.map((app) => (
                <li key={app.id}>
                  <Link
                    href={`/worker/jobs/${app.job_id}`}
                    className={cn(
                      "flex items-start justify-between rounded-xl border bg-card p-4 transition-shadow hover:shadow-md",
                      (app.status === "rejected" || app.status === "withdrawn") && "opacity-60",
                    )}
                  >
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge variant={app.status} />
                        <span className="text-xs text-muted-foreground capitalize">
                          {CATEGORY_LABELS[app.job_category] ?? app.job_category}
                        </span>
                      </div>
                      <p className="font-semibold leading-snug text-foreground line-clamp-1">
                        {app.job_title}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>
                          Your bid:{" "}
                          <span className="font-medium text-primary">
                            {formatInr(app.bid_amount)}
                          </span>
                        </span>
                        <span>
                          Budget:{" "}
                          <span className="font-medium">{formatInr(app.job_total_budget)}</span>
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {app.eta_days} day ETA · {relativeTime(app.created_at)}
                      </p>
                      {app.message && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{app.message}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5 ml-2" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ApplicationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
