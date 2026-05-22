"use client";

import { useEffect, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Users, Calendar, CheckCircle2, Loader2, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { acceptWorkerAction } from "@/app/_actions/jobs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type Milestone = {
  id: string;
  sequence: number;
  title: string;
  description: string | null;
  amount: number;
  status: "pending" | "funded" | "submitted" | "approved" | "disputed" | "released" | "refunded";
};

type Material = {
  id: string;
  vendor_name: string;
  item_name: string;
  qty: number;
  amount: number;
  status: "requested" | "paid" | "delivered";
};

type Application = {
  id: string;
  worker_id: string;
  bid_amount: number;
  eta_days: number;
  message: string | null;
  status: "pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
  worker_name: string;
  worker_trust_tier: "bronze" | "silver" | "gold" | null;
};

type Job = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  location_text: string | null;
  total_budget: number;
  status: "draft" | "open" | "assigned" | "in_progress" | "completed" | "cancelled" | "disputed";
  created_at: string;
  worker_id: string | null;
};

// ── Fetcher ───────────────────────────────────────────────────────────────────
async function fetchJobDetail(jobId: string) {
  const supabase = createClient();

  const [jobRes, msRes, matRes, appRes] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id,title,category,description,location_text,total_budget,status,created_at,worker_id",
      )
      .eq("id", jobId)
      .single(),
    supabase
      .from("milestones")
      .select("id,sequence,title,description,amount,status")
      .eq("job_id", jobId)
      .order("sequence"),
    supabase
      .from("materials")
      .select("id,vendor_name,item_name,qty,amount,status")
      .eq("job_id", jobId),
    supabase
      .from("job_applications")
      .select("id, worker_id, bid_amount, eta_days, message, status, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false }),
  ]);

  if (jobRes.error) throw jobRes.error;
  if (msRes.error) throw msRes.error;
  if (matRes.error) throw matRes.error;
  if (appRes.error) throw appRes.error;

  // Enrich applications with worker name + trust tier via SECURITY DEFINER RPC.
  // Direct .from('profiles').in('id', workerIds) fails RLS — the client can only
  // read their own profile row, so all other workers return empty and the
  // fallback "Worker" / "bronze" fires for every card (ADR-0034).
  const workerIds = Array.from(new Set((appRes.data ?? []).map((a) => a.worker_id)));

  type WorkerSummary = { id: string; full_name: string | null; trust_tier: string | null };
  let workerSummaryMap = new Map<string, WorkerSummary>();

  if (workerIds.length > 0) {
    const { data: workerSummaries, error: wsErr } = await supabase.rpc(
      "get_application_worker_summary",
      { worker_ids: workerIds },
    );
    if (wsErr) {
      console.error("[client-job-detail] worker-summary RPC error:", wsErr);
      // Degrade gracefully: leave workerSummaryMap empty, cards render fallback names/trust tiers.
    } else {
      workerSummaryMap = new Map((workerSummaries ?? []).map((w: WorkerSummary) => [w.id, w]));
    }
  }

  const applications: Application[] = (appRes.data ?? []).map((a) => {
    const ws = workerSummaryMap.get(a.worker_id);
    return {
      id: a.id,
      worker_id: a.worker_id,
      bid_amount: Number(a.bid_amount),
      eta_days: a.eta_days,
      message: a.message,
      status: a.status as Application["status"],
      created_at: a.created_at,
      // Fallbacks only fire for the "row not yet propagated" edge case
      worker_name: ws?.full_name ?? "Worker",
      worker_trust_tier: (ws?.trust_tier ?? null) as Application["worker_trust_tier"],
    };
  });

  return {
    job: {
      ...jobRes.data,
      total_budget: Number(jobRes.data!.total_budget),
    } as Job,
    milestones: (msRes.data ?? []).map((m) => ({
      ...m,
      amount: Number(m.amount),
    })) as Milestone[],
    materials: (matRes.data ?? []).map((m) => ({
      ...m,
      qty: Number(m.qty),
      amount: Number(m.amount),
    })) as Material[],
    applications,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ClientJobDetail() {
  const { id: jobId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const { user } = useUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-job", jobId, user?.id],
    staleTime: 10_000,
    enabled: !!user?.id,
    queryFn: () => fetchJobDetail(jobId),
  });

  // ── Realtime: job status changes + applications ───────────────────────────
  // The singleton client's eager-prime + onAuthStateChange propagates the JWT
  // to the Realtime transport before any channel is created.
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`client-job-detail-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          console.log("[client-job-detail-realtime] event:", payload.table, payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["client-job", jobId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_applications",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          console.log("[client-job-detail-realtime] event:", payload.table, payload.eventType);
          // Reuse the SECURITY DEFINER RPC — direct .from("profiles").eq() is
          // blocked by RLS for any non-self row, always returning null and
          // falling back to the literal "a worker" in the toast. ADR-0034.
          const workerId = (payload.new as { worker_id: string }).worker_id;

          // Trigger refresh immediately — DO NOT gate on RPC.
          queryClient.invalidateQueries({ queryKey: ["client-job", jobId] });

          // Enrich toast with worker name; failure is non-fatal.
          Promise.resolve(
            supabase.rpc("get_application_worker_summary", { worker_ids: [workerId] }),
          )
            .then(({ data, error }) => {
              if (error) {
                console.error("[client-job-detail-realtime] RPC error:", error);
                toast.info("Someone just applied!");
                return;
              }
              const name = data?.[0]?.full_name ?? "Someone";
              toast.info(`${name} just applied!`);
            })
            .catch((err: unknown) => {
              console.error("[client-job-detail-realtime] RPC rejected:", err);
              toast.info("Someone just applied!");
            });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_applications",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          console.log("[client-job-detail-realtime] event:", payload.table, payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["client-job", jobId] });
        },
      )
      .subscribe((status, err) => {
        console.log("[client-job-detail-realtime]", status, err ?? "");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, jobId, queryClient]);

  // ── Accept handler ────────────────────────────────────────────────────────
  function handleAccept(applicationId: string) {
    startTransition(async () => {
      const result = await acceptWorkerAction({ job_id: jobId, application_id: applicationId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Worker accepted! Redirecting to fund escrow…");
      queryClient.invalidateQueries({ queryKey: ["client-job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["client-jobs"] });
      // Redirect to fund placeholder
      window.location.href = `/client/jobs/${jobId}/milestones`;
    });
  }

  if (isLoading) return <ClientJobDetailSkeleton />;
  if (error || !data) {
    return (
      <div className="rounded-xl border bg-destructive/5 p-6 text-center text-destructive">
        Failed to load job details. Please refresh.
      </div>
    );
  }

  const { job, milestones, materials, applications } = data;

  return (
    <div className="space-y-6">
      {/* ── Job header ── */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-primary leading-snug flex-1">{job.title}</h1>
          <StatusBadge variant={job.status} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="text-sm text-muted-foreground">
            {CATEGORY_LABELS[job.category] ?? job.category}
          </span>
          <span>·</span>
          <span>{relativeTime(job.created_at)}</span>
        </div>
        <p className="text-2xl font-bold text-primary">{formatInr(job.total_budget)}</p>
        {job.location_text && (
          <p className="text-sm text-muted-foreground">📍 {job.location_text}</p>
        )}
        {job.description && (
          <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {job.description}
          </p>
        )}
      </section>

      <Separator />

      {/* ── Milestones ── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Milestones ({milestones.length})
        </h2>
        <ol className="space-y-2">
          {milestones.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {m.sequence}. {m.title}
                </p>
                {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-sm font-semibold">{formatInr(m.amount)}</span>
                <StatusBadge variant={m.status} />
              </div>
            </li>
          ))}
        </ol>

        {/* Manage Milestones CTA for assigned / in_progress jobs */}
        {(job.status === "assigned" || job.status === "in_progress") && (
          <a
            href={`/client/jobs/${jobId}/milestones`}
            className={cn(
              buttonVariants({ size: "sm" }),
              "w-full gap-1.5 bg-blue-600 hover:bg-blue-700 mt-3",
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            Manage Escrow & Milestones
          </a>
        )}
      </section>

      {/* ── Materials ── */}
      {materials.length > 0 && (
        <>
          <Separator />
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              Materials ({materials.length})
            </h2>
            <ul className="space-y-2">
              {materials.map((mat) => (
                <li
                  key={mat.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{mat.item_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {mat.vendor_name} · qty {mat.qty}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatInr(mat.amount)}</span>
                    <StatusBadge variant={mat.status} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Separator />

      {/* ── Applications ── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            Applications ({applications.length})
          </h2>
        </div>

        {applications.length === 0 ? (
          <div className="rounded-xl border bg-muted/40 py-10 text-center text-sm text-muted-foreground">
            No applications yet. Share your job to attract workers.
          </div>
        ) : (
          <ul className="space-y-3">
            {applications.map((app) => (
              <li
                key={app.id}
                className={cn(
                  "rounded-xl border bg-card p-4 space-y-3 transition-opacity",
                  app.status === "rejected" && "opacity-50",
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{app.worker_name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <StatusBadge variant={app.worker_trust_tier} />
                      <StatusBadge variant={app.status} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatInr(app.bid_amount)}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Calendar className="h-3 w-3" />
                      {app.eta_days}d ETA
                    </p>
                  </div>
                </div>

                {app.message && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{app.message}</p>
                )}

                <p className="text-xs text-muted-foreground">{relativeTime(app.created_at)}</p>

                {app.status === "pending" && job.status === "open" && (
                  <Button
                    size="sm"
                    className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    disabled={isPending}
                    onClick={() => handleAccept(app.id)}
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Accept Worker
                  </Button>
                )}

                {app.status === "accepted" && (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Accepted
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ClientJobDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
