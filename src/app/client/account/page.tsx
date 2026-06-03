"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function ClientAccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  async function load() {
    const myRequestId = ++requestIdRef.current;
    const supabase = createClient();
    setLoading(true);
    setError(null);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (myRequestId !== requestIdRef.current) return;
    if (authError) {
      // TODO: Sentry.captureException(authError)
      setError("Couldn't verify your session. Please try again.");
      setLoading(false);
      return;
    }
    if (!user) {
      setProfile(null);
      setLoading(false);
      router.replace("/login");
      return;
    }
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("id, full_name, phone, city, role, created_at")
      .eq("id", user.id)
      .single();
    if (myRequestId !== requestIdRef.current) return;
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setProfile(data as Profile);
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
          <Row label="Role" value={profile.role} />
          <Row label="Member since" value={new Date(profile.created_at).toLocaleDateString()} />
        </CardContent>
      </Card>

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
