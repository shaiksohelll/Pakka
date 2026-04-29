import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WorkerJobDetail } from "./worker-job-detail";

export const metadata: Metadata = {
  title: "Job Detail — Pakka",
  description: "View job details and apply.",
};

export default async function WorkerJobDetailPage() {
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
        href="/worker/feed"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Browse
      </Link>
      <WorkerJobDetail workerKyc={kycStatus} />
    </main>
  );
}
