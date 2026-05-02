import { useEffect, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { toast } from "sonner";
import {
  Send,
  CheckCircle2,
  Clock,
  Shield,
  Lock,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitMilestoneAction } from "@/app/_actions/escrow";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatInr, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type MilestoneStatus =
  | "pending"
  | "funded"
  | "submitted"
  | "approved"
  | "disputed"
  | "released"
  | "refunded";

type Milestone = {
  id: string;
  sequence: number;
  title: string;
  description: string | null;
  amount: number;
  status: MilestoneStatus;
  auto_release_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
};

type WalletInfo = {
  available_balance: number;
  locked_balance: number;
};

async function fetchWorkerMilestones(jobId: string) {
  const supabase = createClient();

  const [jobRes, msRes, walletRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,title,total_budget,status,worker_id")
      .eq("id", jobId)
      .single(),
    supabase
      .from("milestones")
      .select("id,sequence,title,description,amount,status,auto_release_at,submitted_at,approved_at")
      .eq("job_id", jobId)
      .order("sequence"),
    supabase
      .from("wallets")
      .select("available_balance,locked_balance")
      .limit(1)
      .single(),
  ]);

  if (jobRes.error) throw jobRes.error;

  return {
    job: {
      ...jobRes.data,
      total_budget: Number(jobRes.data!.total_budget),
    },
    milestones: (msRes.data ?? []).map((m) => ({
      ...m,
      amount: Number(m.amount),
    })) as Milestone[],
    wallet: walletRes.data
      ? {
          available_balance: Number(walletRes.data.available_balance),
          locked_balance: Number(walletRes.data.locked_balance),
        }
      : ({ available_balance: 0, locked_balance: 0 } as WalletInfo),
  };
}

export function WorkerMilestones({
  workerKyc,
}: {
  workerKyc: "pending" | "verified" | "rejected";
}) {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const { data, isLoading, error } = useQuery({
    queryKey: ["worker-milestones", jobId],
    staleTime: 10_000,
    queryFn: () => fetchWorkerMilestones(jobId),
  });

  // ADR-0037: Realtime subscription for milestone status changes.
  // H3: filter is a string literal — object form silently no-ops.
  // H4: removeChannel in cleanup; status callback confirms SUBSCRIBED in DevTools.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`worker-milestones-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "milestones",
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["worker-milestones", jobId],
          });
        },
      )
      .subscribe((status) => console.log("[worker-milestones]", status));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, queryClient]);

  function handleSubmitMilestone(milestoneId: string) {
    startTransition(async () => {
      const result = await submitMilestoneAction({
        milestone_id: milestoneId,
        idempotency_key: crypto.randomUUID(),
      });
      if (!result.success) {
        toast.error(result.error);
        queryClient.invalidateQueries({
          queryKey: ["worker-milestones", jobId],
        });
        return;
      }
      toast.success("Milestone submitted for review!");
      queryClient.invalidateQueries({
        queryKey: ["worker-milestones", jobId],
      });
    });
  }

  if (isLoading) return <WorkerMilestonesSkeleton />;
  if (error || !data) {
    return (
      <div className="rounded-xl border bg-destructive/5 p-6 text-center text-destructive">
        Failed to load milestones. Please refresh.
      </div>
    );
  }

  const { milestones, wallet } = data;
  const totalEarned = milestones
    .filter((m) => ["approved", "released"].includes(m.status))
    .reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Available
          </p>
          <p className="text-lg font-bold text-emerald-700">
            {formatInr(wallet.available_balance)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Earned (this job)
          </p>
          <p className="text-lg font-bold text-primary">
            {formatInr(totalEarned)}
          </p>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          Milestones ({milestones.length})
        </h2>

        {milestones.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-xl border bg-card p-4 space-y-3 transition-all",
              m.status === "disputed" && "border-red-200 bg-red-50/30",
              (m.status === "approved" || m.status === "released") &&
                "border-emerald-200 bg-emerald-50/30",
              m.status === "funded" && "border-blue-200 bg-blue-50/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 flex-1">
                <p className="text-sm font-semibold">
                  {m.sequence}. {m.title}
                </p>
                {m.description && (
                  <p className="text-xs text-muted-foreground">
                    {m.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold">{formatInr(m.amount)}</span>
                <StatusBadge variant={m.status} />
              </div>
            </div>

            {m.status === "pending" && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Lock className="h-3.5 w-3.5" />
                <span>Waiting for client to fund this milestone.</span>
              </div>
            )}

            {m.status === "funded" && workerKyc !== "verified" && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <Shield className="h-3.5 w-3.5" />
                <span>Complete KYC verification to submit milestones.</span>
              </div>
            )}

            {m.status === "submitted" && m.auto_release_at && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Submitted {m.submitted_at ? relativeTime(m.submitted_at) : ""}.
                  Auto-releases if client takes no action.
                </span>
              </div>
            )}

            {m.status === "disputed" && (
              <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Disputed by client. Under review. Funds remain locked.
                </span>
              </div>
            )}

            {(m.status === "approved" || m.status === "released") && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Released to your wallet
                  {m.approved_at ? ` · ${relativeTime(m.approved_at)}` : ""}
                </span>
              </div>
            )}

            {m.status === "funded" && workerKyc === "verified" && (
              <Button
                size="sm"
                className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                disabled={isPending}
                onClick={() => handleSubmitMilestone(m.id)}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Submit for Review
              </Button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function WorkerMilestonesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Separator />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}
