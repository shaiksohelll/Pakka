import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUser } from "@/hooks/use-user";
import { getJob, applyToJob } from "@/actions/jobs";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function WorkerJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useUser();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => getJob(id),
    enabled: !!id,
  });

  const { data: existingApp } = useQuery({
    queryKey: ["my-application", id, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("applications")
        .select("id, status")
        .eq("job_id", id)
        .eq("worker_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!id,
  });

  const applyMut = useMutation({
    mutationFn: () => applyToJob(id, user!.id, note),
    onSuccess: () => {
      toast.success("Application submitted!");
      qc.invalidateQueries({ queryKey: ["my-application", id, user?.id] });
      qc.invalidateQueries({ queryKey: ["worker-applications"] });
      setOpen(false);
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <PageShell title="Job Details" back="/worker/feed" role="worker">
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  if (!job) return null;

  const canApply = job.status === "open" && !existingApp && user?.kyc_status !== "rejected";
  const isAssignedWorker = job.worker_id === user?.id;

  return (
    <PageShell title="Job Details" back="/worker/feed" role="worker">
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

            <p className="text-2xl font-bold text-primary">{formatInr(job.total_budget)}</p>

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

            {(job.client as { name: string | null })?.name && (
              <div className="flex items-center gap-2 pt-1">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                  {(job.client as { name: string | null }).name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-muted-foreground">
                  Posted by {(job.client as { name: string | null }).name}
                </span>
                {(job.client as { trust_tier: string | null }).trust_tier && (
                  <StatusBadge status={(job.client as { trust_tier: string | null }).trust_tier!} />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {isAssignedWorker && (
          <Card className="border-accent/40 bg-accent/5">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-accent">You are assigned to this job</p>
              <p className="text-xs text-muted-foreground mt-1">Check milestones to track payment status</p>
            </CardContent>
          </Card>
        )}

        {existingApp && !isAssignedWorker && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-sm font-semibold">Application submitted</p>
              <div className="mt-1">
                <StatusBadge status={existingApp.status} />
              </div>
            </CardContent>
          </Card>
        )}

        {canApply && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2" size="lg">
                <Send className="h-4 w-4" />
                Apply for This Job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply for Job</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label>Cover Note (optional)</Label>
                  <Textarea
                    placeholder="Tell the client why you're a great fit for this job…"
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={applyMut.isPending}
                  onClick={() => applyMut.mutate()}
                >
                  {applyMut.isPending ? "Submitting…" : "Submit Application"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PageShell>
  );
}
