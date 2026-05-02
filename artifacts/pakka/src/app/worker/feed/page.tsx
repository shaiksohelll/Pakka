import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { WorkerFeed } from "./worker-feed";

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

export default function WorkerFeedPage() {
  const { data: kycStatus = "pending" } = useWorkerKyc();

  return (
    <main className="mx-auto max-w-[640px] px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-primary">Browse Jobs</h1>
        <p className="text-sm text-muted-foreground">Find work near you</p>
      </div>
      <WorkerFeed workerKyc={kycStatus} />
    </main>
  );
}
