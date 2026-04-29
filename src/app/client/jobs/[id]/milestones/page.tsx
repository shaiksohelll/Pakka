import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientMilestones } from "./client-milestones";

export const metadata: Metadata = {
  title: "Milestones — Pakka",
  description: "Fund, track, and approve job milestones with escrow protection.",
};

export default function ClientMilestonesPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-6 space-y-4">
      <Link
        href=".."
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Job
      </Link>
      <ClientMilestones />
    </main>
  );
}
