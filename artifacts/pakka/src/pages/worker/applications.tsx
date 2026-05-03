import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUser } from "@/hooks/use-user";
import { getWorkerApplications } from "@/actions/jobs";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";
import { MapPin } from "lucide-react";

export default function WorkerApplications() {
  const [, navigate] = useLocation();
  const { data: user } = useUser();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["worker-applications", user?.id],
    queryFn: () => getWorkerApplications(user!.id),
    enabled: !!user?.id,
  });

  return (
    <PageShell title="My Applications" role="worker">
      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : applications?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="text-5xl">📋</div>
            <p className="font-medium">No applications yet</p>
            <p className="text-sm text-muted-foreground">
              Browse the job feed and apply to jobs
            </p>
          </div>
        ) : (
          applications?.map((app: { id: string; status: string; created_at: string; job_id: string; job: { title: string; total_budget: number; status: string; category: string; location_text: string | null } | null }) => (
            <Card
              key={app.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                if (app.status === "accepted") navigate(`/worker/jobs/${app.job_id}/milestones`);
                else navigate(`/worker/jobs/${app.job_id}`);
              }}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm leading-snug flex-1">
                    {app.job?.title ?? "Job"}
                  </p>
                  <StatusBadge status={app.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {app.job?.category && (
                    <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                      {CATEGORY_LABELS[app.job.category] ?? app.job.category}
                    </span>
                  )}
                  {app.job?.total_budget && (
                    <span className="font-bold text-foreground">{formatInr(app.job.total_budget)}</span>
                  )}
                </div>
                {app.job?.location_text && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {app.job.location_text}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Applied {relativeTime(app.created_at)}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PageShell>
  );
}
