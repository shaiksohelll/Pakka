"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { EditProfileDialog } from "@/components/account/edit-profile-dialog";
import { ChangePhoneDialog } from "@/components/account/change-phone-dialog";
import { SignOutButton } from "@/components/account/sign-out-button";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  role: string;
  created_at: string;
};

type WorkerProfile = {
  kyc_status: string | null;
  trust_tier: string | null;
  rating: number | null;
  jobs_completed: number | null;
  categories: string[] | null;
};

export default function WorkerAccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace("/login");
      return;
    }
    const [{ data: p, error: pErr }, { data: w, error: wErr }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, city, role, created_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("worker_profiles")
        .select("kyc_status, trust_tier, rating, jobs_completed, categories")
        .eq("profile_id", user.id)
        .maybeSingle(),
    ]);
    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }
    if (wErr) {
      setError(wErr.message);
      setLoading(false);
      return;
    }
    setProfile(p as Profile);
    setWorker((w as WorkerProfile | null) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-8 pb-20 space-y-6">
        <h1 className="text-2xl font-bold text-primary">Account</h1>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-8 pb-20 space-y-6">
        <h1 className="text-2xl font-bold text-primary">Account</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-destructive font-medium">Could not load your account</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <button className="underline text-sm" onClick={() => void load()}>
              Retry
            </button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!profile) return null;

  const profileDefaults = {
    full_name: profile.full_name ?? "",
    city: profile.city ?? "",
  };

  return (
    <main className="mx-auto max-w-[640px] px-4 py-8 pb-20 space-y-6">
      <h1 className="text-2xl font-bold text-primary">Account</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Name" value={profile.full_name ?? "—"} />
          <Row label="Phone" value={profile.phone ?? "—"} />
          <Row label="City" value={profile.city ?? "—"} />
          <Row label="Member since" value={new Date(profile.created_at).toLocaleDateString()} />
        </CardContent>
      </Card>

      {worker && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Worker details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="KYC status" value={worker.kyc_status ?? "pending"} />
            <Row label="Trust tier" value={worker.trust_tier ?? "bronze"} />
            <Row label="Rating" value={worker.rating != null ? worker.rating.toFixed(1) : "—"} />
            <Row label="Jobs completed" value={String(worker.jobs_completed ?? 0)} />
            {worker.categories && worker.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {worker.categories.map((c) => (
                  <Badge key={c} variant="secondary">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <EditProfileDialog defaults={profileDefaults} onSaved={load} />
          <ChangePhoneDialog currentPhone={profile.phone ?? ""} onChanged={load} />
          <SignOutButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border last:border-0 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
