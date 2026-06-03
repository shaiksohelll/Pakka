import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WorkerMilestones } from "./worker-milestones";

export const metadata: Metadata = {
  title: "Milestones — Pakka",
  description: "Track and submit your job milestones.",
};

export default async function WorkerMilestonesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let kycStatus: "pending" | "verified" | "rejected" = "pending";
  if (user) {
    const { data } = await supabase
      .from("worker_profiles")
      .select("kyc_status")
      .eq("profile_id", user.id)
      .maybeSingle();
    kycStatus = (data?.kyc_status ?? "pending") as typeof kycStatus;
  }

  return (
    <main className="mx-auto max-w-[640px] px-4 py-6 space-y-4">
      <Link
        href={`/worker/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Job
      </Link>
      <WorkerMilestones workerKyc={kycStatus} />
    </main>
  );
}
