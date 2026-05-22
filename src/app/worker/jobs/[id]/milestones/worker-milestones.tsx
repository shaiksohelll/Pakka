"use client";

import { generateUuid } from "@/lib/uuid";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Send, CheckCircle2, Clock, Shield, Lock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { submitMilestoneAction } from "@/app/_actions/escrow";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatInr, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────────
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

// ── Fetcher ────────────────────────────────────────────────────────────────────────
async function fetchWorkerMilestones(jobId: string, userId: string) {
  const supabase = createClient();

  const [jobRes, msRes, walletRes] = await Promise.all([
    supabase.from("jobs").select("id,title,total_budget,status,worker_id").eq("id", jobId).single(),
    supabase
      .from("milestones")
      .select(
        "id,sequence,title,description,amount,status,auto_release_at,submitted_at,approved_at",
      )
      .eq("job_id", jobId)
      .order("sequence"),
    supabase.from("wallets").select("available_balance,locked_balance").eq("profile_id", userId).single(),
  ]);

  if (jobRes.error) throw jobRes.error;
  if (msRes.error) throw msRes.error;
  // PGRST116 = "no rows" → expected when wallet hasn't been created yet; fall through to zero-balance default.
  if (walletRes.error && walletRes.error.code !== "PGRST116") throw walletRes.error;

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

// ── Main component ──────────────────────────────────────────────────────────────────────
export function WorkerMilestones({
  workerKyc,
}: {
  workerKyc: "pending" | "verified" | "rejected";
}) {
  const { id: jobId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useUser();

  // Synchronous gate (catches double-clicks before React re-renders) +
  // per-milestone in-flight state (so only the clicked button spins).
  const inFlightRef = useRef<Set<string>>(new Set());
  // Per-intent idempotency key map. Key rotates only on success so that
  // network-error retries send the same UUID and the server can deduplicate.
  const idempotencyKeysRef = useRef<Map<string, string>>(new Map());
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());

  // Mounted flag: used to skip setState in handleSubmit's finally block if
  // the component unmounts mid-flight (avoids React's "setState on unmounted
  // component" warning).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["worker-milestones", jobId, user?.id],
    staleTime: 10_000,
    enabled: !!user?.id,
    queryFn: () => fetchWorkerMilestones(jobId, user!.id),
  });

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
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
        (payload) => {
          console.log("[worker-milestones-realtime] event:", payload.table, payload.eventType);
          queryClient.invalidateQueries({
            queryKey: ["worker-milestones", jobId],
          });
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
          console.log("[worker-milestones-realtime] event:", payload.table, payload.eventType);
          queryClient.invalidateQueries({
            queryKey: ["worker-milestones", jobId],
          });
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
          console.log("[worker-milestones-realtime] event:", payload.table, payload.eventType);
          queryClient.invalidateQueries({
            queryKey: ["worker-milestones", jobId],
          });
        },
      )
      .subscribe((status, err) => {
        console.log("[worker-milestones-realtime]", status, err ?? "");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, jobId, queryClient]);

  // ── Idempotency key helpers ──────────────────────────────────────────────
  function getOrCreateIdempotencyKey(milestoneId: string): string {
    const existing = idempotencyKeysRef.current.get(milestoneId);
    if (existing) return existing;
    const fresh = generateUuid();
    idempotencyKeysRef.current.set(milestoneId, fresh);
    return fresh;
  }

  function clearIdempotencyKey(milestoneId: string): void {
    idempotencyKeysRef.current.delete(milestoneId);
  }

  // ── Submit handler ─────────────────────────────────────────────────────────────────
  async function handleSubmit(milestoneId: string) {
    // Synchronous gate: a second click on the same milestone returns
    // immediately, before React has a chance to re-render with the disabled
    // attribute. This is the actual race fix.
    if (inFlightRef.current.has(milestoneId)) return;
    inFlightRef.current.add(milestoneId);
    setInFlight(new Set(inFlightRef.current));

    try {
      const result = await submitMilestoneAction({
        milestone_id: milestoneId,
        idempotency_key: getOrCreateIdempotencyKey(milestoneId),
      });

      if (!result.success) {
        toast.error(result.error);
      } else {
        clearIdempotencyKey(milestoneId);
        toast.success("Milestone submitted for review!");
      }
      queryClient.invalidateQueries({
        queryKey: ["worker-milestones", jobId],
      });
    } catch (err) {
      // Thrown errors (network, server crash). Return-shape errors are
      // handled in the `if (!result.success)` branch above.
      // TODO: Sentry.captureException(err)
      // Log the raw error for debugging; show a fixed user-safe message.
      console.error("[worker-milestones:submit] unexpected", err);
      toast.error("Submission failed. Please try again.");
      queryClient.invalidateQueries({
        queryKey: ["worker-milestones", jobId],
      });
    } finally {
      inFlightRef.current.delete(milestoneId);
      // Skip the React state update if the component unmounted while the
      // request was in flight. The ref cleanup above still runs.
      if (mountedRef.current) {
        setInFlight(new Set(inFlightRef.current));
      }
    }
  }

  if (isAuthLoading || !user?.id) return <WorkerMilestonesSkeleton />;
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
      {/* ── Wallet summary ── */}
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
          <p className="text-lg font-bold text-primary">{formatInr(totalEarned)}</p>
        </div>
      </section>

      <Separator />

      {/* ── Milestone cards ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Milestones ({milestones.length})</h2>

        {milestones.map((m) => {
          const isInFlight = inFlight.has(m.id);
          return (
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
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <p className="text-sm font-semibold">
                    {m.sequence}. {m.title}
                  </p>
                  {m.description && (
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold">{formatInr(m.amount)}</span>
                  <StatusBadge variant={m.status} />
                </div>
              </div>

              {/* Status messages */}
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
                    Submitted {m.submitted_at ? relativeTime(m.submitted_at) : ""}. Auto-releases if
                    client takes no action.
                  </span>
                </div>
              )}
              {m.status === "disputed" && (
                <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  <span>Disputed by client. Under review. Funds remain locked.</span>
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

              {/* Submit button */}
              {m.status === "funded" && workerKyc === "verified" && (
                <Button
                  size="sm"
                  className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  disabled={isInFlight}
                  onClick={() => handleSubmit(m.id)}
                >
                  {isInFlight ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {/* TODO: Phase 5 — proof upload UI */}
                  Submit for Review
                </Button>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────────────
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
