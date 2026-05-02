import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { WorkerFeed } from "./worker-feed";

export const metadata: Metadata = {
  title: "Browse Jobs — Pakka",
  description: "Browse open jobs and apply with your bid.",
};

export default async function WorkerFeedPage() {
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
    <main className="mx-auto max-w-[640px] px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-primary">Browse Jobs</h1>
        <p className="text-sm text-muted-foreground">Find work near you</p>
      </div>
      <WorkerFeed workerKyc={kycStatus} />
    </main>
  );
}
