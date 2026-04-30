import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account — Pakka",
  description: "Manage your worker account settings.",
};

export default function WorkerAccountPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-8">
      <h1 className="text-2xl font-bold text-primary mb-2">Account</h1>
      <p className="text-sm text-muted-foreground">
        Account settings coming soon. {/* TODO(adr-phase6): account settings UI */}
      </p>
    </main>
  );
}
