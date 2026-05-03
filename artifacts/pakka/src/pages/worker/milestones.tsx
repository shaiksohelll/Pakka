import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getMilestones, getJob } from "@/actions/jobs";
import { formatInr, relativeTime } from "@/lib/format";
import { CheckCircle2, Clock } from "lucide-react";

export default function WorkerMilestones() {
  const { id } = useParams<{ id: string }>();

  const { data: job } = useQuery({
    queryKey: ["job", id],
    queryFn: () => getJob(id),
    enabled: !!id,
  });

  const { data: milestones, isLoading } = useQuery({
    queryKey: ["milestones", id],
    queryFn: () => getMilestones(id),
    enabled: !!id,
  });

  const earned = milestones
    ?.filter((m) => m.status === "released")
    .reduce((s, m) => s + m.amount, 0) ?? 0;

  const pending = milestones
    ?.filter((m) => m.status === "funded")
    .reduce((s, m) => s + m.amount, 0) ?? 0;

  return (
    <PageShell title="My Milestones" back="/worker/applications" role="worker">
      <div className="p-4 space-y-3">
        {job && (
          <div className="rounded-lg bg-muted p-3 space-y-1">
            <p className="text-sm font-semibold">{job.title}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Earned</p>
              <p className="text-lg font-bold text-green-600">{formatInr(earned)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">In Escrow</p>
              <p className="text-lg font-bold text-blue-600">{formatInr(pending)}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))
        ) : milestones?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No milestones yet. The client will add milestones to track progress.
          </div>
        ) : (
          milestones?.map((ms) => (
            <Card key={ms.id}>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{ms.title}</CardTitle>
                  <StatusBadge status={ms.status} />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <p className="text-lg font-bold text-primary">{formatInr(ms.amount)}</p>
                {ms.due_date && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Due: {ms.due_date}
                  </div>
                )}
                {ms.paid_at && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Paid {relativeTime(ms.paid_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PageShell>
  );
}
