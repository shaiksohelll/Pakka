"use client";

import { generateUuid } from "@/lib/uuid";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Lock, CheckCircle2, AlertTriangle, Loader2, Clock, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import {
  fundMilestoneAction,
  approveMilestoneAction,
  disputeMilestoneAction,
} from "@/app/_actions/escrow";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatInr, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
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

type JobInfo = {
  id: string;
  title: string;
  total_budget: number;
  status: string;
  worker_id: string | null;
};

// ── Fetcher ───────────────────────────────────────────────────────────────────
async function fetchMilestonesData(jobId: string, userId: string) {
  const supabase = createClient();

  const [jobRes, msRes, walletRes, workerRes] = await Promise.all([
    supabase.from("jobs").select("id,title,total_budget,status,worker_id").eq("id", jobId).single(),
    supabase
      .from("milestones")
      .select(
        "id,sequence,title,description,amount,status,auto_release_at,submitted_at,approved_at",
      )
      .eq("job_id", jobId)
      .order("sequence"),
    supabase
      .from("wallets")
      .select("available_balance,locked_balance")
      .eq("profile_id", userId)
      .single(),
    // Get the worker name if assigned
    supabase
      .from("jobs")
      .select("worker_id, profiles!jobs_worker_id_fkey(full_name)")
      .eq("id", jobId)
      .single(),
  ]);

  if (jobRes.error) throw jobRes.error;
  if (msRes.error) throw msRes.error;
  // PGRST116 = "no rows" → expected when wallet hasn't been created yet; fall through to zero-balance default.
  if (walletRes.error && walletRes.error.code !== "PGRST116") throw walletRes.error;
  // workerRes is a nice-to-have join (assigned worker name); allowed to fail silently → falls back to "Worker".

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerName = (workerRes.data?.profiles as any)?.full_name ?? "Worker";

  return {
    job: {
      ...jobRes.data,
      total_budget: Number(jobRes.data!.total_budget),
    } as JobInfo,
    milestones: (msRes.data ?? []).map((m) => ({
      ...m,
      amount: Number(m.amount),
    })) as Milestone[],
    wallet: walletRes.data
      ? {
        available_balance: Number(walletRes.data.available_balance),
        locked_balance: Number(walletRes.data.locked_balance),
      }
      : { available_balance: 0, locked_balance: 0 },
    workerName,
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export function ClientMilestones() {
  const { id: jobId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const inFlightRef = useRef<Set<string>>(new Set());
  // Per-intent idempotency key map. Key rotates only on success so retries
  // re-use the same UUID (forward-compatible with server-side RPC idempotency).
  const idempotencyKeysRef = useRef<Map<string, string>>(new Map());
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const { user, isLoading: isAuthLoading } = useUser();
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "fund" | "approve" | "dispute";
    milestoneId: string;
    milestoneTitle: string;
    amount: number;
  } | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-milestones", jobId, user?.id],
    staleTime: 10_000,
    enabled: !!user?.id,
    queryFn: () => fetchMilestonesData(jobId, user!.id),
  });

  // ── Realtime: milestone status changes ──────────────────────────────────
  // The singleton client's eager-prime + onAuthStateChange propagates the JWT
  // to the Realtime transport before any channel is created.
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const supabase = createClient();
    const channel = supabase
      .channel(`client-milestones-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "milestones",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          console.log("[client-milestones-realtime] event:", payload.table, payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["client-milestones", jobId] });
          queryClient.invalidateQueries({ queryKey: ["client-job", jobId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "escrow_ledger",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          console.log("[client-milestones-realtime] event:", payload.table, payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["client-milestones", jobId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `profile_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[client-milestones-realtime] event:", payload.table, payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["client-milestones", jobId] });
        },
      )
      .subscribe((status, err) => {
        console.log("[client-milestones-realtime]", status, err ?? "");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, jobId, queryClient]);

  // ── Auth redirect ─────────────────────────────────────────────────────────
  // Redirect is scheduled in useEffect, not during render, to avoid the
  // React render-phase side-effect anti-pattern (Rules of Hooks).
  useEffect(() => {
    if (!isAuthLoading && !user?.id) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  // ── Idempotency key helpers ──────────────────────────────────────────────
  // Reuses an existing key for the same (action, milestoneId) pair so that
  // a retry after a network drop sends the same UUID the server already saw.
  // Clears only on success so the next distinct intent gets a fresh key.
  function getOrCreateIdempotencyKey(
    action: "fund" | "approve" | "dispute",
    milestoneId: string,
  ): string {
    const k = `${action}:${milestoneId}`;
    const existing = idempotencyKeysRef.current.get(k);
    if (existing) return existing;
    const fresh = generateUuid();
    idempotencyKeysRef.current.set(k, fresh);
    return fresh;
  }

  function clearIdempotencyKey(
    action: "fund" | "approve" | "dispute",
    milestoneId: string,
  ): void {
    idempotencyKeysRef.current.delete(`${action}:${milestoneId}`);
  }

  // ── Action handlers ─────────────────────────────────────────────────────
  function handleFund(milestoneId: string) {
    if (inFlightRef.current.has(milestoneId)) return;
    inFlightRef.current.add(milestoneId);
    startTransition(async () => {
      try {
        const result = await fundMilestoneAction({
          milestone_id: milestoneId,
          idempotency_key: getOrCreateIdempotencyKey("fund", milestoneId),
        });
        if (!result.success) {
          if (mountedRef.current) toast.error(result.error);
          return;
        }
        clearIdempotencyKey("fund", milestoneId);
        queryClient.invalidateQueries({ queryKey: ["client-milestones", jobId] });
        queryClient.invalidateQueries({ queryKey: ["client-job", jobId] });
        if (mountedRef.current) {
          toast.success("Milestone funded! Funds locked in escrow.");
          setConfirmDialog(null);
        }
      } finally {
        inFlightRef.current.delete(milestoneId);
      }
    });
  }

  function handleApprove(milestoneId: string) {
    if (inFlightRef.current.has(milestoneId)) return;
    inFlightRef.current.add(milestoneId);
    startTransition(async () => {
      // Optimistic: close dialog immediately
      setConfirmDialog(null);
      try {
        const result = await approveMilestoneAction({
          milestone_id: milestoneId,
          idempotency_key: getOrCreateIdempotencyKey("approve", milestoneId),
        });
        if (!result.success) {
          // Rollback by refetching
          queryClient.invalidateQueries({ queryKey: ["client-milestones", jobId] });
          if (mountedRef.current) toast.error(result.error);
          return;
        }
        clearIdempotencyKey("approve", milestoneId);
        queryClient.invalidateQueries({ queryKey: ["client-milestones", jobId] });
        queryClient.invalidateQueries({ queryKey: ["client-job", jobId] });
        if (mountedRef.current) {
          toast.success("Milestone approved! Funds released to worker.");
        }
      } finally {
        inFlightRef.current.delete(milestoneId);
      }
    });
  }

  function handleDispute(milestoneId: string) {
    if (disputeReason.trim().length < 10) {
      toast.error("Please provide a reason (at least 10 characters).");
      return;
    }
    if (inFlightRef.current.has(milestoneId)) return;
    inFlightRef.current.add(milestoneId);
    startTransition(async () => {
      setConfirmDialog(null);
      try {
        const result = await disputeMilestoneAction({
          milestone_id: milestoneId,
          reason: disputeReason,
          idempotency_key: getOrCreateIdempotencyKey("dispute", milestoneId),
        });
        if (!result.success) {
          queryClient.invalidateQueries({ queryKey: ["client-milestones", jobId] });
          if (mountedRef.current) toast.error(result.error);
          return;
        }
        clearIdempotencyKey("dispute", milestoneId);
        queryClient.invalidateQueries({ queryKey: ["client-milestones", jobId] });
        if (mountedRef.current) {
          toast.success("Dispute raised. Our team will review this.");
          setDisputeReason("");
        }
      } finally {
        inFlightRef.current.delete(milestoneId);
      }
    });
  }

  // Auth still hydrating — show skeleton, not error.
  if (isAuthLoading || !user?.id) return <MilestonesSkeleton />;
  if (isLoading) return <MilestonesSkeleton />;
  if (error || !data) {
    return (
      <div className="rounded-xl border bg-destructive/5 p-6 text-center text-destructive">
        Failed to load milestones. Please refresh.
      </div>
    );
  }

  const { job, milestones, wallet, workerName } = data;

  const funded = milestones.filter((m) =>
    ["funded", "submitted", "approved", "released"].includes(m.status),
  );
  const totalLocked = milestones
    .filter((m) => ["funded", "submitted", "disputed"].includes(m.status))
    .reduce((sum, m) => sum + m.amount, 0);
  const totalReleased = milestones
    .filter((m) => ["approved", "released"].includes(m.status))
    .reduce((sum, m) => sum + m.amount, 0);

  return (
    <>
      <div className="space-y-6">
        {/* ── Job header ── */}
        <section className="space-y-1">
          <h1 className="text-xl font-bold text-primary leading-snug">{job.title}</h1>
          <p className="text-sm text-muted-foreground">
            Escrow milestones · {milestones.length} total
          </p>
        </section>

        {/* ── Wallet summary ── */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Available
            </p>
            <p className="text-lg font-bold text-primary">{formatInr(wallet.available_balance)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <div className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-blue-600" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Locked
              </p>
            </div>
            <p className="text-lg font-bold text-blue-700">{formatInr(wallet.locked_balance)}</p>
          </div>
        </section>

        {/* ── Progress bar ── */}
        <section>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              {funded.length} of {milestones.length} milestones funded
            </span>
            <span>
              {formatInr(totalReleased)} released · {formatInr(totalLocked)} locked
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{
                width: `${milestones.length > 0 ? ((totalReleased + totalLocked) / job.total_budget) * 100 : 0}%`,
              }}
            />
          </div>
        </section>

        <Separator />

        {/* ── Milestone cards ── */}
        <section className="space-y-3">
          {milestones.map((m) => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              walletBalance={wallet.available_balance}
              workerName={workerName}
              isPending={isPending}
              onFund={() =>
                setConfirmDialog({
                  type: "fund",
                  milestoneId: m.id,
                  milestoneTitle: m.title,
                  amount: m.amount,
                })
              }
              onApprove={() =>
                setConfirmDialog({
                  type: "approve",
                  milestoneId: m.id,
                  milestoneTitle: m.title,
                  amount: m.amount,
                })
              }
              onDispute={() =>
                setConfirmDialog({
                  type: "dispute",
                  milestoneId: m.id,
                  milestoneTitle: m.title,
                  amount: m.amount,
                })
              }
            />
          ))}
        </section>
      </div>

      {/* ── Confirmation modals ── */}
      {/* Fund confirmation */}
      <Dialog
        open={confirmDialog?.type === "fund"}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund Milestone</DialogTitle>
            <DialogDescription>
              Lock {formatInr(confirmDialog?.amount ?? 0)} in escrow for &quot;
              {confirmDialog?.milestoneTitle}&quot;?
              <br />
              <span className="text-xs text-muted-foreground mt-1 block">
                This amount will be deducted from your available balance.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              disabled={isPending}
              onClick={() => confirmDialog && handleFund(confirmDialog.milestoneId)}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Fund {formatInr(confirmDialog?.amount ?? 0)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve confirmation */}
      <Dialog
        open={confirmDialog?.type === "approve"}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Funds</DialogTitle>
            <DialogDescription>
              Release {formatInr(confirmDialog?.amount ?? 0)} to {workerName}?{" "}
              <strong>This cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={isPending}
              onClick={() => confirmDialog && handleApprove(confirmDialog.milestoneId)}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve & Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute confirmation */}
      <Dialog
        open={confirmDialog?.type === "dispute"}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(null);
            setDisputeReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise Dispute</DialogTitle>
            <DialogDescription>
              Dispute &quot;{confirmDialog?.milestoneTitle}&quot;? Funds will remain locked until
              resolved by our team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="dispute-reason" className="text-sm font-medium text-foreground">
              Reason for dispute
            </label>
            <Textarea
              id="dispute-reason"
              placeholder="Describe the issue…"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialog(null);
                setDisputeReason("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              disabled={isPending || disputeReason.trim().length < 10}
              onClick={() => confirmDialog && handleDispute(confirmDialog.milestoneId)}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              Raise Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Milestone card ────────────────────────────────────────────────────────────
function MilestoneCard({
  milestone,
  walletBalance,
  workerName,
  isPending,
  onFund,
  onApprove,
  onDispute,
}: {
  milestone: Milestone;
  walletBalance: number;
  workerName: string;
  isPending: boolean;
  onFund: () => void;
  onApprove: () => void;
  onDispute: () => void;
}) {
  const m = milestone;
  const canFund = m.status === "pending" && walletBalance >= m.amount;
  const insufficientBalance = m.status === "pending" && walletBalance < m.amount;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3 transition-all",
        m.status === "disputed" && "border-red-200 bg-red-50/30",
        (m.status === "approved" || m.status === "released") &&
        "border-emerald-200 bg-emerald-50/30",
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 flex-1">
          <p className="text-sm font-semibold">
            {m.sequence}. {m.title}
          </p>
          {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold">{formatInr(m.amount)}</span>
          <StatusBadge variant={m.status} />
        </div>
      </div>

      {/* Auto-release info for submitted milestones */}
      {m.status === "submitted" && m.auto_release_at && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Worker submitted {m.submitted_at ? relativeTime(m.submitted_at) : ""}. Auto-releases{" "}
            {new Date(m.auto_release_at) > new Date()
              ? relativeTime(m.auto_release_at).replace(" ago", "")
              : "soon"}{" "}
            if no action taken.
          </span>
        </div>
      )}

      {/* Disputed info */}
      {m.status === "disputed" && (
        <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span>Under review by our dispute resolution team. Funds remain locked.</span>
        </div>
      )}

      {/* Released info */}
      {(m.status === "approved" || m.status === "released") && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>
            Released to {workerName}
            {m.approved_at ? ` · ${relativeTime(m.approved_at)}` : ""}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Fund button */}
        {m.status === "pending" && (
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700"
            disabled={isPending || !canFund}
            onClick={onFund}
          >
            <Lock className="h-3.5 w-3.5" />
            Fund {formatInr(m.amount)}
          </Button>
        )}
        {insufficientBalance && (
          <p className="text-xs text-destructive flex-1 flex items-center">
            Insufficient balance. Top up your wallet first.
          </p>
        )}

        {/* Approve + Dispute for submitted milestones */}
        {m.status === "submitted" && (
          <>
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={isPending}
              onClick={onApprove}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
              disabled={isPending}
              onClick={onDispute}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Dispute
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function MilestonesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Separator />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}
