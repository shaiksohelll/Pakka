"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/account/sign-out-button";
import { EditProfileDialog } from "@/components/account/edit-profile-dialog";
import { ChangePhoneDialog } from "@/components/account/change-phone-dialog";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { createClient } from "@/lib/supabase/client";

type Profile = {
    id: string;
    full_name: string | null;
    phone: string | null;
    city: string | null;
    role: string;
    created_at: string;
};

export default function ClientAccountPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        const supabase = createClient();
        setLoading(true);
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }
        const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, phone, city, role, created_at")
            .eq("id", user.id)
            .single();
        if (!error && data) setProfile(data as Profile);
        setLoading(false);
    }

    useEffect(() => {
        void load();
    }, []);

    if (loading) {
        return (
            <main className="mx-auto max-w-[640px] px-4 py-8">
                <p className="text-sm text-muted-foreground">Loading…</p>
            </main>
        );
    }
    if (!profile) {
        return (
            <main className="mx-auto max-w-[640px] px-4 py-8">
                <p className="text-sm text-destructive">Not signed in.</p>
            </main>
        );
    }

    const profileDefaults = { full_name: profile.full_name ?? "", city: profile.city ?? "" };

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
                    <ChangePhoneDialog currentPhone={profile.phone} onChanged={load} />
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