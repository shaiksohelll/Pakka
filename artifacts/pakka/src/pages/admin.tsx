import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/actions/auth";
import { useLocation } from "wouter";
import type { Profile } from "@/lib/types/database";

function useKycPending() {
  return useQuery({
    queryKey: ["admin-kyc-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("kyc_status", "pending")
        .eq("role", "worker");
      if (error) throw error;
      return data as Profile[];
    },
  });
}

function useAllJobs() {
  return useQuery({
    queryKey: ["admin-all-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export default function Admin() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { data: pendingKyc, isLoading: kycLoading } = useKycPending();
  const { data: recentJobs, isLoading: jobsLoading } = useAllJobs();

  const approveKyc = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const tier = status === "approved" ? "bronze" : null;
      const { error } = await supabase
        .from("profiles")
        .update({ kyc_status: status, ...(tier ? { trust_tier: tier } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`KYC ${vars.status}`);
      qc.invalidateQueries({ queryKey: ["admin-kyc-pending"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <PageShell
      title="Admin Dashboard"
      headerRight={
        <Button size="sm" variant="outline" onClick={handleSignOut}>
          Sign Out
        </Button>
      }
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <Shield className="h-5 w-5" />
          <span className="font-semibold">Admin Panel</span>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending KYC Reviews</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {kycLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            ) : pendingKyc?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending KYC reviews
              </p>
            ) : (
              pendingKyc?.map((profile) => (
                <div key={profile.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <Avatar className="h-10 w-10">
                    {profile.selfie_url ? (
                      <img src={profile.selfie_url} alt={profile.name ?? ""} className="object-cover" />
                    ) : (
                      <AvatarFallback className="bg-secondary">
                        {profile.name?.[0]?.toUpperCase() ?? "W"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Aadhaar last 4: {profile.aadhaar_last4 ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{profile.phone}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-green-600 border-green-300 hover:bg-green-50"
                      disabled={approveKyc.isPending}
                      onClick={() => approveKyc.mutate({ id: profile.id, status: "approved" })}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-red-600 border-red-300 hover:bg-red-50"
                      disabled={approveKyc.isPending}
                      onClick={() => approveKyc.mutate({ id: profile.id, status: "rejected" })}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Jobs (last 20)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {jobsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))
            ) : (
              recentJobs?.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                  <p className="text-sm truncate flex-1">{job.title}</p>
                  <StatusBadge status={job.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
