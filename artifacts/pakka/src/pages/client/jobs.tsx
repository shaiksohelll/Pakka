import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUser } from "@/hooks/use-user";
import { getJobs } from "@/actions/jobs";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";

export default function ClientJobs() {
  const [, navigate] = useLocation();
  const { data: user } = useUser();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["client-jobs", user?.id],
    queryFn: () => getJobs({ clientId: user!.id }),
    enabled: !!user?.id,
  });

  return (
    <PageShell
      title="My Jobs"
      role="client"
      headerRight={
        <Button size="sm" className="gap-1" onClick={() => navigate("/client/jobs/new")}>
          <Plus className="h-4 w-4" />
          Post Job
        </Button>
      }
    >
      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : jobs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="text-5xl">📋</div>
            <p className="font-medium">No jobs posted yet</p>
            <p className="text-sm text-muted-foreground">Post your first job to get started</p>
            <Button onClick={() => navigate("/client/jobs/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Post a Job
            </Button>
          </div>
        ) : (
          jobs?.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/client/jobs/${job.id}`)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm leading-snug flex-1">{job.title}</p>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                    {CATEGORY_LABELS[job.category] ?? job.category}
                  </span>
                  <span className="font-semibold text-foreground">{formatInr(job.budget)}</span>
                </div>
                {job.location_text && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {job.location_text}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{relativeTime(job.created_at)}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PageShell>
  );
}
