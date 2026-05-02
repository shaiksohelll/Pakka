import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WorkerMilestones } from "./worker-milestones";

function useWorkerKyc() {
  return useQuery({
    queryKey: ["worker-kyc-status"],
    staleTime: 60_000,
    queryFn: async (): Promise<"pending" | "verified" | "rejected"> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return "pending";

      const { data } = await supabase
        .from("worker_profiles")
        .select("kyc_status")
        .eq("profile_id", user.id)
        .maybeSingle();

      return (data?.kyc_status ?? "pending") as "pending" | "verified" | "rejected";
    },
  });
}

export default function WorkerMilestonesPage() {
  const { data: kycStatus = "pending" } = useWorkerKyc();

  return (
    <main className="mx-auto max-w-[640px] px-4 py-6 space-y-4">
      <Link
        href=".."
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Job
      </Link>
      <WorkerMilestones workerKyc={kycStatus} />
    </main>
  );
}
