import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, LockKeyhole, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUser } from "@/hooks/use-user";
import { getMilestones, getJob, createMilestone } from "@/actions/jobs";
import { fundMilestone, releaseMilestone, raiseDispute } from "@/actions/escrow";
import { milestoneSchema, type MilestoneFormValues } from "@/lib/schemas/jobs";
import { formatInr } from "@/lib/format";
import { useState } from "react";

export default function ClientMilestones() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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

  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: { title: "", amount: 0, due_date: "" },
  });

  const createMut = useMutation({
    mutationFn: (vals: MilestoneFormValues) =>
      createMilestone({
        job_id: id,
        title: vals.title,
        amount: vals.amount,
        due_date: vals.due_date || undefined,
        seq: (milestones?.length ?? 0) + 1,
      }),
    onSuccess: () => {
      toast.success("Milestone added");
      qc.invalidateQueries({ queryKey: ["milestones", id] });
      form.reset();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fundMut = useMutation({
    mutationFn: ({ msId, amount }: { msId: string; amount: number }) =>
      fundMilestone(msId, user!.id, amount),
    onSuccess: () => {
      toast.success("Milestone funded into escrow");
      qc.invalidateQueries({ queryKey: ["milestones", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseMut = useMutation({
    mutationFn: ({ msId, amount }: { msId: string; amount: number }) =>
      releaseMilestone(msId, job?.worker_id ?? "", amount),
    onSuccess: () => {
      toast.success("Payment released to worker");
      qc.invalidateQueries({ queryKey: ["milestones", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disputeMut = useMutation({
    mutationFn: (msId: string) => raiseDispute(msId),
    onSuccess: () => {
      toast.success("Dispute raised — our team will review");
      qc.invalidateQueries({ queryKey: ["milestones", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalBudget = milestones?.reduce((s, m) => s + m.amount, 0) ?? 0;

  return (
    <PageShell
      title="Milestones"
      back={`/client/jobs/${id}`}
      role="client"
      headerRight={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Milestone</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((v) => createMut.mutate(v))} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input placeholder="e.g. Site inspection" {...form.register("title")} />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Amount (₹)</Label>
                <Input type="number" placeholder="5000" {...form.register("amount")} />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Due Date (optional)</Label>
                <Input type="date" {...form.register("due_date")} />
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>
                {createMut.isPending ? "Adding…" : "Add Milestone"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="p-4 space-y-3">
        {job && (
          <div className="rounded-lg bg-muted p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Total Budget</span>
            <span className="font-bold">{formatInr(job.total_budget)}</span>
          </div>
        )}
        {totalBudget > 0 && (
          <div className="rounded-lg bg-muted p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Milestones Total</span>
            <span className="font-bold">{formatInr(totalBudget)}</span>
          </div>
        )}

        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : milestones?.map((ms) => (
              <Card key={ms.id}>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{ms.title}</CardTitle>
                    <StatusBadge status={ms.status} />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <p className="text-lg font-bold text-primary">{formatInr(ms.amount)}</p>
                  {ms.due_date && (
                    <p className="text-xs text-muted-foreground">Due: {ms.due_date}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {ms.status === "pending" && (
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={fundMut.isPending}
                        onClick={() => fundMut.mutate({ msId: ms.id, amount: ms.amount })}
                      >
                        <LockKeyhole className="h-3.5 w-3.5" />
                        Fund Escrow
                      </Button>
                    )}
                    {ms.status === "funded" && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={releaseMut.isPending}
                          onClick={() => releaseMut.mutate({ msId: ms.id, amount: ms.amount })}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Release Payment
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                          disabled={disputeMut.isPending}
                          onClick={() => disputeMut.mutate(ms.id)}
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Raise Dispute
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

        {!isLoading && milestones?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No milestones yet. Add milestones to track and escrow payments.
          </div>
        )}
      </div>
    </PageShell>
  );
}
