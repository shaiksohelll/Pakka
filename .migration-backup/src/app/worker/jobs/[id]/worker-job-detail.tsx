"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Send, CheckCircle2, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatInr, relativeTime, CATEGORY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApplyModal } from "./apply-modal";

type JobStatus = "open" | "assigned" | "in_progress" | "completed" | "cancelled" | "disputed";

type WorkerJobData = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  location_text: string | null;
  total_budget: number;
  status: JobStatus;
  created_at: string;
  milestones: {
    id: string;
    sequence: number;
    title: string;
    description: string | null;
    amount: number;
    status: string;
  }[];
  materials: {
    id: string;
    vendor_name: string;
    item_name: string;
    qty: number;
    amount: number;
  }[];
  hasApplied: boolean;
  workerKyc: "pending" | "verified" | "rejected";
};

async function fetchWorkerJobData(jobId: string, workerKyc: "pending" | "verified" | "rejected"): Promise<WorkerJobData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [jobRes, msRes, matRes, appRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,title,category,description,location_text,total_budget,status,created_at")
      .eq("id", jobId)
      .single(),
    supabase
      .from("milestones")
      .select("id,sequence,title,description,amount,status")
      .eq("job_id", jobId)
      .order("sequence"),
    supabase
      .from("materials")
      .select("id,vendor_name,item_name,qty,amount")
      .eq("job_id", jobId),
    supabase
      .from("job_applications")
      .select("id")
      .eq("job_id", jobId)
      .eq("worker_id", user.id)
      .maybeSingle(),
  ]);

  if (jobRes.error) throw jobRes.error;

  return {
    id: jobRes.data!.id,
    title: jobRes.data!.title,
    category: jobRes.data!.category,
    description: jobRes.data!.description,
    location_text: jobRes.data!.location_text,
    total_budget: Number(jobRes.data!.total_budget),
    status: jobRes.data!.status as JobStatus,
    created_at: jobRes.data!.created_at,
    milestones: (msRes.data ?? []).map((m) => ({
      ...m,
      amount: Number(m.amount),
    })),
    materials: (matRes.data ?? []).map((m) => ({
      ...m,
      qty: Number(m.qty),
      amount: Number(m.amount),
    })),
    hasApplied: appRes.data !== null,
    workerKyc,
  };
}

export function WorkerJobDetail({ workerKyc }: { workerKyc: "pending" | "verified" | "rejected" }) {
  const { id: jobId } = useParams<{ id: string }>();
  const [applyOpen, setApplyOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["worker-job", jobId, workerKyc],
    staleTime: 30_000,
    queryFn: () => fetchWorkerJobData(jobId, workerKyc),
  });

  function handleApplySuccess() {
    queryClient.invalidateQueries({ queryKey: ["worker-job", jobId] });
    queryClient.invalidateQueries({ queryKey: ["worker-applications"] });
    queryClient.invalidateQueries({ queryKey: ["worker-applied-jobs"] });
  }

  if (isLoading) return <WorkerJobSkeleton />;
  if (error || !data) {
    return (
      <div className="rounded-xl border bg-destructive/5 p-6 text-center text-destructive">
        Failed to load job. Please refresh.
      </div>
    );
  }

  const canApply = data.workerKyc === "verified" && !data.hasApplied && data.status === "open";
  const isOpen = data.status === "open";

  return (
    <>
      <div className="space-y-6 pb-28">
        {/* Header */}
        <section className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-primary flex-1 leading-snug">
              {data.title}
            </h1>
            <StatusBadge variant={data.status} />
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{CATEGORY_LABELS[data.category] ?? data.category}</span>
            {data.location_text && (
              <>
                <span>·</span>
                <span>📍 {data.location_text}</span>
              </>
            )}
            <span>·</span>
            <span>{relativeTime(data.created_at)}</span>
          </div>
          <p className="text-2xl font-bold text-primary">{formatInr(data.total_budget)}</p>
          {data.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {data.description}
            </p>
          )}
        </section>

        <Separator />

        {/* Milestones */}
        <section>
          <h2 className="mb-3 text-base font-semibold">
            Milestones ({data.milestones.length})
          </h2>
          <ol className="space-y-2">
            {data.milestones.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{m.sequence}. {m.title}</p>
                  {m.description && (
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  )}
                </div>
                <span className="text-sm font-semibold ml-3">{formatInr(m.amount)}</span>
              </li>
            ))}
          </ol>

          {/* Milestones CTA for assigned jobs */}
          {(data.status === "assigned" || data.status === "in_progress") && (
            <a
              href={`/worker/jobs/${jobId}/milestones`}
              className={cn(
                buttonVariants({ size: "sm" }),
                "w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 mt-3",
              )}
            >
              <Shield className="h-3.5 w-3.5" />
              View Milestones & Submit Work
            </a>
          )}
        </section>

        {/* Materials */}
        {data.materials.length > 0 && (
          <>
            <Separator />
            <section>
              <h2 className="mb-3 text-base font-semibold">
                Materials ({data.materials.length})
              </h2>
              <ul className="space-y-2">
                {data.materials.map((mat) => (
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
                    <span className="text-sm font-semibold">{formatInr(mat.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>

      {/* Sticky apply CTA */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-4 backdrop-blur max-w-[640px] mx-auto">
          {data.hasApplied ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Application sent
            </div>
          ) : data.workerKyc !== "verified" ? (
            <div className="space-y-2">
              <Button className="w-full" disabled>
                Apply — KYC Required
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Complete KYC verification to apply for jobs.
              </p>
            </div>
          ) : (
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setApplyOpen(true)}
              disabled={!canApply}
            >
              <Send className="h-4 w-4" />
              Apply for this Job
            </Button>
          )}
        </div>
      )}

      <ApplyModal
        open={applyOpen}
        onOpenChange={setApplyOpen}
        jobId={jobId}
        totalBudget={data.total_budget}
        onSuccess={handleApplySuccess}
      />
    </>
  );
}

function WorkerJobSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
