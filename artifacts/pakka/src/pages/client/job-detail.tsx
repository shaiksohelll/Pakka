import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Clock, Users, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getJob, getApplicationsForJob, acceptApplication } from "@/actions/jobs";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";

export default function ClientJobDetail() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => getJob(id),
    enabled: !!id,
  });

  const { data: applications } = useQuery({
    queryKey: ["applications", id],
    queryFn: () => getApplicationsForJob(id),
    enabled: !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: (app: { id: string; worker_id: string }) =>
      acceptApplication(app.id, id, app.worker_id),
    onSuccess: () => {
      toast.success("Worker accepted! Job is now assigned.");
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["applications", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <PageShell title="Job Details" back="/client/jobs" role="client">
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  if (!job) return null;

  return (
    <PageShell
      title={job.title}
      back="/client/jobs"
      role="client"
      headerRight={
        (job.status === "assigned" || job.status === "in_progress") ? (
          <Button size="sm" variant="outline" onClick={() => navigate(`/client/jobs/${id}/milestones`)}>
            Milestones
          </Button>
        ) : null
      }
    >
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-bold text-lg leading-snug">{job.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {CATEGORY_LABELS[job.category] ?? job.category}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className="font-bold text-lg text-primary">{formatInr(job.total_budget)}</span>
            </div>

            {job.location_text && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {job.location_text}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Posted {relativeTime(job.created_at)}
            </div>

            {job.description && (
              <>
                <Separator />
                <p className="text-sm text-muted-foreground leading-relaxed">{job.description}</p>
              </>
            )}
          </CardContent>
        </Card>

        {job.worker && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-accent" />
                Assigned Worker
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {(job.worker as { name: string | null }).name?.[0]?.toUpperCase() ?? "W"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{(job.worker as { name: string | null }).name}</p>
                  {(job.worker as { trust_tier: string | null }).trust_tier && (
                    <StatusBadge status={(job.worker as { trust_tier: string | null }).trust_tier!} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {job.status === "open" && applications && applications.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Applications ({applications.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                      {app.worker.name?.[0]?.toUpperCase() ?? "W"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{app.worker.name}</p>
                    {app.worker.trust_tier && (
                      <StatusBadge status={app.worker.trust_tier} className="mt-0.5" />
                    )}
                    {app.note && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{app.note}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate({ id: app.id, worker_id: app.worker_id })}
                  >
                    Accept
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {job.status === "open" && (!applications || applications.length === 0) && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No applications yet. Share the job link to get more visibility.
          </div>
        )}
      </div>
    </PageShell>
  );
}
